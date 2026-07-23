import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { copyResumeRichText } from '../lib/copyResume';
import { applyAddedBullets, formatAddedBulletLine } from '../lib/insertions';
import {
  buildStructuredDocx,
  buildTemplateDocx,
  downloadDocx,
  normalizeResumeTextForComparison,
  patchOriginalDocx,
  type DocxInsertion,
} from '../lib/exportDocx';
import { buildExportFilename, extractCandidateNameFromResume } from '../lib/exportFilename';
import { PdfConversionError, convertDocxToPdf, downloadPdf } from '../lib/exportPdf';
import type {
  AddedBullet,
  BulletChange,
  ChangeDecision,
  OriginalDocx,
  TailorResult,
} from '../lib/types';
import type { PreviewVariant } from '../components/DocumentPreviewModal';

type UseResumeExportOptions = {
  result: TailorResult | null;
  isExample: boolean;
  originalDocx: OriginalDocx | null;
  jobTitle?: string;
  companyName?: string;
  decisions: Record<string, ChangeDecision>;
  changesByLine: Map<number, BulletChange>;
  activeAddedBullets: AddedBullet[];
};

type UseResumeExportResult = {
  isExporting: boolean;
  previewOpen: boolean;
  canPatchOriginal: boolean;
  handleCopy: () => Promise<void>;
  handleExport: (variant: 'keep' | 'clean', format: 'docx' | 'pdf') => Promise<boolean>;
  buildPreviewDocx: (variant: PreviewVariant) => Promise<Blob>;
  handlePreviewOpen: () => void;
  handlePreviewClose: () => void;
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
  jobTitle,
  companyName,
  decisions,
  changesByLine,
  activeAddedBullets,
}: UseResumeExportOptions): UseResumeExportResult => {
  const [isExporting, setIsExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const buildMergedLines = (): string[] => {
    if (!result) return [];
    const consumedByChange = new Map<number, BulletChange>();
    changesByLine.forEach((change) => {
      change.lineIndexes
        .filter((lineIndex) => lineIndex !== change.lineIndex)
        .forEach((lineIndex) => consumedByChange.set(lineIndex, change));
    });
    return result.resumeText.split('\n').map((line, lineIndex) => {
      const change = changesByLine.get(lineIndex);
      if (change) {
        if (decisions[change.id] !== 'reverted') return change.tailored;
        return change.lineIndexes.length > 1 ? line : change.original;
      }
      const consumingChange = consumedByChange.get(lineIndex);
      if (!consumingChange) return line;
      return decisions[consumingChange.id] === 'reverted' ? line : '';
    });
  };

  const buildMergedResume = () =>
    applyAddedBullets(buildMergedLines(), result?.structure, activeAddedBullets);

  const canPatchOriginal =
    result !== null &&
    originalDocx !== null &&
    normalizeResumeTextForComparison(originalDocx.parsedText) ===
      normalizeResumeTextForComparison(result.resumeText);

  const resumeFilename = (format: 'docx' | 'pdf'): string => {
    const merged = buildMergedResume();
    const candidateName = extractCandidateNameFromResume(merged.lines, merged.structure);
    const exportDate = new Date().toLocaleDateString('en-CA');
    return buildExportFilename(
      [candidateName, companyName, jobTitle, 'tailored-resume', exportDate],
      `tailored-resume-${exportDate}`,
      format,
    );
  };

  const buildCleanDocx = (): Promise<Blob> => {
    const merged = buildMergedResume();
    return merged.structure
      ? buildStructuredDocx(merged.lines, merged.structure)
      : buildTemplateDocx(merged.lines.join('\n'));
  };

  const buildKeepInsertions = (): DocxInsertion[] => {
    if (!result || activeAddedBullets.length === 0) return [];
    const resumeLines = result.resumeText.split('\n');
    return activeAddedBullets
      .filter((bullet) => bullet.text.trim().length > 0)
      .map((bullet) => {
        const afterLineIndex = Math.max(
          0,
          Math.min(bullet.afterLineIndex, Math.max(resumeLines.length - 1, 0)),
        );
        const afterOriginal = resumeLines[afterLineIndex] ?? '';
        return {
          afterOriginal,
          text: formatAddedBulletLine(bullet.text, afterOriginal),
        };
      });
  };

  const buildPatchedDocx = async (): Promise<Blob> => {
    if (!result || !originalDocx) return buildCleanDocx();
    const resumeLines = result.resumeText.split('\n');
    const replacements = result.changes
      .filter((change) => decisions[change.id] !== 'reverted')
      .flatMap((change) => {
        if (change.lineIndexes.length <= 1) {
          return [{ original: change.original, tailored: change.tailored }];
        }
        const [firstLineIndex, ...continuationIndexes] = [...change.lineIndexes].sort(
          (a, b) => a - b,
        );
        return [
          { original: resumeLines[firstLineIndex] ?? change.original, tailored: change.tailored },
          ...continuationIndexes.map((lineIndex) => ({
            original: resumeLines[lineIndex] ?? '',
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
      await copyResumeRichText(merged.lines, merged.structure);
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

  const buildPreviewDocx = (variant: PreviewVariant): Promise<Blob> =>
    variant === 'keep' ? buildPatchedDocx() : buildCleanDocx();

  const handlePreviewOpen = () => {
    if (!result) return;
    trackEvent(AnalyticsEvents.ResumePreviewOpen, { is_example: isExample });
    setPreviewOpen(true);
  };

  const handlePreviewClose = () => {
    trackEvent(AnalyticsEvents.ResumePreviewClose);
    setPreviewOpen(false);
  };

  return {
    isExporting,
    previewOpen,
    canPatchOriginal,
    handleCopy,
    handleExport,
    buildPreviewDocx,
    handlePreviewOpen,
    handlePreviewClose,
  };
};
