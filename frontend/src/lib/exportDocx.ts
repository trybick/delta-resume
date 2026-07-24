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
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { formatCoverLetterDate, formatCoverLetterSubject } from './formatCoverLetter';
import type { ResumeDocument } from './types';
import { entryDisplayDate, entryDisplayLeft } from './resumeModel';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const BULLET_MARKER = /^[\s\u00A0]*(?:[-–—•‣◦▪▫·∙●○*+>][\s\u00A0]*|\d{1,2}[.)][\s\u00A0]+)/;

const FONT = 'Arial';
const BODY_SIZE = 22;
const BULLET_MARKER_SIZE = 18;
const NAME_SIZE = 40;
const HEADING_SIZE = 22;
const CONTACT_SIZE = 20;
const ACCENT_COLOR = '1F4E79';
const MUTED_COLOR = '595959';
const RULE_COLOR = 'C9CED6';
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
  color?: string;
};

const LEADING_LABEL_PATTERN = /^([^:.]{2,40}):\s+(.+)$/;

type SplitLabelLine = {
  label: string;
  rest: string;
};

const splitLeadingLabel = (text: string): SplitLabelLine | null => {
  const match = text.match(LEADING_LABEL_PATTERN);
  if (!match) return null;
  const label = match[1].trim();
  const rest = match[2].trim();
  if (!label || !rest) return null;
  const words = label.split(/\s+/);
  if (words.length > 4) return null;
  return { label, rest };
};

const labelledTextRuns = (texts: string[], options: RunOptions): TextRun[] => {
  const runs: TextRun[] = [];
  texts.forEach((text, index) => {
    if (index > 0) runs.push(new TextRun({ break: 1 }));
    const splitLabelLine = splitLeadingLabel(text);
    if (!splitLabelLine) {
      runs.push(new TextRun({ text, ...options }));
      return;
    }
    runs.push(
      new TextRun({ text: `${splitLabelLine.label}: `, ...options, bold: true }),
      new TextRun({ text: splitLabelLine.rest, ...options }),
    );
  });
  return runs;
};

const headingParagraph = (texts: string[]): Paragraph =>
  new Paragraph({
    spacing: { before: 260, after: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, space: 3, color: RULE_COLOR },
    },
    keepNext: true,
    keepLines: true,
    children: texts.flatMap((text, index) => {
      const runs: TextRun[] = [];
      if (index > 0) runs.push(new TextRun({ break: 1 }));
      runs.push(
        new TextRun({
          text,
          font: FONT,
          size: HEADING_SIZE,
          bold: true,
          allCaps: true,
          characterSpacing: 16,
          color: ACCENT_COLOR,
        }),
      );
      return runs;
    }),
  });

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

const dateAlignedTextRuns = (texts: string[], options: RunOptions): TextRun[] => {
  const runs: TextRun[] = [];
  texts.forEach((text, index) => {
    if (index > 0) runs.push(new TextRun({ break: 1 }));
    const splitDateLine = splitTrailingDate(text);
    if (!splitDateLine) {
      if (!options.bold) {
        runs.push(...labelledTextRuns([text], options));
        return;
      }
      runs.push(new TextRun({ text, ...options }));
      return;
    }
    runs.push(
      new TextRun({ text: splitDateLine.left, ...options }),
      new TextRun({
        children: [new Tab(), splitDateLine.right.replace(/ /g, '\u00A0')],
        ...options,
        bold: false,
        italics: true,
        color: MUTED_COLOR,
      }),
    );
  });
  return runs;
};

const rightDateTabStop = {
  tabStops: [{ type: TabStopType.RIGHT, position: RESUME_CONTENT_WIDTH }],
} as const;

const DATE_CELL_WIDTH = 3600;
const TITLE_CELL_WIDTH = RESUME_CONTENT_WIDTH - DATE_CELL_WIDTH;

const invisibleBorder = { style: BorderStyle.NONE, size: 0, color: 'auto' } as const;

const invisibleTableBorders = {
  top: invisibleBorder,
  bottom: invisibleBorder,
  left: invisibleBorder,
  right: invisibleBorder,
  insideHorizontal: invisibleBorder,
  insideVertical: invisibleBorder,
} as const;

const zeroCellMargins = { top: 0, bottom: 0, left: 0, right: 0 } as const;

type DateLineLayout = {
  spacingBefore?: number;
  spacingAfter: number;
  keepNext?: boolean;
};

