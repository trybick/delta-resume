import { useCallback, useEffect, useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { copyResumeRichText } from '../lib/copyResume';
import {
  EXPORT_SCALE_DEFAULT,
  buildDocumentDocx,
  buildTemplateDocx,
  clampExportScale,
  downloadDocx,
  normalizeResumeTextForComparison,
  patchOriginalDocx,
  type DocxInsertion,
  type DocxReplacement,
} from '../lib/exportDocx';
import {
  computeFitToOnePageScale,
  isOriginalSinglePage,
  type FitToOnePageScales,
} from '../lib/exportPageFit';
import { buildExportFilename, extractCandidateNameFromResume } from '../lib/exportFilename';
import { PdfConversionError, convertDocxToPdf, downloadPdf } from '../lib/exportPdf';
import { readCleanLayout, type DocxCleanLayout } from '../lib/docxLayout';
import { applyDecisionsAndInsertions, createLookup, lineAnchorIndex } from '../lib/resumeModel';
import type { AddedBullet, ChangeDecision, OriginalDocx, TailorResult } from '../lib/types';

type UseResumeExportOptions = {
  result: TailorResult | null;
  isExample: boolean;
  originalDocx: OriginalDocx | null;
  companyName?: string;
  decisions: Record<string, ChangeDecision>;
  activeAddedBullets: AddedBullet[];
};

type UseResumeExportResult = {
  isExporting: boolean;
  canPatchOriginal: boolean;
  exportScale: number;
  setExportScale: (scale: number) => void;
  fitToOnePage: boolean;
  setFitToOnePage: (enabled: boolean) => void;
  fitScaleByVariant: FitToOnePageScales;
  isComputingFit: boolean;
  handleCopy: () => Promise<void>;
  handleExport: (variant: 'keep' | 'clean', format: 'docx' | 'pdf') => Promise<boolean>;
};

const PLACEHOLDER_PATTERN = /\[[^\][]*\]/;

const hasUnfilledPlaceholders = (addedBullets: AddedBullet[]): boolean =>
  addedBullets.some(
    (bullet) => bullet.text.trim().length > 0 && PLACEHOLDER_PATTERN.test(bullet.text),
  );

const notifyPlaceholdersRemain = () => {
  notifications.show({
    color: 'orange',
    autoClose: 6000,
    title: 'Placeholders still in your resume',
    message:
      'Some added bullets still contain [bracketed] placeholders. Fill them in with your real details before sending this resume out.',
  });
};

export const useResumeExport = ({
  result,
  isExample,
  originalDocx,
  companyName,
  decisions,
  activeAddedBullets,
}: UseResumeExportOptions): UseResumeExportResult => {
  const [isExporting, setIsExporting] = useState(false);
  const [manualScale, setManualScale] = useState(EXPORT_SCALE_DEFAULT);
  const [fitToOnePage, setFitToOnePageState] = useState(false);
  const [fitScales, setFitScales] = useState<FitToOnePageScales>({
    clean: EXPORT_SCALE_DEFAULT,
    keep: EXPORT_SCALE_DEFAULT,
  });
  const [isComputingFit, setIsComputingFit] = useState(false);
  const autoFitResumeTextRef = useRef<string | null>(null);
  const fitTouchedRef = useRef(false);

  const exportScale = fitToOnePage ? Math.min(fitScales.clean, fitScales.keep) : manualScale;

  const setExportScale = (scale: number) => {
    setManualScale(clampExportScale(scale));
    fitTouchedRef.current = true;
    setFitToOnePageState(false);
  };

  const setFitToOnePage = (enabled: boolean) => {
    fitTouchedRef.current = true;
    setFitToOnePageState(enabled);
  };

  const buildMergedResume = useCallback(() => {
    if (!result) {
      return {
        lines: [] as string[],
        document: null,
        textsByNodeId: new Map<string, string>(),
      };
    }
    return applyDecisionsAndInsertions(
      result.resumeText,
      result.document,
      result.changes,
      decisions,
      activeAddedBullets,
    );
  }, [result, decisions, activeAddedBullets]);

  const canPatchOriginal =
    result !== null &&
    originalDocx !== null &&
    normalizeResumeTextForComparison(originalDocx.parsedText) ===
      normalizeResumeTextForComparison(result.resumeText);

  const buildKeepReplacements = useCallback((): DocxReplacement[] => {
    if (!result) return [];
    return result.changes
      .filter((change) => decisions[change.id] !== 'reverted')
      .flatMap((change) => {
        if (change.sourceLines.length <= 1) {
          return [{ original: change.original, tailored: change.tailored }];
        }
        const lines = result.resumeText.split('\n');
        const [firstLineIndex, ...continuationIndexes] = [...change.sourceLines].sort(
          (a, b) => a - b,
        );
        return [
          { original: lines[firstLineIndex] ?? change.original, tailored: change.tailored },
          ...continuationIndexes.map((lineIndex) => ({
            original: lines[lineIndex] ?? '',
            tailored: '',
          })),
        ];
      });
  }, [result, decisions]);

  const buildKeepInsertions = useCallback((): DocxInsertion[] => {
    if (!result || activeAddedBullets.length === 0) return [];
    const resumeLines = result.resumeText.split('\n');
    const lookup = createLookup(result.resumeText, result.document ?? null);
    return activeAddedBullets
      .filter((bullet) => bullet.text.trim().length > 0)
      .map((bullet) => {
        const anchorIndex = lineAnchorIndex(bullet.afterId);
        const afterOriginal =
          (anchorIndex !== null ? resumeLines[anchorIndex] : null) ??
          lookup.textForNode(bullet.afterId) ??
          result.changes.find((change) => change.targetId === bullet.afterId)?.original ??
          '';
        const trimmed = bullet.text.trim();
        const text = isLikelyBullet(trimmed)
          ? trimmed
          : isLikelyBullet(afterOriginal)
            ? `${bulletPrefix(afterOriginal)}${trimmed}`
            : `- ${trimmed}`;
        return { afterOriginal, text };
      })
      .filter((insertion) => insertion.afterOriginal.trim().length > 0);
  }, [result, activeAddedBullets]);

  const loadCleanLayout = useCallback(async (): Promise<DocxCleanLayout | null> => {
    if (!result) return null;
    if (!originalDocx) return result.resumeLayout ?? null;
    try {
      return await readCleanLayout(originalDocx.file, result.resumeText);
    } catch {
      return result.resumeLayout ?? null;
    }
  }, [result, originalDocx]);

  useEffect(() => {
    if (!result || autoFitResumeTextRef.current === result.resumeText) return;
    fitTouchedRef.current = false;

    if (isExample || !originalDocx) {
      autoFitResumeTextRef.current = result.resumeText;
      return;
    }

    // The ref is only claimed once the check actually settles (not before it
    // starts), so a run cancelled by StrictMode's dev-only double-effect
    // doesn't block the real run that follows it from ever completing.
    let cancelled = false;
    void isOriginalSinglePage(originalDocx.file)
      .then((singlePage) => {
        if (cancelled) return;
        autoFitResumeTextRef.current = result.resumeText;
        if (fitTouchedRef.current || !singlePage) return;
        setFitToOnePageState(true);
      })
      .catch(() => {
        /* leave the checkbox off when the original cannot be measured */
        if (!cancelled) autoFitResumeTextRef.current = result.resumeText;
      });

    return () => {
      cancelled = true;
    };
  }, [result, isExample, originalDocx]);

  useEffect(() => {
    if (!fitToOnePage || !result || isExample) return;

    let cancelled = false;
    setIsComputingFit(true);

    void (async () => {
      try {
        const merged = buildMergedResume();
        const layout = await loadCleanLayout();
        const scales = await computeFitToOnePageScale({
          resumeDocument: merged.document,
          resumeText: merged.lines.join('\n'),
          textsByNodeId: merged.textsByNodeId,
          layout,
          originalFile: canPatchOriginal ? (originalDocx?.file ?? null) : null,
          replacements: buildKeepReplacements(),
          insertions: buildKeepInsertions(),
        });
        if (!cancelled) setFitScales(scales);
      } catch {
        if (!cancelled) {
          setFitScales({ clean: EXPORT_SCALE_DEFAULT, keep: EXPORT_SCALE_DEFAULT });
        }
      } finally {
        if (!cancelled) setIsComputingFit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    fitToOnePage,
    result,
    isExample,
    canPatchOriginal,
    originalDocx,
    buildMergedResume,
    loadCleanLayout,
    buildKeepReplacements,
    buildKeepInsertions,
  ]);

  const resumeFilename = (format: 'docx' | 'pdf'): string => {
    const merged = buildMergedResume();
    const candidateName = extractCandidateNameFromResume(
      merged.lines,
      merged.document,
      merged.textsByNodeId,
    );
    return buildExportFilename([candidateName, companyName, 'resume'], 'resume', format);
  };

  const scaleForExport = (variant: 'keep' | 'clean'): number => {
    if (!fitToOnePage) return manualScale;
    if (variant === 'keep' && canPatchOriginal) return fitScales.keep;
    return fitScales.clean;
  };

  const buildCleanDocx = async (scale: number): Promise<Blob> => {
    const merged = buildMergedResume();
    const layout = await loadCleanLayout();
    return merged.document
      ? buildDocumentDocx(merged.document, merged.textsByNodeId, layout, scale)
      : buildTemplateDocx(merged.lines.join('\n'), layout, scale);
  };

  const buildPatchedDocx = async (scale: number): Promise<Blob> => {
    if (!result || !originalDocx) return buildCleanDocx(scaleForExport('clean'));
    try {
      return await patchOriginalDocx(
        originalDocx.file,
        buildKeepReplacements(),
        buildKeepInsertions(),
        scale,
      );
    } catch {
      notifications.show({
        color: 'orange',
        title: 'Original layout unavailable',
        message:
          'We could not preserve your original formatting, so a clean template was used instead.',
      });
      return buildCleanDocx(scaleForExport('clean'));
    }
  };

  const handleCopy = async () => {
    if (!result || isExample) return;
    trackEvent(AnalyticsEvents.ResumeCopy);
    try {
      const merged = buildMergedResume();
      const layout = await loadCleanLayout();
      await copyResumeRichText(
        merged.lines,
        merged.document,
        merged.textsByNodeId,
        layout?.hrefByAnchorText,
      );
      trackEvent(AnalyticsEvents.CopySuccess, { source: 'resume' });
      notifications.show({
        color: 'green',
        title: 'Copied',
        message: 'Resume copied to clipboard.',
      });
    } catch {
      trackEvent(AnalyticsEvents.CopyFailure, { source: 'resume' });
      notifications.show({
        color: 'red',
        title: 'Copy failed',
        message: 'Could not copy the resume to your clipboard.',
      });
    }
  };

  const handleExport = async (variant: 'keep' | 'clean', format: 'docx' | 'pdf') => {
    if (!result || isExample || isExporting) return false;
    const scale = scaleForExport(variant);
    trackEvent(AnalyticsEvents.ResumeExport, {
      variant,
      format,
      scale,
      fitToOnePage,
    });
    setIsExporting(true);
    try {
      const docxBlob =
        variant === 'keep' ? await buildPatchedDocx(scale) : await buildCleanDocx(scale);
      const filename = resumeFilename(format);
      if (format === 'docx') {
        downloadDocx(docxBlob, filename);
      } else {
        const pdfBlob = await convertDocxToPdf(docxBlob);
        downloadPdf(pdfBlob, filename);
      }
      trackEvent(AnalyticsEvents.ExportSuccess, {
        source: 'resume',
        variant,
        format,
      });
      if (hasUnfilledPlaceholders(activeAddedBullets)) {
        notifyPlaceholdersRemain();
      }
      return true;
    } catch (error) {
      trackEvent(AnalyticsEvents.ExportFailure, {
        source: 'resume',
        variant,
        format,
      });
      if (!(error instanceof PdfConversionError)) {
        notifications.show({
          color: 'red',
          title: 'Export failed',
          message: 'Could not generate the file. Please try again.',
        });
      }
      return false;
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExporting,
    canPatchOriginal,
    exportScale,
    setExportScale,
    fitToOnePage,
    setFitToOnePage,
    fitScaleByVariant: fitScales,
    isComputingFit,
    handleCopy,
    handleExport,
  };
};

const BULLET_MARKER = /^[\s\u00A0]*(?:[-–—•‣◦▪▫·∙●○*+>][\s\u00A0]*|\d{1,2}[.)][\s\u00A0]+)/;

const isLikelyBullet = (line: string): boolean => {
  const trimmed = line.trim();
  const stripped = line.replace(BULLET_MARKER, '').trim();
  return stripped !== trimmed && stripped.length > 0;
};

const bulletPrefix = (line: string): string =>
  line.slice(0, line.length - line.replace(BULLET_MARKER, '').length);
