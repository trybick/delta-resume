import JSZip from 'jszip';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
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
  UnderlineType,
  WidthType,
} from 'docx';
import { formatCoverLetterDate, formatCoverLetterSubject } from './formatCoverLetter';
import { WORD_NS, type DocxCellRef, type DocxCleanLayout, type DocxTableInfo } from './docxLayout';
import { splitLinkSegments, type AnchorHrefs } from './resumeLinks';
import type { ResumeDocument } from './types';
import { entryDisplayDate, entryDisplayLeft } from './resumeModel';

const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const BULLET_MARKER = /^[\s\u00A0]*(?:[-–—•‣◦▪▫·∙●○*+>][\s\u00A0]*|\d{1,2}[.)][\s\u00A0]+)/;

const FONT = 'Arial';
const ACCENT_COLOR = '1F4E79';
const MUTED_COLOR = '595959';
const LINK_COLOR = '0563C1';
const RULE_COLOR = 'C9CED6';
export const RESUME_MARGIN = 720;
export const PAGE_WIDTH = 12240;
export const PAGE_HEIGHT = 15840;
const PAGE_SIZE = { width: PAGE_WIDTH, height: PAGE_HEIGHT } as const;
export const RESUME_CONTENT_WIDTH = PAGE_WIDTH - RESUME_MARGIN * 2;
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

// Font sizes are half-points, so scaled values are rounded to whole half-points
// (0.5pt granularity) to match what Word can actually represent.
const scaledHalfPoints = (base: number, scale: number): number =>
  Math.max(2, Math.round(base * scale));

const scaledTwips = (base: number, scale: number): number => Math.max(0, Math.round(base * scale));

export const EXPORT_SCALE_MIN = 0.75;
export const EXPORT_SCALE_MAX = 1.25;
export const EXPORT_SCALE_STEP = 0.05;
export const EXPORT_SCALE_DEFAULT = 1;

export const clampExportScale = (scale: number): number =>
  Math.min(EXPORT_SCALE_MAX, Math.max(EXPORT_SCALE_MIN, scale));

export type ResumeTheme = {
  scale: number;
  bodySize: number;
  bulletMarkerSize: number;
  nameSize: number;
  headingSize: number;
  contactSize: number;
  bulletIndent: number;
  nameAfter: number;
  contactAfter: number;
  bulletAfter: number;
  headingBefore: number;
  headingAfter: number;
  blockBefore: number;
  blockAfter: number;
  paragraphAfter: number;
};

export const createResumeTheme = (scale = EXPORT_SCALE_DEFAULT): ResumeTheme => {
  const clamped = clampExportScale(scale);
  return {
    scale: clamped,
    bodySize: scaledHalfPoints(19, clamped),
    bulletMarkerSize: scaledHalfPoints(16, clamped),
    nameSize: scaledHalfPoints(36, clamped),
    headingSize: scaledHalfPoints(20, clamped),
    contactSize: scaledHalfPoints(18, clamped),
    bulletIndent: scaledTwips(288, clamped),
    nameAfter: scaledTwips(60, clamped),
    contactAfter: scaledTwips(20, clamped),
    bulletAfter: scaledTwips(40, clamped),
    headingBefore: scaledTwips(260, clamped),
    headingAfter: scaledTwips(100, clamped),
    blockBefore: scaledTwips(120, clamped),
    blockAfter: scaledTwips(40, clamped),
    paragraphAfter: scaledTwips(80, clamped),
  };
};

const resumeNumbering = (theme: ResumeTheme) => ({
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
            run: { font: FONT, size: theme.bulletMarkerSize },
            paragraph: { indent: { left: theme.bulletIndent, hanging: theme.bulletIndent } },
          },
        },
      ],
    },
  ],
});

const bulletParagraphOptions = {
  numbering: { reference: RESUME_BULLET_REF, level: 0 },
} as const;

const resumeSectionProperties = {
  page: {
    size: PAGE_SIZE,
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

export const normalizeResumeLine = (line: string): string =>
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

export const paragraphText = (paragraph: Element): string =>
  Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 't'))
    .map((node) => node.textContent ?? '')
    .join('');

