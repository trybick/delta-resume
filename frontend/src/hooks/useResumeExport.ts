import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { copyResumeRichText } from '../lib/copyResume';
import { applyAddedBullets } from '../lib/insertions';
import {
  buildStructuredDocx,
  buildTemplateDocx,
  downloadDocx,
  normalizeResumeTextForComparison,
  patchOriginalDocx,
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

export const useResumeExport = ({
  result,
  isExample,
  originalDocx,
  decisions,
  changesByLine,
  activeAddedBullets,
}: UseResumeExportOptions): UseResumeExportResult => {
  const [isExporting, setIsExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const buildMergedLines = (): string[] => {
    if (!result) return [];
    return result.resumeText.split('\n').map((line, lineIndex) => {
      const change = changesByLine.get(lineIndex);
      if (!change) return line;
      return decisions[change.id] === 'reverted' ? change.original : change.tailored;
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
    return buildExportFilename([candidateName, 'resume'], 'tailored-resume', format);
  };

  const buildCleanDocx = (): Promise<Blob> => {
    const merged = buildMergedResume();
    return merged.structure
      ? buildStructuredDocx(merged.lines, merged.structure)
      : buildTemplateDocx(merged.lines.join('\n'));
  };

  const buildPatchedDocx = async (): Promise<Blob> => {
    if (!result || !originalDocx) return buildCleanDocx();
    const replacements = result.changes
      .filter((change) => decisions[change.id] !== 'reverted')
      .map((change) => ({ original: change.original, tailored: change.tailored }));
    try {
      return await patchOriginalDocx(originalDocx.file, replacements);
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
    if (variant === 'keep' && activeAddedBullets.length > 0) {
      notifications.show({
        color: 'orange',
        title: 'Added bullets not included',
        message:
          'New bullets can\u2019t be inserted into your original file. Use the clean template or copy to clipboard to include them.',
      });
    }
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

  const buildPreviewDocx = (variant: PreviewVariant): Promise<Blob> =>
    variant === 'keep' ? buildPatchedDocx() : buildCleanDocx();

  const handlePreviewOpen = () => {
    if (!result || isExample) return;
    trackEvent(AnalyticsEvents.ResumePreviewOpen);
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
