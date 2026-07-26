import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { copyResumeRichText } from '../lib/copyResume';
import {
  buildDocumentDocx,
  buildTemplateDocx,
  downloadDocx,
  normalizeResumeTextForComparison,
  patchOriginalDocx,
  type DocxInsertion,
} from '../lib/exportDocx';
import { buildExportFilename, extractCandidateNameFromResume } from '../lib/exportFilename';
import { PdfConversionError, convertDocxToPdf, downloadPdf } from '../lib/exportPdf';
import { readCleanLayout, type DocxCleanLayout } from '../lib/docxLayout';
import { applyDecisionsAndInsertions, createLookup, lineAnchorIndex } from '../lib/resumeModel';
import type {
  AddedBullet,
  ChangeDecision,
  OriginalDocx,
  TailorResult,
} from '../lib/types';

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
  handleCopy: () => Promise<void>;
  handleExport: (variant: 'keep' | 'clean', format: 'docx' | 'pdf') => Promise<boolean>;
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

  const buildMergedResume = () => {
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
  };

  const canPatchOriginal =
    result !== null &&
    originalDocx !== null &&
    normalizeResumeTextForComparison(originalDocx.parsedText) ===
      normalizeResumeTextForComparison(result.resumeText);

  const resumeFilename = (format: 'docx' | 'pdf'): string => {
    const merged = buildMergedResume();
    const candidateName = extractCandidateNameFromResume(
      merged.lines,
      merged.document,
      merged.textsByNodeId,
    );
    return buildExportFilename(
      [candidateName, companyName, 'resume'],
      'resume',
      format,
    );
  };

  // Table layout and hyperlink targets are lost by text extraction, so they are
  // recovered from the cached original .docx at export time.
  const loadCleanLayout = async (): Promise<DocxCleanLayout | null> => {
    if (!result || !originalDocx) return null;
    try {
      return await readCleanLayout(originalDocx.file, result.resumeText);
    } catch {
      return null;
    }
  };

  const buildCleanDocx = async (): Promise<Blob> => {
    const merged = buildMergedResume();
    const layout = await loadCleanLayout();
    return merged.document
      ? buildDocumentDocx(merged.document, merged.textsByNodeId, layout)
      : buildTemplateDocx(merged.lines.join('\n'), layout);
  };

  const buildKeepInsertions = (): DocxInsertion[] => {
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
  };

  const buildPatchedDocx = async (): Promise<Blob> => {
    if (!result || !originalDocx) return buildCleanDocx();
    const replacements = result.changes
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
    const insertions = buildKeepInsertions();
    try {
      return await patchOriginalDocx(originalDocx.file, replacements, insertions);
    } catch {
      notifications.show({
        color: 'orange',
        title: 'Original layout unavailable',
        message:
          'We could not preserve your original formatting, so a clean template was used instead.',
      });
      return buildCleanDocx();
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
    trackEvent(AnalyticsEvents.ResumeExport, { variant, format });
    setIsExporting(true);
    try {
      const docxBlob = variant === 'keep' ? await buildPatchedDocx() : await buildCleanDocx();
      const filename = resumeFilename(format);
      if (format === 'docx') {
        downloadDocx(docxBlob, filename);
        trackEvent(AnalyticsEvents.ExportSuccess, {
          source: 'resume',
          variant,
          format,
        });
        return true;
      }
      const pdfBlob = await convertDocxToPdf(docxBlob);
      downloadPdf(pdfBlob, filename);
      trackEvent(AnalyticsEvents.ExportSuccess, {
        source: 'resume',
        variant,
        format,
      });
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
