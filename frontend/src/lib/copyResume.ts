import { isBulletLine, isHeadingLine, stripBulletMarker } from './exportDocx';
import { entryDisplayDate, entryDisplayLeft } from './resumeModel';
import type { ResumeDocument } from './types';

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BASE_STYLE = 'font-family: Arial, sans-serif; font-size: 11pt;';

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

export const buildDocumentResumeHtml = (
  document: ResumeDocument,
  textsByNodeId: Map<string, string>,
): string => {
  const blocks: string[] = [];
  let listItems: string[] = [];
  const textOf = (nodeId: string): string => textsByNodeId.get(nodeId)?.trim() ?? '';

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(wrapList(listItems));
    listItems = [];
  };

  const nameText = textOf(document.header.name.id);
  if (nameText) blocks.push(nameHtml([nameText]));
  document.header.contact.forEach((item) => {
    const text = textOf(item.id);
    if (text) blocks.push(headerLineHtml([text]));
  });

  document.sections.forEach((section) => {
    if (section.heading) {
      const headingText = textOf(section.heading.id);
      if (headingText) {
        flushList();
        blocks.push(headingHtml([headingText]));
      }
    }

    section.blocks.forEach((block) => {
      if (block.kind === 'entry') {
        flushList();
        const left = entryDisplayLeft(block) || textOf(block.id);
        const dateText = entryDisplayDate(block);
        const heading = left && dateText ? `${left} ${dateText}` : left || dateText || '';
        if (heading) blocks.push(subheadingHtml([heading]));
        block.bullets.forEach((bullet) => {
          const text = stripBulletMarker(textOf(bullet.id)).trim();
          if (text) listItems.push(listItemHtml([text]));
        });
        flushList();
        return;
      }
      if (block.kind === 'bullet') {
        const text = stripBulletMarker(textOf(block.id)).trim();
        if (text) listItems.push(listItemHtml([text]));
        return;
      }
      flushList();
      const text = textOf(block.id);
      if (text) blocks.push(paragraphHtml([text]));
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
  document: ResumeDocument | null | undefined,
  textsByNodeId?: Map<string, string>,
): Promise<void> => {
  const plainText = lines.join('\n').replace(/\n{3,}/g, '\n\n');
  const html =
    document && textsByNodeId
      ? buildDocumentResumeHtml(document, textsByNodeId)
      : buildResumeHtml(plainText);
  await writeToClipboard(html, plainText);
};
