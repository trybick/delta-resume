import JSZip from 'jszip';
import {
  AlignmentType,
  BorderStyle,
  Document,
  LevelFormat,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  TextRun,
} from 'docx';
import { formatCoverLetterDate, formatCoverLetterSubject } from './formatCoverLetter';
import type { ResumeStructure } from './types';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const BULLET_MARKER = /^[\s\u00A0]*(?:[-–—•‣◦▪▫·∙●○*+>][\s\u00A0]*|\d{1,2}[.)][\s\u00A0]+)/;

const FONT = 'Calibri';
const BODY_SIZE = 22;
const BULLET_MARKER_SIZE = 18;
const NAME_SIZE = 36;
const HEADING_SIZE = 24;
const RESUME_MARGIN = 720;
const RESUME_PAGE_WIDTH = 12240;
const RESUME_CONTENT_WIDTH = RESUME_PAGE_WIDTH - RESUME_MARGIN * 2;
const RESUME_BULLET_REF = 'resume-bullets';
const MONTH_PATTERN =
  '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
const SEASON_PATTERN = '(?:Spring|Summer|Fall|Autumn|Winter)';
const DATE_QUALIFIER_PATTERN =
  '(?:(?:Expected|Anticipated|Graduating)(?:\\s+(?:Graduation|Completion))?\\s*:?\\s*)?';
const CALENDAR_DATE_PATTERN = `(?:(?:${MONTH_PATTERN}|${SEASON_PATTERN})\\s+)?(?:19|20)\\d{2}`;
const DATE_WITH_QUALIFIER_PATTERN = `${DATE_QUALIFIER_PATTERN}${CALENDAR_DATE_PATTERN}(?:\\s*\\((?:Expected|Anticipated)\\))?`;
const TRAILING_DATE_PATTERN = new RegExp(
  `^(.+?)\\s+(${DATE_WITH_QUALIFIER_PATTERN}(?:\\s*(?:[-–—]|to)\\s*(?:${DATE_WITH_QUALIFIER_PATTERN}|Present|Current|Now|Ongoing))?)$`,
  'i',
);

const resumeNumbering = {
  config: [
    {
      reference: RESUME_BULLET_REF,
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: '\u2022',
          alignment: AlignmentType.LEFT,
          style: {
            run: { font: FONT, size: BULLET_MARKER_SIZE },
            paragraph: { indent: { left: 720, hanging: 360 } },
          },
        },
      ],
    },
  ],
};

const bulletParagraphOptions = {
  numbering: { reference: RESUME_BULLET_REF, level: 0 },
} as const;

const resumeSectionProperties = {
  page: {
    margin: {
      top: RESUME_MARGIN,
      bottom: RESUME_MARGIN,
      left: RESUME_MARGIN,
      right: RESUME_MARGIN,
    },
  },
};

export type DocxReplacement = {
  original: string;
  tailored: string;
};

export type DocxInsertion = {
  afterOriginal: string;
  text: string;
};

const normalizeLine = (line: string): string =>
  line.replace(BULLET_MARKER, '').replace(/\s+/g, ' ').trim().toLowerCase();

export const normalizeResumeTextForComparison = (text: string): string =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

export const stripBulletMarker = (line: string): string => line.replace(BULLET_MARKER, '');

export const isBulletLine = (line: string): boolean => {
  const trimmed = line.trim();
  const stripped = stripBulletMarker(line).trim();
  return stripped !== trimmed && stripped.length > 0;
};

const paragraphText = (paragraph: Element): string =>
  Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 't'))
    .map((node) => node.textContent ?? '')
    .join('');

const hasNumbering = (paragraph: Element): boolean =>
  paragraph.getElementsByTagNameNS(WORD_NS, 'numPr').length > 0;

const setParagraphText = (paragraph: Element, text: string): void => {
  const textNodes = Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 't'));
  if (textNodes.length === 0) return;
  const dominantIndex = textNodes.reduce(
    (bestIndex, node, index) =>
      (node.textContent ?? '').length > (textNodes[bestIndex].textContent ?? '').length
        ? index
        : bestIndex,
    0,
  );
  textNodes.forEach((node, index) => {
    node.textContent = index === dominantIndex ? text : '';
    if (index === dominantIndex) node.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  });
};

