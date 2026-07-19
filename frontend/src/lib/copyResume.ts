import { isBulletLine, isHeadingLine, stripBulletMarker } from './exportDocx';
import type { ResumeStructure } from './types';

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BASE_STYLE = 'font-family: Calibri, Arial, sans-serif; font-size: 11pt;';

const nameHtml = (text: string): string =>
  `<p style="text-align: center; font-size: 16pt; font-weight: bold; margin: 0 0 4pt 0;">${text}</p>`;

const headerLineHtml = (text: string): string =>
  `<p style="text-align: center; margin: 0 0 2pt 0;">${text}</p>`;

const headingHtml = (text: string): string =>
  `<p style="font-size: 12pt; font-weight: bold; border-bottom: 1px solid #999; margin: 10pt 0 4pt 0;">${text}</p>`;

const subheadingHtml = (text: string): string =>
  `<p style="font-weight: bold; margin: 6pt 0 2pt 0;">${text}</p>`;

const paragraphHtml = (text: string): string =>
  `<p style="margin: 0 0 4pt 0;">${text}</p>`;

const listItemHtml = (text: string): string =>
  `<li style="margin: 0 0 2pt 0;">${text}</li>`;

const wrapList = (items: string[]): string =>
  `<ul style="margin: 0 0 6pt 0;">${items.join('')}</ul>`;

const structuredHtml = (lines: string[], lineIndexes: number[]): string =>
  lineIndexes
    .map((lineIndex) => stripBulletMarker(lines[lineIndex] ?? '').trim())
    .filter((text) => text.length > 0)
    .map(escapeHtml)
    .join('<br>');

export const buildStructuredResumeHtml = (lines: string[], structure: ResumeStructure): string => {
  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(wrapList(listItems));
    listItems = [];
  };

  structure.headerLines.forEach((lineIndex, headerIndex) => {
    const text = structuredHtml(lines, [lineIndex]);
    if (!text) return;
    blocks.push(headerIndex === 0 ? nameHtml(text) : headerLineHtml(text));
  });

  structure.sections.forEach((section) => {
    if (section.headingLine !== null) {
      const headingText = structuredHtml(lines, [section.headingLine]);
      if (headingText) {
        flushList();
        blocks.push(headingHtml(headingText));
      }
    }
    section.items.forEach((item) => {
      const text = structuredHtml(lines, item.lines);
      if (!text) return;
      if (item.kind === 'bullet') {
        listItems.push(listItemHtml(text));
        return;
      }
      flushList();
      blocks.push(item.kind === 'subheading' ? subheadingHtml(text) : paragraphHtml(text));
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
      blocks.push(nameHtml(escapeHtml(trimmed)));
      contentIndex += 1;
      return;
    }

    if (isBulletLine(line)) {
      listItems.push(listItemHtml(escapeHtml(stripBulletMarker(line).trim())));
      contentIndex += 1;
      return;
    }

    if (isHeadingLine(line)) {
      flushList();
      blocks.push(headingHtml(escapeHtml(trimmed)));
      contentIndex += 1;
      return;
    }

    flushList();
    blocks.push(paragraphHtml(escapeHtml(trimmed)));
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
  const plainText = lines.join('\n');
  const html = structure ? buildStructuredResumeHtml(lines, structure) : buildResumeHtml(plainText);
  await writeToClipboard(html, plainText);
};
