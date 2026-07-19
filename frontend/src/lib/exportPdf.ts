import * as Sentry from '@sentry/react';
import { notifications } from '@mantine/notifications';
import { convertDocxToPdfRemote } from './api';
import { AnalyticsEvents, trackEvent } from './analytics';

const PDF_MIME = 'application/pdf';

export const convertDocxToPdf = async (docxBlob: Blob): Promise<Blob> => {
  try {
    return await convertDocxToPdfRemote(docxBlob);
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'pdf_conversion' } });
    trackEvent(AnalyticsEvents.PdfUnavailable);
    notifications.show({
      color: 'yellow',
      title: 'PDF unavailable',
      message: 'PDF service is busy — download DOCX instead.',
      autoClose: 8000,
    });
    throw error;
  }
};

export const downloadPdf = (blob: Blob, filename: string): void => {
  const typedBlob = blob.type === PDF_MIME ? blob : new Blob([blob], { type: PDF_MIME });
  const url = URL.createObjectURL(typedBlob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
};
