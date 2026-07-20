import { isBulletLine, isHeadingLine, stripBulletMarker } from './exportDocx';
import type { ResumeStructure } from './types';

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BASE_STYLE = 'font-family: Calibri, Arial, sans-serif; font-size: 11pt;';

const escapeLines = (texts: string[]): string => texts.map(escapeHtml).join('<br>');

const nameHtml = (texts: string[]): string =>
  `<p style="text-align: center; font-size: 16pt; font-weight: bold; margin: 0 0 4pt 0;">${escapeLines(texts)}</p>`;

const headerLineHtml = (texts: string[]): string =>
  `<p style="text-align: center; margin: 0 0 2pt 0;">${escapeLines(texts)}</p>`;

const headingHtml = (texts: string[]): string =>
  `<p style="font-size: 12pt; font-weight: bold; border-bottom: 1px solid #999; margin: 10pt 0 4pt 0;">${escapeLines(texts)}</p>`;

const subheadingHtml = (texts: string[]): string =>
  `<p style="font-weight: bold; margin: 6pt 0 2pt 0;">${escapeLines(texts)}</p>`;

const paragraphHtml = (texts: string[]): string =>
  `<p style="margin: 0 0 4pt 0;">${escapeLines(texts)}</p>`;

const listItemHtml = (texts: string[]): string =>
  `<li style="margin: 0 0 2pt 0;">${escapeLines(texts)}</li>`;

const wrapList = (items: string[]): string =>
  `<ul style="margin: 0 0 6pt 0;">${items.join('')}</ul>`;

const structuredLines = (lines: string[], lineIndexes: number[]): string[] =>
  lineIndexes
    .map((lineIndex) => stripBulletMarker(lines[lineIndex] ?? '').trim())
    .filter((text) => text.length > 0);

export const buildStructuredResumeHtml = (lines: string[], structure: ResumeStructure): string => {
  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(wrapList(listItems));
    listItems = [];
  };

  structure.headerLines.forEach((lineIndex, headerIndex) => {
    const texts = structuredLines(lines, [lineIndex]);
    if (texts.length === 0) return;
    blocks.push(headerIndex === 0 ? nameHtml(texts) : headerLineHtml(texts));
  });

  structure.sections.forEach((section) => {
    if (section.headingLine !== null) {
      const headingTexts = structuredLines(lines, [section.headingLine]);
      if (headingTexts.length > 0) {
        flushList();
        blocks.push(headingHtml(headingTexts));
      }
    }
    section.items.forEach((item) => {
      const texts = structuredLines(lines, item.lines);
      if (texts.length === 0) return;
      if (item.kind === 'bullet') {
        listItems.push(listItemHtml(texts));
        return;
      }
      flushList();
      blocks.push(item.kind === 'subheading' ? subheadingHtml(texts) : paragraphHtml(texts));
    });
    flushList();
  });

  return `<div style="${BASE_STYLE}">${blocks.join('')}</div>`;
};

export const buildResumeHtml = (resumeText: string): string => {
  const lines = resumeText.split('\n');
  const blocks: string[] = [];
  let listItems: string[] = [];
  let contentIndex = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(wrapList(listItems));
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    if (contentIndex === 0) {
      blocks.push(nameHtml([trimmed]));
      contentIndex += 1;
      return;
    }

    if (isBulletLine(line)) {
      listItems.push(listItemHtml([stripBulletMarker(line).trim()]));
      contentIndex += 1;
      return;
    }

    if (isHeadingLine(line)) {
      flushList();
      blocks.push(headingHtml([trimmed]));
      contentIndex += 1;
      return;
    }

    flushList();
    blocks.push(paragraphHtml([trimmed]));
    contentIndex += 1;
  });

  flushList();
  return `<div style="${BASE_STYLE}">${blocks.join('')}</div>`;
};

const writeToClipboard = async (html: string, plainText: string): Promise<void> => {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    await navigator.clipboard.writeText(plainText);
    return;
  }
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' }),
    }),
  ]);
};

export const copyResumeRichText = async (
  lines: string[],
  structure: ResumeStructure | null | undefined,
): Promise<void> => {
  const plainText = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  const html = structure ? buildStructuredResumeHtml(lines, structure) : buildResumeHtml(plainText);
  await writeToClipboard(html, plainText);
};