const resolveInsertText = (rawText: string, template: Element): string => {
  const stripped = stripBulletMarker(rawText).trim();
  if (hasNumbering(template)) return stripped;
  const templateLine = paragraphText(template);
  const prefix = templateLine.slice(
    0,
    templateLine.length - stripBulletMarker(templateLine).length,
  );
  if (prefix.length > 0) return `${prefix}${stripped}`;
  if (isBulletLine(rawText)) return rawText.trim();
  return `- ${stripped}`;
};

const findBulletTemplate = (paragraphs: Element[], anchorIndex: number): Element => {
  for (let offset = 0; offset < paragraphs.length; offset += 1) {
    const candidates = [anchorIndex - offset, anchorIndex + offset].filter(
      (index) => index >= 0 && index < paragraphs.length,
    );
    for (const index of candidates) {
      const candidate = paragraphs[index];
      if (hasNumbering(candidate) || isBulletLine(paragraphText(candidate))) {
        return candidate;
      }
    }
  }
  return paragraphs[anchorIndex];
};

export const patchOriginalDocx = async (
  file: File,
  replacements: DocxReplacement[],
  insertions: DocxInsertion[] = [],
): Promise<Blob> => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) throw new Error('missing document.xml');

  const xmlText = await documentEntry.async('string');
  const parsed = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (parsed.getElementsByTagName('parsererror').length > 0) {
    throw new Error('could not parse document.xml');
  }

  const replacementMap = new Map<string, string>();
  replacements.forEach((replacement) => {
    const key = normalizeLine(replacement.original);
    if (key.length === 0) return;
    replacementMap.set(key, stripBulletMarker(replacement.tailored).trim());
  });

  const insertionsByAnchor = new Map<string, string[]>();
  insertions.forEach((insertion) => {
    const key = normalizeLine(insertion.afterOriginal);
    if (key.length === 0) return;
    const group = insertionsByAnchor.get(key);
    if (group) {
      group.push(insertion.text);
      return;
    }
    insertionsByAnchor.set(key, [insertion.text]);
  });

  let patchedCount = 0;
  let insertedCount = 0;
  const paragraphs = Array.from(parsed.getElementsByTagNameNS(WORD_NS, 'p'));
  const usedAnchors = new Set<string>();

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const textNodes = Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 't'));
    if (textNodes.length === 0) return;
    const currentText = paragraphText(paragraph);
    const normalized = normalizeLine(currentText);
    const tailored = replacementMap.get(normalized);
    if (tailored !== undefined) {
      if (tailored.length === 0) {
        paragraph.parentNode?.removeChild(paragraph);
        patchedCount += 1;
        return;
      }
      setParagraphText(paragraph, tailored);
      patchedCount += 1;
    }

    const textsToInsert = insertionsByAnchor.get(normalized);
    if (!textsToInsert || usedAnchors.has(normalized)) return;
    usedAnchors.add(normalized);

    const template = findBulletTemplate(paragraphs, paragraphIndex);
    let insertAfter: ChildNode = paragraph;
    textsToInsert.forEach((text) => {
      const clone = template.cloneNode(true) as Element;
      setParagraphText(clone, resolveInsertText(text, template));
      const parent = paragraph.parentNode;
      if (!parent) return;
      parent.insertBefore(clone, insertAfter.nextSibling);
      insertAfter = clone;
      insertedCount += 1;
    });
  });

  if (replacementMap.size > 0 && patchedCount === 0) {
    throw new Error('no matching paragraphs found');
  }
  if (replacementMap.size === 0 && insertions.length > 0 && insertedCount === 0) {
    throw new Error('no matching paragraphs found');
  }

  zip.file('word/document.xml', new XMLSerializer().serializeToString(parsed));
  return zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME });
};

const SECTION_NAMES = new Set([
  'summary',
  'profile',
  'objective',
  'about',
  'about me',
  'skills',
  'technical skills',
  'core competencies',
  'experience',
  'work experience',
  'professional experience',
  'employment history',
  'education',
  'projects',
  'certifications',
  'certificates',
  'awards',
  'publications',
  'volunteering',
  'volunteer experience',
  'languages',
  'interests',
]);

