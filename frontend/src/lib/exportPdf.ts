import * as Sentry from '@sentry/react';
import { notifications } from '@mantine/notifications';
import { ApiError, convertDocxToPdfRemote } from './api';
import { AnalyticsEvents, trackEvent } from './analytics';

const PDF_MIME = 'application/pdf';

export class PdfConversionError extends Error {
  constructor(cause: unknown) {
    super('PDF conversion failed');
    this.name = 'PdfConversionError';
    this.cause = cause;
  }
}

export const convertDocxToPdf = async (docxBlob: Blob): Promise<Blob> => {
  try {
    return await convertDocxToPdfRemote(docxBlob);
  } catch (error) {
    Sentry.captureException(error, { tags: { feature: 'pdf_conversion' } });
    trackEvent(AnalyticsEvents.PdfUnavailable);
    const isIdentityRequired = error instanceof ApiError && error.status === 401;
    notifications.show({
      color: 'yellow',
      title: 'PDF unavailable',
      message: isIdentityRequired
        ? 'We could not verify your browser. Sign in to export a PDF, or download DOCX instead.'
        : 'PDF service is busy — download DOCX instead.',
      autoClose: 8000,
    });
    throw new PdfConversionError(error);
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