const dateLineTable = (
  splitDateLine: SplitDateLine,
  options: RunOptions,
  layout: DateLineLayout,
): Table => {
  const spacing = { before: layout.spacingBefore ?? 0, after: layout.spacingAfter };
  return new Table({
    width: { size: RESUME_CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [TITLE_CELL_WIDTH, DATE_CELL_WIDTH],
    layout: TableLayoutType.FIXED,
    borders: invisibleTableBorders,
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: TITLE_CELL_WIDTH, type: WidthType.DXA },
            margins: zeroCellMargins,
            children: [
              new Paragraph({
                spacing,
                keepNext: layout.keepNext,
                keepLines: layout.keepNext,
                children: [new TextRun({ text: splitDateLine.left, ...options })],
              }),
            ],
          }),
          new TableCell({
            width: { size: DATE_CELL_WIDTH, type: WidthType.DXA },
            margins: zeroCellMargins,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing,
                keepNext: layout.keepNext,
                keepLines: layout.keepNext,
                children: [
                  new TextRun({
                    text: splitDateLine.right,
                    ...options,
                    bold: false,
                    italics: true,
                    color: MUTED_COLOR,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};

const CONTACT_LINE_PATTERN = /@|\bwww\.|https?:|linkedin|github|(?:\d[\s().-]*){7,}/i;

const isContactLine = (line: string): boolean => CONTACT_LINE_PATTERN.test(line);

const buildParagraph = (
  line: string,
  index: number,
  previousBlank: boolean,
): Paragraph | Table | null => {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  if (index === 0) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: trimmed, font: FONT, size: NAME_SIZE, bold: true })],
    });
  }

  if (index <= 3 && isContactLine(trimmed) && !isBulletLine(line)) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [
        new TextRun({ text: trimmed, font: FONT, size: CONTACT_SIZE, color: MUTED_COLOR }),
      ],
    });
  }

  if (isBulletLine(line)) {
    return new Paragraph({
      ...bulletParagraphOptions,
      spacing: { after: 40 },
      widowControl: true,
      children: labelledTextRuns([stripBulletMarker(line).trim()], {
        font: FONT,
        size: BODY_SIZE,
      }),
    });
  }

  if (isHeadingLine(line)) {
    return headingParagraph([trimmed]);
  }

  const splitDateLine = splitTrailingDate(trimmed);
  if (splitDateLine) {
    return dateLineTable(
      splitDateLine,
      { font: FONT, size: BODY_SIZE },
      { spacingBefore: previousBlank ? 120 : 0, spacingAfter: 40 },
    );
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
  const paragraphs: (Paragraph | Table)[] = [];
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

export const buildDocumentDocx = async (
  resumeDocument: ResumeDocument,
  textsByNodeId: Map<string, string>,
): Promise<Blob> => {
  const paragraphs: (Paragraph | Table)[] = [];
  const textOf = (nodeId: string): string => textsByNodeId.get(nodeId)?.trim() ?? '';

  const nameText = textOf(resumeDocument.header.name.id);
  if (nameText) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: nameText, font: FONT, size: NAME_SIZE, bold: true })],
      }),
    );
  }

  resumeDocument.header.contact.forEach((item) => {
    const text = textOf(item.id);
    if (!text) return;
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
        children: [new TextRun({ text, font: FONT, size: CONTACT_SIZE, color: MUTED_COLOR })],
      }),
    );
  });

  resumeDocument.sections.forEach((section) => {
    if (section.heading) {
      const headingText = textOf(section.heading.id);
      if (headingText) paragraphs.push(headingParagraph([headingText]));
    }

    section.blocks.forEach((block) => {
      if (block.kind === 'entry') {
        const left = entryDisplayLeft(block) || textOf(block.id);
        const dateText = entryDisplayDate(block);
        if (left || dateText) {
          if (left && dateText) {
            paragraphs.push(
              dateLineTable(
                { left, right: dateText },
                { font: FONT, size: BODY_SIZE, bold: true },
                { spacingBefore: 120, spacingAfter: 40, keepNext: true },
              ),
            );
          } else {
            paragraphs.push(
              new Paragraph({
                spacing: { before: 120, after: 40 },
                keepNext: true,
                keepLines: true,
                children: [
                  new TextRun({
                    text: left || dateText || '',
                    font: FONT,
                    size: BODY_SIZE,
                    bold: true,
                  }),
                ],
              }),
            );
          }
        }
        block.bullets.forEach((bullet) => {
          const text = stripBulletMarker(textOf(bullet.id)).trim();
          if (!text) return;
          paragraphs.push(
            new Paragraph({
              ...bulletParagraphOptions,
              spacing: { after: 40 },
              widowControl: true,
              children: labelledTextRuns([text], { font: FONT, size: BODY_SIZE }),
            }),
          );
        });
        return;
      }

      if (block.kind === 'bullet') {
        const text = stripBulletMarker(textOf(block.id)).trim();
        if (!text) return;
        paragraphs.push(
          new Paragraph({
            ...bulletParagraphOptions,
            spacing: { after: 40 },
            widowControl: true,
            children: labelledTextRuns([text], { font: FONT, size: BODY_SIZE }),
          }),
        );
        return;
      }

      if (block.kind === 'skillsGroup') {
        const text = textOf(block.id);
        if (!text) return;
        paragraphs.push(
          new Paragraph({
            spacing: { after: 40 },
            widowControl: true,
            children: labelledTextRuns([text], { font: FONT, size: BODY_SIZE }),
          }),
        );
        return;
      }

      const text = textOf(block.id);
      if (!text) return;
      paragraphs.push(
        new Paragraph({
          spacing: { after: 80 },
          widowControl: true,
          children: labelledTextRuns([text], { font: FONT, size: BODY_SIZE }),
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