export const isHeadingLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 48) return false;
  if (isBulletLine(line)) return false;
  const withoutColon = trimmed.replace(/:$/, '');
  if (SECTION_NAMES.has(withoutColon.toLowerCase())) return true;
  if (!/[A-Z]/.test(trimmed) || trimmed !== trimmed.toUpperCase()) return false;
  if (trimmed.includes(',')) return false;
  const words = withoutColon.split(/\s+/).filter((word) => word.length > 0);
  return words.length > 0 && words.length <= 3;
};

type RunOptions = {
  font: string;
  size: number;
  bold?: boolean;
};

type SplitDateLine = {
  left: string;
  right: string;
};

const splitTrailingDate = (text: string): SplitDateLine | null => {
  const match = text.match(TRAILING_DATE_PATTERN);
  if (!match) return null;
  const left = match[1].trim();
  const right = match[2].trim();
  if (!left || !right) return null;
  return { left, right };
};

const textRuns = (texts: string[], options: RunOptions): TextRun[] => {
  const runs: TextRun[] = [];
  texts.forEach((text, index) => {
    if (index > 0) runs.push(new TextRun({ break: 1 }));
    runs.push(new TextRun({ text, ...options }));
  });
  return runs;
};

const dateAlignedTextRuns = (texts: string[], options: RunOptions): TextRun[] => {
  const runs: TextRun[] = [];
  texts.forEach((text, index) => {
    if (index > 0) runs.push(new TextRun({ break: 1 }));
    const splitDateLine = splitTrailingDate(text);
    if (!splitDateLine) {
      runs.push(new TextRun({ text, ...options }));
      return;
    }
    runs.push(
      new TextRun({ text: splitDateLine.left, ...options }),
      new TextRun({ children: [new Tab(), splitDateLine.right], ...options }),
    );
  });
  return runs;
};

const rightDateTabStop = {
  tabStops: [{ type: TabStopType.RIGHT, position: RESUME_CONTENT_WIDTH }],
} as const;

const buildParagraph = (line: string, index: number, previousBlank: boolean): Paragraph | null => {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  if (index === 0) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: trimmed, font: FONT, size: NAME_SIZE, bold: true })],
    });
  }

  if (isBulletLine(line)) {
    return new Paragraph({
      ...bulletParagraphOptions,
      spacing: { after: 40 },
      widowControl: true,
      children: [
        new TextRun({ text: stripBulletMarker(line).trim(), font: FONT, size: BODY_SIZE }),
      ],
    });
  }

  if (isHeadingLine(line)) {
    return new Paragraph({
      spacing: { before: 220, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, space: 2 } },
      keepNext: true,
      keepLines: true,
      children: [new TextRun({ text: trimmed, font: FONT, size: HEADING_SIZE, bold: true })],
    });
  }

  return new Paragraph({
    ...rightDateTabStop,
    spacing: { before: previousBlank ? 120 : 0, after: 40 },
    widowControl: true,
    children: dateAlignedTextRuns([trimmed], { font: FONT, size: BODY_SIZE }),
  });
};

export const buildTemplateDocx = async (resumeText: string): Promise<Blob> => {
  const lines = resumeText.split('\n');
  const paragraphs: Paragraph[] = [];
  let previousBlank = false;
  let contentIndex = 0;

  lines.forEach((line) => {
    if (line.trim().length === 0) {
      previousBlank = true;
      return;
    }
    const paragraph = buildParagraph(line, contentIndex, previousBlank);
    if (paragraph) paragraphs.push(paragraph);
    contentIndex += 1;
    previousBlank = false;
  });

  const document = new Document({
    numbering: resumeNumbering,
    sections: [{ properties: resumeSectionProperties, children: paragraphs }],
  });

  return Packer.toBlob(document);
};

const structuredLines = (lines: string[], lineIndexes: number[]): string[] =>
  lineIndexes
    .map((lineIndex) => stripBulletMarker(lines[lineIndex] ?? '').trim())
    .filter((text) => text.length > 0);