export const hasNumbering = (paragraph: Element): boolean =>
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

export const resolveInsertText = (rawText: string, template: Element): string => {
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

const RELATIONSHIPS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_RELATIONSHIPS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const HYPERLINK_RELATIONSHIP_TYPE = `${RELATIONSHIPS_NS}/hyperlink`;

const firstChildNamed = (element: Element, localName: string): Element | null =>
  Array.from(element.childNodes).find(
    (node): node is Element =>
      node.nodeType === 1 &&
      (node as Element).namespaceURI === WORD_NS &&
      (node as Element).localName === localName,
  ) ?? null;

const isInsideHyperlink = (run: Element): boolean => {
  let ancestor = run.parentElement;
  while (ancestor) {
    if (ancestor.namespaceURI === WORD_NS && ancestor.localName === 'hyperlink') return true;
    ancestor = ancestor.parentElement;
  }
  return false;
};

const applyLinkAppearance = (run: Element, document: XMLDocument): void => {
  let properties = firstChildNamed(run, 'rPr');
  if (!properties) {
    properties = document.createElementNS(WORD_NS, 'w:rPr');
    run.insertBefore(properties, run.firstChild);
  }
  ['color', 'u'].forEach((localName) => {
    Array.from(properties.getElementsByTagNameNS(WORD_NS, localName)).forEach((node) =>
      node.parentNode?.removeChild(node),
    );
  });
  const color = document.createElementNS(WORD_NS, 'w:color');
  color.setAttributeNS(WORD_NS, 'w:val', LINK_COLOR);
  const underline = document.createElementNS(WORD_NS, 'w:u');
  underline.setAttributeNS(WORD_NS, 'w:val', 'single');
  underline.setAttributeNS(WORD_NS, 'w:color', LINK_COLOR);
  properties.appendChild(color);
  properties.appendChild(underline);
};

const relationshipIdResolver = (relationships: XMLDocument | null) => {
  if (!relationships) return null;
  const root = relationships.documentElement;
  if (!root) return null;
  const existing = new Map<string, string>();
  const used = new Set<string>();
  Array.from(
    relationships.getElementsByTagNameNS(PACKAGE_RELATIONSHIPS_NS, 'Relationship'),
  ).forEach((relationship) => {
    const id = relationship.getAttribute('Id');
    if (id) used.add(id);
    const target = relationship.getAttribute('Target');
    if (
      id &&
      target &&
      relationship.getAttribute('Type') === HYPERLINK_RELATIONSHIP_TYPE &&
      relationship.getAttribute('TargetMode') === 'External'
    ) {
      existing.set(target, id);
    }
  });

  let counter = 0;
  return (href: string): string => {
    const found = existing.get(href);
    if (found) return found;
    counter += 1;
    let id = `rIdLink${counter}`;
    while (used.has(id)) {
      counter += 1;
      id = `rIdLink${counter}`;
    }
    used.add(id);
    const relationship = relationships.createElementNS(PACKAGE_RELATIONSHIPS_NS, 'Relationship');
    relationship.setAttribute('Id', id);
    relationship.setAttribute('Type', HYPERLINK_RELATIONSHIP_TYPE);
    relationship.setAttribute('Target', href);
    relationship.setAttribute('TargetMode', 'External');
    root.appendChild(relationship);
    existing.set(href, id);
    return id;
  };
};

// Splitting a run only stays faithful when its text is the run's whole payload,
// so runs carrying tabs or breaks alongside the text are left untouched.
const isSplittableTextRun = (run: Element, textNode: Element): boolean =>
  Array.from(run.childNodes).every(
    (node) =>
      node.nodeType !== 1 ||
      node === textNode ||
      ((node as Element).namespaceURI === WORD_NS && (node as Element).localName === 'rPr'),
  );

const setRunText = (run: Element, text: string): void => {
  const textNode = firstChildNamed(run, 't');
  if (!textNode) return;
  textNode.textContent = text;
  textNode.setAttributeNS(XML_NS, 'xml:space', 'preserve');
};

const linkifyDocument = (parsed: XMLDocument, relationships: XMLDocument | null): void => {
  Array.from(parsed.getElementsByTagNameNS(WORD_NS, 'hyperlink')).forEach((hyperlink) => {
    if (!hyperlink.getAttributeNS(RELATIONSHIPS_NS, 'id')) return;
    Array.from(hyperlink.getElementsByTagNameNS(WORD_NS, 'r')).forEach((run) =>
      applyLinkAppearance(run, parsed),
    );
  });

  const resolveRelationshipId = relationshipIdResolver(relationships);
  if (!resolveRelationshipId) return;

  Array.from(parsed.getElementsByTagNameNS(WORD_NS, 't')).forEach((textNode) => {
    const run = textNode.parentElement;
    if (!run || run.namespaceURI !== WORD_NS || run.localName !== 'r') return;
    if (isInsideHyperlink(run) || !isSplittableTextRun(run, textNode)) return;

    const segments = splitLinkSegments(textNode.textContent ?? '');
    if (!segments.some((segment) => segment.href !== null)) return;

    const parent = run.parentNode;
    if (!parent) return;
    segments.forEach((segment) => {
      const clone = run.cloneNode(true) as Element;
      setRunText(clone, segment.text);
      if (segment.href === null) {
        parent.insertBefore(clone, run);
        return;
      }
      applyLinkAppearance(clone, parsed);
      const hyperlink = parsed.createElementNS(WORD_NS, 'w:hyperlink');
      hyperlink.setAttributeNS(RELATIONSHIPS_NS, 'r:id', resolveRelationshipId(segment.href));
      hyperlink.appendChild(clone);
      parent.insertBefore(hyperlink, run);
    });
    parent.removeChild(run);
  });
};

const readRelationships = async (zip: JSZip): Promise<XMLDocument | null> => {
  const entry = zip.file('word/_rels/document.xml.rels');
  if (!entry) return null;
  const parsed = new DOMParser().parseFromString(await entry.async('string'), 'application/xml');
  if (parsed.getElementsByTagName('parsererror').length > 0) return null;
  return parsed;
};

export const findBulletTemplate = (paragraphs: Element[], anchorIndex: number): Element => {
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

const scaleNumericAttribute = (
  element: Element,
  localName: string,
  scale: number,
  minimum: number,
): void => {
  const raw = element.getAttributeNS(WORD_NS, localName);
  if (raw === null) return;
  const value = Number(raw);
  if (!Number.isFinite(value)) return;
  element.setAttributeNS(
    WORD_NS,
    `w:${localName}`,
    String(Math.max(minimum, Math.round(value * scale))),
  );
};

// Runs that carry no explicit w:sz inherit from styles.xml, so every part that can
// declare a size has to be scaled for the whole document to shrink evenly.
const scaleTypography = (root: XMLDocument, scale: number): void => {
  ['sz', 'szCs'].forEach((localName) => {
    Array.from(root.getElementsByTagNameNS(WORD_NS, localName)).forEach((node) => {
      if (node.parentElement?.localName !== 'rPr') return;
      scaleNumericAttribute(node, 'val', scale, 2);
    });
  });

  Array.from(root.getElementsByTagNameNS(WORD_NS, 'spacing')).forEach((node) => {
    if (node.parentElement?.localName !== 'pPr') return;
    scaleNumericAttribute(node, 'before', scale, 0);
    scaleNumericAttribute(node, 'after', scale, 0);
    // w:line is a twip measurement only for exact/atLeast; under the default auto
    // rule it is a 240ths-of-a-line multiplier that must be left alone.
    const lineRule = node.getAttributeNS(WORD_NS, 'lineRule');
    if (lineRule === 'exact' || lineRule === 'atLeast') {
      scaleNumericAttribute(node, 'line', scale, 0);
    }
  });

  Array.from(root.getElementsByTagNameNS(WORD_NS, 'trHeight')).forEach((node) =>
    scaleNumericAttribute(node, 'val', scale, 0),
  );
};

const SCALABLE_PART_PATTERN = /^word\/(styles|numbering|header\d*|footer\d*)\.xml$/;

const scaleSupportingParts = async (zip: JSZip, scale: number): Promise<void> => {
  const names = Object.keys(zip.files).filter((name) => SCALABLE_PART_PATTERN.test(name));
  await Promise.all(
    names.map(async (name) => {
      const entry = zip.file(name);
      if (!entry) return;
      const parsedPart = new DOMParser().parseFromString(
        await entry.async('string'),
        'application/xml',
      );
      if (parsedPart.getElementsByTagName('parsererror').length > 0) return;
      scaleTypography(parsedPart, scale);
      zip.file(name, new XMLSerializer().serializeToString(parsedPart));
    }),
  );
};

export const patchOriginalDocx = async (
  file: File,
  replacements: DocxReplacement[],
  insertions: DocxInsertion[] = [],
  scale = EXPORT_SCALE_DEFAULT,
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
    const key = normalizeResumeLine(replacement.original);
    if (key.length === 0) return;
    replacementMap.set(key, stripBulletMarker(replacement.tailored).trim());
  });

  const insertionsByAnchor = new Map<string, string[]>();
  insertions.forEach((insertion) => {
    const key = normalizeResumeLine(insertion.afterOriginal);
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
    const normalized = normalizeResumeLine(currentText);
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

  // Linking is a bonus on top of a patch that already succeeded, so a failure
  // here must not cost the user their preserved formatting.
  const relationships = await readRelationships(zip);
  try {
    linkifyDocument(parsed, relationships);
    if (relationships) {
      zip.file(
        'word/_rels/document.xml.rels',
        new XMLSerializer().serializeToString(relationships),
      );
    }
  } catch {
    /* keep the patched document as-is */
  }

  const clampedScale = clampExportScale(scale);
  if (clampedScale !== 1) {
    scaleTypography(parsed, clampedScale);
    await scaleSupportingParts(zip, clampedScale);
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

type ResumeRun = TextRun | ExternalHyperlink;

const linkedRuns = (text: string, options: RunOptions, anchorHrefs?: AnchorHrefs): ResumeRun[] =>
  splitLinkSegments(text, anchorHrefs).map((segment) =>
    segment.href === null
      ? new TextRun({ text: segment.text, ...options })
      : new ExternalHyperlink({
          link: segment.href,
          children: [
            new TextRun({
              text: segment.text,
              ...options,
              color: LINK_COLOR,
              underline: { type: UnderlineType.SINGLE, color: LINK_COLOR },
            }),
          ],
        }),
  );

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

const labelledTextRuns = (
  texts: string[],
  options: RunOptions,
  anchorHrefs?: AnchorHrefs,
): ResumeRun[] => {
  const runs: ResumeRun[] = [];
  texts.forEach((text, index) => {
    if (index > 0) runs.push(new TextRun({ break: 1 }));
    const splitLabelLine = splitLeadingLabel(text);
    if (!splitLabelLine) {
      runs.push(...linkedRuns(text, options, anchorHrefs));
      return;
    }
    runs.push(
      new TextRun({ text: `${splitLabelLine.label}: `, ...options, bold: true }),
      ...linkedRuns(splitLabelLine.rest, options, anchorHrefs),
    );
  });
  return runs;
};

const headingParagraph = (texts: string[], theme: ResumeTheme): Paragraph =>
  new Paragraph({
    spacing: { before: theme.headingBefore, after: theme.headingAfter },
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
          size: theme.headingSize,
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

const dateAlignedTextRuns = (
  texts: string[],
  options: RunOptions,
  anchorHrefs?: AnchorHrefs,
): ResumeRun[] => {
  const runs: ResumeRun[] = [];
  texts.forEach((text, index) => {
    if (index > 0) runs.push(new TextRun({ break: 1 }));
    const splitDateLine = splitTrailingDate(text);
    if (!splitDateLine) {
      runs.push(...labelledTextRuns([text], options, anchorHrefs));
      return;
    }
    runs.push(
      ...linkedRuns(splitDateLine.left, options, anchorHrefs),
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

export const DATE_CELL_WIDTH = 3600;
export const TITLE_CELL_WIDTH = RESUME_CONTENT_WIDTH - DATE_CELL_WIDTH;

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

export const LAYOUT_CELL_GUTTER = 160;

const layoutCellMargins = { top: 0, bottom: 0, left: 0, right: LAYOUT_CELL_GUTTER } as const;

// A resume built entirely inside one layout table should keep flattening to a
// single column; rebuilding it would turn the clean template back into the
// original grid we are trying to normalise away.
export const MAX_TABLE_SHARE_OF_DOCUMENT = 0.8;

export const distributeColumnWidths = (
  columnWidths: number[] | null,
  columnCount: number,
  totalWidth: number,
): number[] => {
  const total = columnWidths?.reduce((sum, width) => sum + width, 0) ?? 0;
  if (!columnWidths || columnWidths.length !== columnCount || total <= 0) {
    return Array.from({ length: columnCount }, () => totalWidth / columnCount);
  }
  return columnWidths.map((width) => (width / total) * totalWidth);
};

const scaleColumnWidths = (columnWidths: number[] | null, columnCount: number): number[] => {
  const scaled = distributeColumnWidths(columnWidths, columnCount, RESUME_CONTENT_WIDTH).map(
    (width) => Math.floor(width),
  );
  scaled[scaled.length - 1] += RESUME_CONTENT_WIDTH - scaled.reduce((sum, w) => sum + w, 0);
  return scaled;
};

type DateLineLayout = {
  spacingBefore?: number;
  spacingAfter: number;
  keepNext?: boolean;
};

const dateLineTable = (
  splitDateLine: SplitDateLine,
  options: RunOptions,
  layout: DateLineLayout,
  anchorHrefs?: AnchorHrefs,
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
                children: linkedRuns(splitDateLine.left, options, anchorHrefs),
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
  theme: ResumeTheme,
  anchorHrefs?: AnchorHrefs,
): Paragraph | Table | null => {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  if (index === 0) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: theme.nameAfter },
      children: [new TextRun({ text: trimmed, font: FONT, size: theme.nameSize, bold: true })],
    });
  }

  if (index <= 3 && isContactLine(trimmed) && !isBulletLine(line)) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: theme.contactAfter },
      children: linkedRuns(
        trimmed,
        { font: FONT, size: theme.contactSize, color: MUTED_COLOR },
        anchorHrefs,
      ),
    });
  }

  if (isBulletLine(line)) {
    return new Paragraph({
      ...bulletParagraphOptions,
      spacing: { after: theme.bulletAfter },
      widowControl: true,
      children: labelledTextRuns(
        [stripBulletMarker(line).trim()],
        { font: FONT, size: theme.bodySize },
        anchorHrefs,
      ),
    });
  }

  if (isHeadingLine(line)) {
    return headingParagraph([trimmed], theme);
  }

  const splitDateLine = splitTrailingDate(trimmed);
  if (splitDateLine) {
    return dateLineTable(
      splitDateLine,
      { font: FONT, size: theme.bodySize },
      { spacingBefore: previousBlank ? theme.blockBefore : 0, spacingAfter: theme.blockAfter },
      anchorHrefs,
    );
  }

  return new Paragraph({
    ...rightDateTabStop,
    spacing: {
      before: previousBlank ? theme.blockBefore : 0,
      after: theme.blockAfter,
    },
    widowControl: true,
    children: dateAlignedTextRuns([trimmed], { font: FONT, size: theme.bodySize }, anchorHrefs),
  });
};

export const buildTemplateDocx = async (
  resumeText: string,
  layout?: DocxCleanLayout | null,
  scale = EXPORT_SCALE_DEFAULT,
): Promise<Blob> => {
  const theme = createResumeTheme(scale);
  const anchorHrefs = layout?.hrefByAnchorText;
  const lines = resumeText.split('\n');
  const paragraphs: (Paragraph | Table)[] = [];
  let previousBlank = false;
  let contentIndex = 0;

  lines.forEach((line) => {
    if (line.trim().length === 0) {
      previousBlank = true;
      return;
    }
    const paragraph = buildParagraph(line, contentIndex, previousBlank, theme, anchorHrefs);
    if (paragraph) paragraphs.push(paragraph);
    contentIndex += 1;
    previousBlank = false;
  });

  const document = new Document({
    numbering: resumeNumbering(theme),
    sections: [{ properties: resumeSectionProperties, children: paragraphs }],
  });

  return Packer.toBlob(document);
};

type RenderedItem = {
  cell: DocxCellRef | null;
  // True when one block swallowed lines from several cells, which means the
  // grid cannot be rebuilt faithfully and the whole table should stay flat.
  spansCells: boolean;
  element: Paragraph | Table;
};

// Word requires a table cell (and the document body) to end with a paragraph.
const closedWithParagraph = (elements: (Paragraph | Table)[]): (Paragraph | Table)[] =>
  elements.length > 0 && !(elements[elements.length - 1] instanceof Table)
    ? elements
    : [...elements, new Paragraph({})];

const layoutTable = (
  items: RenderedItem[],
  columnCount: number,
  columnWidths: number[] | null,
): Table => {
  const widths = scaleColumnWidths(columnWidths, columnCount);
  const cellOf = (item: RenderedItem) => item.cell as DocxCellRef;
  const rowIndexes = [...new Set(items.map((item) => cellOf(item).rowIndex))].sort(
    (left, right) => left - right,
  );

  return new Table({
    width: { size: RESUME_CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: invisibleTableBorders,
    rows: rowIndexes.map(
      (rowIndex) =>
        new TableRow({
          children: widths.map((width, columnIndex) => {
            const children = items
              .filter(
                (item) =>
                  cellOf(item).rowIndex === rowIndex && cellOf(item).columnIndex === columnIndex,
              )
              .map((item) => item.element);
            return new TableCell({
              width: { size: width, type: WidthType.DXA },
              margins: layoutCellMargins,
              children: closedWithParagraph(children),
            });
          }),
        }),
    ),
  });
};

export const groupByTableRun = <T extends { cell: DocxCellRef | null }>(items: T[]): T[][] => {
  const groups: T[][] = [];
  items.forEach((item) => {
    const current = groups[groups.length - 1];
    const currentTableIndex = current?.[0].cell?.tableIndex ?? null;
    if (current && currentTableIndex === (item.cell?.tableIndex ?? null)) {
      current.push(item);
      return;
    }
    groups.push([item]);
  });
  return groups;
};

const restoreTables = (items: RenderedItem[], tables: DocxTableInfo[]): (Paragraph | Table)[] =>
  groupByTableRun(items).flatMap((group) => {
    const cell = group[0].cell;
    const elements = group.map((item) => item.element);
    if (!cell) return elements;
    const info = tables[cell.tableIndex];
    const columnCount = info?.columnCount ?? cell.columnCount;
    if (
      columnCount < 2 ||
      group.some((item) => item.spansCells) ||
      group.length > items.length * MAX_TABLE_SHARE_OF_DOCUMENT
    ) {
      return elements;
    }
    return [layoutTable(group, columnCount, info?.columnWidths ?? null)];
  });

export const buildDocumentDocx = async (
  resumeDocument: ResumeDocument,
  textsByNodeId: Map<string, string>,
  layout?: DocxCleanLayout | null,
  scale = EXPORT_SCALE_DEFAULT,
): Promise<Blob> => {
  const theme = createResumeTheme(scale);
  const anchorHrefs = layout?.hrefByAnchorText;
  const items: RenderedItem[] = [];
  const textOf = (nodeId: string): string => textsByNodeId.get(nodeId)?.trim() ?? '';

  // Bullets added for requirement gaps have no source lines, so they stay in
  // whichever cell the block they were anchored to came from.
  let lastCell: DocxCellRef | null = null;
  const placementFor = (sourceLines: number[]) => {
    if (sourceLines.length === 0) return { cell: lastCell, spansCells: false };
    const cells = sourceLines.map((lineIndex) => layout?.cellRefsByLine.get(lineIndex) ?? null);
    const distinct = new Set(
      cells.map((cell) =>
        cell ? `${cell.tableIndex}:${cell.rowIndex}:${cell.columnIndex}` : 'none',
      ),
    );
    lastCell = cells.find((cell) => cell !== undefined && cell !== null) ?? null;
    return { cell: lastCell, spansCells: distinct.size > 1 };
  };

  const push = (sourceLines: number[], element: Paragraph | Table) => {
    items.push({ ...placementFor(sourceLines), element });
  };

  const wasBold = (sourceLines: number[]): boolean =>
    sourceLines.length > 0 && sourceLines.every((lineIndex) => layout?.boldLines.has(lineIndex));

  const bulletParagraph = (text: string): Paragraph =>
    new Paragraph({
      ...bulletParagraphOptions,
      spacing: { after: theme.bulletAfter },
      widowControl: true,
      children: labelledTextRuns([text], { font: FONT, size: theme.bodySize }, anchorHrefs),
    });

  const nameText = textOf(resumeDocument.header.name.id);
  if (nameText) {
    push(
      resumeDocument.header.name.sourceLines,
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: theme.nameAfter },
        children: [new TextRun({ text: nameText, font: FONT, size: theme.nameSize, bold: true })],
      }),
    );
  }

  resumeDocument.header.contact.forEach((item) => {
    const text = textOf(item.id);
    if (!text) return;
    push(
      item.sourceLines,
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: theme.contactAfter },
        children: linkedRuns(
          text,
          { font: FONT, size: theme.contactSize, color: MUTED_COLOR },
          anchorHrefs,
        ),
      }),
    );
  });

  resumeDocument.sections.forEach((section) => {
    if (section.heading) {
      const headingText = textOf(section.heading.id);
      if (headingText) push(section.heading.sourceLines, headingParagraph([headingText], theme));
    }

    section.blocks.forEach((block) => {
      if (block.kind === 'entry') {
        const left = entryDisplayLeft(block) || textOf(block.id);
        const dateText = entryDisplayDate(block);
        if (left && dateText) {
          push(
            block.headingSourceLines,
            dateLineTable(
              { left, right: dateText },
              { font: FONT, size: theme.bodySize, bold: true },
              {
                spacingBefore: theme.blockBefore,
                spacingAfter: theme.blockAfter,
                keepNext: true,
              },
              anchorHrefs,
            ),
          );
        } else if (left || dateText) {
          push(
            block.headingSourceLines,
            new Paragraph({
              spacing: { before: theme.blockBefore, after: theme.blockAfter },
              keepNext: true,
              keepLines: true,
              children: linkedRuns(
                left || dateText || '',
                { font: FONT, size: theme.bodySize, bold: true },
                anchorHrefs,
              ),
            }),
          );
        }
        block.bullets.forEach((bullet) => {
          const text = stripBulletMarker(textOf(bullet.id)).trim();
          if (!text) return;
          push(bullet.sourceLines, bulletParagraph(text));
        });
        return;
      }

      if (block.kind === 'bullet') {
        const text = stripBulletMarker(textOf(block.id)).trim();
        if (!text) return;
        push(block.sourceLines, bulletParagraph(text));
        return;
      }

      const text = textOf(block.id);
      if (!text) return;
      push(
        block.sourceLines,
        new Paragraph({
          spacing: {
            after: block.kind === 'skillsGroup' ? theme.blockAfter : theme.paragraphAfter,
          },
          widowControl: true,
          children: labelledTextRuns(
            [text],
            { font: FONT, size: theme.bodySize, bold: wasBold(block.sourceLines) },
            anchorHrefs,
          ),
        }),
      );
    });
  });

  const document = new Document({
    numbering: resumeNumbering(theme),
    sections: [
      {
        properties: resumeSectionProperties,
        children: closedWithParagraph(restoreTables(items, layout?.tables ?? [])),
      },
    ],
  });

  return Packer.toBlob(document);
};

const LETTER_NAME_SIZE = 34;
const LETTER_META_SIZE = 18;
const LETTER_BODY_SIZE = 20;
const LETTER_LINE_SPACING = 290;
const LETTER_MARGIN = 1440;

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
            size: PAGE_SIZE,
            margin: {
              top: LETTER_MARGIN,
              bottom: LETTER_MARGIN,
              left: LETTER_MARGIN,
              right: LETTER_MARGIN,
            },
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
