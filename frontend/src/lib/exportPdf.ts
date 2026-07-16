import { renderAsync } from 'docx-preview';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as Sentry from '@sentry/react';
import { notifications } from '@mantine/notifications';
import { convertDocxToPdfRemote } from './api';
import { AnalyticsEvents, trackEvent } from './analytics';

const PDF_MIME = 'application/pdf';
const RENDER_SCALE = 2;

const waitForFonts = async (): Promise<void> => {
  if ('fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font loading failures, canvas will still render fallback fonts
    }
  }
};

const createHiddenContainer = (): HTMLDivElement => {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-10000px';
  container.style.zIndex = '-1';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);
  return container;
};

export const convertDocxToPdf = async (docxBlob: Blob): Promise<Blob> => {
  const container = createHiddenContainer();
  try {
    await renderAsync(docxBlob, container, container, {
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      experimental: true,
    });
    await waitForFonts();

    const pages = Array.from(container.querySelectorAll<HTMLElement>('.docx'));
    if (pages.length === 0) throw new Error('could not render document pages');

    let pdf: jsPDF | null = null;
    for (const page of pages) {
      const canvas = await html2canvas(page, {
        scale: RENDER_SCALE,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imageData = canvas.toDataURL('image/jpeg', 0.95);
      const pageWidth = canvas.width / RENDER_SCALE;
      const pageHeight = canvas.height / RENDER_SCALE;

      if (!pdf) {
        pdf = new jsPDF({
          orientation: pageWidth > pageHeight ? 'landscape' : 'portrait',
          unit: 'px',
          format: [pageWidth, pageHeight],
        });
      } else {
        pdf.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'landscape' : 'portrait');
      }
      pdf.addImage(imageData, 'JPEG', 0, 0, pageWidth, pageHeight);
    }

    if (!pdf) throw new Error('could not build pdf');
    return pdf.output('blob');
  } finally {
    container.remove();
  }
};

export const convertDocxToPdfWithFallback = async (docxBlob: Blob): Promise<Blob> => {
  try {
    return await convertDocxToPdfRemote(docxBlob);
  } catch (error) {
    console.warn('Server PDF conversion failed; falling back to in-browser image PDF.', error);
    Sentry.captureException(error, { tags: { feature: 'pdf_server_fallback' } });
    trackEvent(AnalyticsEvents.PdfServerFallback);
    notifications.show({
      color: 'yellow',
      title: 'PDF generated in your browser',
      message:
        'The server converter was unavailable, so this PDF has no selectable text. For applications, prefer the .docx export.',
      autoClose: 8000,
    });
    return convertDocxToPdf(docxBlob);
  }
};

export const downloadPdf = (blob: Blob, filename: string): void => {
  const typedBlob = blob.type === PDF_MIME ? blob : new Blob([blob], { type: PDF_MIME });
  const url = URL.createObjectURL(typedBlob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