export const buildStructuredDocx = async (
  lines: string[],
  structure: ResumeStructure,
): Promise<Blob> => {
  const paragraphs: Paragraph[] = [];

  structure.headerLines.forEach((lineIndex, headerIndex) => {
    const texts = structuredLines(lines, [lineIndex]);
    if (texts.length === 0) return;
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: headerIndex === 0 ? 60 : 20 },
        children: textRuns(texts, {
          font: FONT,
          size: headerIndex === 0 ? NAME_SIZE : BODY_SIZE,
          bold: headerIndex === 0,
        }),
      }),
    );
  });

  structure.sections.forEach((section) => {
    if (section.headingLine !== null) {
      const headingTexts = structuredLines(lines, [section.headingLine]);
      if (headingTexts.length > 0) {
        paragraphs.push(
          new Paragraph({
            spacing: { before: 220, after: 80 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, space: 2 } },
            keepNext: true,
            keepLines: true,
            children: textRuns(headingTexts, { font: FONT, size: HEADING_SIZE, bold: true }),
          }),
        );
      }
    }

    section.items.forEach((item) => {
      const texts = structuredLines(lines, item.lines);
      if (texts.length === 0) return;
      if (item.kind === 'bullet') {
        paragraphs.push(
          new Paragraph({
            ...bulletParagraphOptions,
            spacing: { after: 40 },
            widowControl: true,
            children: textRuns(texts, { font: FONT, size: BODY_SIZE }),
          }),
        );
        return;
      }
      if (item.kind === 'subheading') {
        paragraphs.push(
          new Paragraph({
            ...rightDateTabStop,
            spacing: { before: 120, after: 40 },
            keepNext: true,
            keepLines: true,
            children: dateAlignedTextRuns(texts, {
              font: FONT,
              size: BODY_SIZE,
              bold: true,
            }),
          }),
        );
        return;
      }
      paragraphs.push(
        new Paragraph({
          ...rightDateTabStop,
          spacing: { after: 80 },
          widowControl: true,
          children: dateAlignedTextRuns(texts, { font: FONT, size: BODY_SIZE }),
        }),
      );
    });
  });

  const document = new Document({
    numbering: resumeNumbering,
    sections: [{ properties: resumeSectionProperties, children: paragraphs }],
  });

  return Packer.toBlob(document);
};

const LETTER_NAME_SIZE = 40;
const LETTER_META_SIZE = 20;
const LETTER_BODY_SIZE = 22;
const LETTER_LINE_SPACING = 320;

const letterBodyParagraph = (text: string, spacingAfter: number): Paragraph =>
  new Paragraph({
    spacing: { after: spacingAfter, line: LETTER_LINE_SPACING },
    children: [new TextRun({ text, font: FONT, size: LETTER_BODY_SIZE })],
  });

export const buildCoverLetterDocx = async (
  letter: string,
  candidateName: string,
  jobTitle: string,
  companyName: string,
): Promise<Blob> => {
  const paragraphs: Paragraph[] = [];
  const headerName = candidateName.trim();

  if (headerName.length > 0) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 8 } },
        children: [
          new TextRun({ text: headerName, font: FONT, size: LETTER_NAME_SIZE, bold: true }),
        ],
      }),
    );
  }

  const dateLine = formatCoverLetterDate();
  paragraphs.push(
    new Paragraph({
      spacing: { before: headerName.length > 0 ? 240 : 0, after: 0 },
      children: [new TextRun({ text: dateLine, font: FONT, size: LETTER_META_SIZE })],
    }),
  );

  const subjectLine = formatCoverLetterSubject(jobTitle, companyName);
  if (subjectLine) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: subjectLine,
            font: FONT,
            size: LETTER_META_SIZE,
            bold: true,
          }),
        ],
      }),
    );
  }

  const blocks = letter
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  blocks.forEach((block, blockIndex) => {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    lines.forEach((line, lineIndex) => {
      const isLastLineOfBlock = lineIndex === lines.length - 1;
      const isLastBlock = blockIndex === blocks.length - 1;
      paragraphs.push(letterBodyParagraph(line, isLastLineOfBlock && !isLastBlock ? 200 : 40));
    });
  });

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children: paragraphs,
      },
    ],
  });

  return Packer.toBlob(document);
};

export const downloadDocx = (blob: Blob, filename: string): void => {
  const typedBlob = blob.type === DOCX_MIME ? blob : new Blob([blob], { type: DOCX_MIME });
  const url = URL.createObjectURL(typedBlob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
};
