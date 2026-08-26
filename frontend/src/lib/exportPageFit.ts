import JSZip from 'jszip';
import {
  EXPORT_SCALE_DEFAULT,
  EXPORT_SCALE_MAX,
  EXPORT_SCALE_MIN,
  LAYOUT_CELL_GUTTER,
  MAX_TABLE_SHARE_OF_DOCUMENT,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  RESUME_CONTENT_WIDTH,
  RESUME_MARGIN,
  TITLE_CELL_WIDTH,
  clampExportScale,
  createResumeTheme,
  distributeColumnWidths,
  findBulletTemplate,
  groupByTableRun,
  isBulletLine,
  isHeadingLine,
  normalizeResumeLine,
  paragraphText,
  resolveInsertText,
  stripBulletMarker,
  type DocxInsertion,
  type DocxReplacement,
  type ResumeTheme,
} from './exportDocx';
import { WORD_NS, type DocxCellRef, type DocxCleanLayout } from './docxLayout';
import { entryDisplayDate, entryDisplayLeft } from './resumeModel';
import type { ResumeDocument } from './types';

const FONT = 'Arial';
const MEASURE_FONT_PX = 100;
const FALLBACK_CHAR_WIDTH_RATIO = 0.5;
const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.17;

// Ascent + descent + line gap per em, which is the single line height Word and
// LibreOffice lay out with.
const LINE_HEIGHT_BY_FONT: Record<string, number> = {
  arial: 1.15,
  helvetica: 1.15,
  'liberation sans': 1.15,
  calibri: 1.22,
  carlito: 1.22,
  cambria: 1.17,
  'times new roman': 1.15,
  georgia: 1.14,
  verdana: 1.22,
};

const lineHeightMultiplier = (family: string): number =>
  LINE_HEIGHT_BY_FONT[family.trim().toLowerCase()] ?? DEFAULT_LINE_HEIGHT_MULTIPLIER;
const HEADING_RULE_PT = 4;
const KEEP_FIT_SAFETY_MARGIN_PT = 1;
const CLEAN_OVERFLOW_TOLERANCE_PT = 11;
const MIN_BLOCK_WIDTH_PT = 20;
const DEFAULT_BODY_HALF_POINTS = 22;
const MIN_HALF_POINTS = 2;
const TWIPS_PER_AUTO_LINE = 240;
const DEFAULT_CELL_MARGIN_TWIPS = 108;

const twipsToPt = (twips: number): number => twips / 20;

const halfPointsToPt = (halfPoints: number): number => halfPoints / 2;

const scaleHalfPoints = (halfPoints: number, scale: number): number =>
  Math.max(MIN_HALF_POINTS, Math.round(halfPoints * scale));

const scaleTwips = (twips: number, scale: number): number => Math.max(0, Math.round(twips * scale));

const CLEAN_CONTENT_HEIGHT_PT = twipsToPt(PAGE_HEIGHT - RESUME_MARGIN * 2);
const CLEAN_CONTENT_WIDTH_PT = twipsToPt(RESUME_CONTENT_WIDTH);
const CLEAN_TITLE_WIDTH_PT = twipsToPt(TITLE_CELL_WIDTH);
const CLEAN_CELL_GUTTER_PT = twipsToPt(LAYOUT_CELL_GUTTER);

type FlowBlock = {
  text: string;
  bold: boolean;
  fontFamily: string;
  fontPt: number;
  lineHeightPt: number;
  widthPt: number;
  beforePt: number;
  afterPt: number;
  extraPt: number;
};

type FlowRow = {
  columns: FlowSegment[][];
};

type FlowSegment = { kind: 'blocks'; blocks: FlowBlock[] } | { kind: 'table'; rows: FlowRow[] };

type FlowSection = {
  columnCount: number;
  segments: FlowSegment[];
};

type FlowPage = {
  contentHeightPt: number;
  sections: FlowSection[];
};

let measureContext: CanvasRenderingContext2D | null | undefined;

const canvasContext = (): CanvasRenderingContext2D | null => {
  if (measureContext !== undefined) return measureContext;
  measureContext =
    typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  return measureContext;
};

const referenceWidths = new Map<string, number>();

// Words are measured once at a large reference size and scaled down, so wrapping
// stays consistent across scales instead of drifting with font hinting.
const referenceWordWidth = (word: string, bold: boolean, family: string): number => {
  const key = `${family}\u0000${bold ? 'b' : 'n'}\u0000${word}`;
  const cached = referenceWidths.get(key);
  if (cached !== undefined) return cached;

  const context = canvasContext();
  const width = context
    ? measureWithContext(context, word, bold, family)
    : word.length * MEASURE_FONT_PX * FALLBACK_CHAR_WIDTH_RATIO;
  referenceWidths.set(key, width);
  return width;
};

const measureWithContext = (
  context: CanvasRenderingContext2D,
  word: string,
  bold: boolean,
  family: string,
): number => {
  // A font-family list makes Chrome's canvas report the wrong metrics, so the
  // declared family is applied on its own and the browser handles fallback.
  context.font = `${bold ? 'bold' : 'normal'} ${MEASURE_FONT_PX}px "${family}"`;
  return context.measureText(word).width;
};

const countWrappedLines = (block: FlowBlock): number => {
  const words = block.text.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return 1;

  const pointsPerReferenceUnit = block.fontPt / MEASURE_FONT_PX;
  const spacePt = referenceWordWidth(' ', block.bold, block.fontFamily) * pointsPerReferenceUnit;
  const availablePt = Math.max(block.widthPt, 1);
  let lines = 1;
  let usedPt = 0;

  words.forEach((word) => {
    const wordPt = referenceWordWidth(word, block.bold, block.fontFamily) * pointsPerReferenceUnit;
    if (usedPt === 0) {
      usedPt = wordPt;
      return;
    }
    const candidatePt = usedPt + spacePt + wordPt;
    if (candidatePt <= availablePt) {
      usedPt = candidatePt;
      return;
    }
    lines += 1;
    usedPt = wordPt;
  });

  return lines;
};

const blockHeight = (block: FlowBlock): number =>
  block.beforePt + countWrappedLines(block) * block.lineHeightPt + block.afterPt + block.extraPt;

const rowHeight = (row: FlowRow): number =>
  Math.max(0, ...row.columns.map((column) => column.reduce(addSegmentHeight, 0)));

const addSegmentHeight = (total: number, segment: FlowSegment): number =>
  total +
  (segment.kind === 'blocks'
    ? segment.blocks.reduce((sum, block) => sum + blockHeight(block), 0)
    : segment.rows.reduce((sum, row) => sum + rowHeight(row), 0));

const keepLimitPt = (page: FlowPage): number => page.contentHeightPt - KEEP_FIT_SAFETY_MARGIN_PT;

const cleanLimitPt = (page: FlowPage): number => page.contentHeightPt + CLEAN_OVERFLOW_TOLERANCE_PT;

const countPages = (page: FlowPage, limitPt: number): number => {
  let pages = 1;
  let usedPt = 0;

  const advance = (heightPt: number) => {
    if (heightPt <= 0) return;
    if (usedPt > 0 && usedPt + heightPt > limitPt) {
      pages += 1;
      usedPt = 0;
    }
    usedPt += heightPt;
  };

  page.sections.forEach((section) => {
    // Word balances a multi-column section, so its columns end up roughly the
    // same height rather than stacking one after another.
    if (section.columnCount > 1) {
      advance(section.segments.reduce(addSegmentHeight, 0) / section.columnCount);
      return;
    }
    section.segments.forEach((segment) => {
      if (segment.kind === 'blocks') {
        segment.blocks.forEach((block) => advance(blockHeight(block)));
        return;
      }
      segment.rows.forEach((row) => advance(rowHeight(row)));
    });
  });

  return pages;
};

const countKeepPages = (page: FlowPage): number => countPages(page, keepLimitPt(page));

const countCleanPages = (page: FlowPage): number => countPages(page, cleanLimitPt(page));

type ThemeBlockOptions = {
  sizeHalfPoints: number;
  bold?: boolean;
  widthPt?: number;
  beforeTwips?: number;
  afterTwips?: number;
  extraPt?: number;
};

const themeBlock = (text: string, options: ThemeBlockOptions): FlowBlock => {
  const fontPt = halfPointsToPt(options.sizeHalfPoints);
  return {
    text,
    bold: options.bold ?? false,
    fontFamily: FONT,
    fontPt,
    lineHeightPt: fontPt * lineHeightMultiplier(FONT),
    widthPt: options.widthPt ?? CLEAN_CONTENT_WIDTH_PT,
    beforePt: twipsToPt(options.beforeTwips ?? 0),
    afterPt: twipsToPt(options.afterTwips ?? 0),
    extraPt: options.extraPt ?? 0,
  };
};

const cleanBulletBlock = (text: string, theme: ResumeTheme): FlowBlock =>
  themeBlock(text, {
    sizeHalfPoints: theme.bodySize,
    widthPt: CLEAN_CONTENT_WIDTH_PT - twipsToPt(theme.bulletIndent),
    afterTwips: theme.bulletAfter,
  });

type PlacedBlock = {
  cell: DocxCellRef | null;
  spansCells: boolean;
  block: FlowBlock;
};

const restoreTableSegments = (
  items: PlacedBlock[],
  layout: DocxCleanLayout | null | undefined,
): FlowSegment[] =>
  groupByTableRun(items).map((group) => {
    const cell = group[0].cell;
    const blocks = group.map((item) => item.block);
    if (!cell) return { kind: 'blocks' as const, blocks };

    const info = layout?.tables[cell.tableIndex];
    const columnCount = info?.columnCount ?? cell.columnCount;
    if (
      columnCount < 2 ||
      group.some((item) => item.spansCells) ||
      group.length > items.length * MAX_TABLE_SHARE_OF_DOCUMENT
    ) {
      return { kind: 'blocks' as const, blocks };
    }

    const widths = distributeColumnWidths(
      info?.columnWidths ?? null,
      columnCount,
      CLEAN_CONTENT_WIDTH_PT,
    );
    const rowIndexes = [...new Set(group.map((item) => item.cell?.rowIndex ?? 0))].sort(
      (left, right) => left - right,
    );
    const rows: FlowRow[] = rowIndexes.map((rowIndex) => ({
      columns: widths.map((widthPt, columnIndex) => [
        {
          kind: 'blocks' as const,
          blocks: group
            .filter(
              (item) => item.cell?.rowIndex === rowIndex && item.cell?.columnIndex === columnIndex,
            )
            .map((item) => ({
              ...item.block,
              widthPt: Math.max(MIN_BLOCK_WIDTH_PT, widthPt - CLEAN_CELL_GUTTER_PT),
            })),
        },
      ]),
    }));
    return { kind: 'table' as const, rows };
  });

const cleanDocumentSegments = (
  resumeDocument: ResumeDocument,
  textsByNodeId: Map<string, string>,
  layout: DocxCleanLayout | null | undefined,
  scale: number,
  spacingScale: number,
): FlowSegment[] => {
  const theme = createResumeTheme(scale, spacingScale);
  const items: PlacedBlock[] = [];
  const textOf = (nodeId: string): string => textsByNodeId.get(nodeId)?.trim() ?? '';

  let lastCell: DocxCellRef | null = null;
  const push = (sourceLines: number[], block: FlowBlock) => {
    if (sourceLines.length === 0) {
      items.push({ cell: lastCell, spansCells: false, block });
      return;
    }
    const cells = sourceLines.map((lineIndex) => layout?.cellRefsByLine.get(lineIndex) ?? null);
    const distinct = new Set(
      cells.map((cell) =>
        cell ? `${cell.tableIndex}:${cell.rowIndex}:${cell.columnIndex}` : 'none',
      ),
    );
    lastCell = cells.find((cell) => cell !== null) ?? null;
    items.push({ cell: lastCell, spansCells: distinct.size > 1, block });
  };

  const wasBold = (sourceLines: number[]): boolean =>
    sourceLines.length > 0 && sourceLines.every((lineIndex) => layout?.boldLines.has(lineIndex));

  const nameText = textOf(resumeDocument.header.name.id);
  if (nameText) {
    push(
      resumeDocument.header.name.sourceLines,
      themeBlock(nameText, {
        sizeHalfPoints: theme.nameSize,
        bold: true,
        afterTwips: theme.nameAfter,
      }),
    );
  }

  resumeDocument.header.contact.forEach((item) => {
    const text = textOf(item.id);
    if (!text) return;
    push(
      item.sourceLines,
      themeBlock(text, { sizeHalfPoints: theme.contactSize, afterTwips: theme.contactAfter }),
    );
  });

  resumeDocument.sections.forEach((section) => {
    const headingText = section.heading ? textOf(section.heading.id) : '';
    if (section.heading && headingText) {
      push(
        section.heading.sourceLines,
        themeBlock(headingText.toUpperCase(), {
          sizeHalfPoints: theme.headingSize,
          bold: true,
          beforeTwips: theme.headingBefore,
          afterTwips: theme.headingAfter,
          extraPt: HEADING_RULE_PT,
        }),
      );
    }

    section.blocks.forEach((block) => {
      if (block.kind === 'entry') {
        const left = entryDisplayLeft(block) || textOf(block.id);
        const dateText = entryDisplayDate(block);
        if (left || dateText) {
          // Title and date share one table row, so the row is only as tall as the
          // title column rather than the two texts laid end to end.
          const splitsIntoColumns = Boolean(left) && Boolean(dateText);
          push(
            block.headingSourceLines,
            themeBlock(left || dateText || '', {
              sizeHalfPoints: theme.bodySize,
              bold: true,
              widthPt: splitsIntoColumns ? CLEAN_TITLE_WIDTH_PT : CLEAN_CONTENT_WIDTH_PT,
              beforeTwips: theme.blockBefore,
              afterTwips: theme.blockAfter,
            }),
          );
        }
        block.bullets.forEach((bullet) => {
          const text = stripBulletMarker(textOf(bullet.id)).trim();
          if (!text) return;
          push(bullet.sourceLines, cleanBulletBlock(text, theme));
        });
        return;
      }

      if (block.kind === 'bullet') {
        const text = stripBulletMarker(textOf(block.id)).trim();
        if (!text) return;
        push(block.sourceLines, cleanBulletBlock(text, theme));
        return;
      }

      const text = textOf(block.id);
      if (!text) return;
      push(
        block.sourceLines,
        themeBlock(text, {
          sizeHalfPoints: theme.bodySize,
          bold: wasBold(block.sourceLines),
          afterTwips: block.kind === 'skillsGroup' ? theme.blockAfter : theme.paragraphAfter,
        }),
      );
    });
  });

  return restoreTableSegments(items, layout);
};

const CONTACT_LINE_PATTERN = /@|\bwww\.|https?:|linkedin|github|(?:\d[\s().-]*){7,}/i;
const MAX_CONTACT_LINE_INDEX = 3;

const templateSegments = (
  resumeText: string,
  scale: number,
  spacingScale: number,
): FlowSegment[] => {
  const theme = createResumeTheme(scale, spacingScale);
  const blocks: FlowBlock[] = [];
  let previousBlank = false;
  let contentIndex = 0;

  resumeText.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      previousBlank = true;
      return;
    }

    if (contentIndex === 0) {
      blocks.push(
        themeBlock(trimmed, {
          sizeHalfPoints: theme.nameSize,
          bold: true,
          afterTwips: theme.nameAfter,
        }),
      );
    } else if (
      contentIndex <= MAX_CONTACT_LINE_INDEX &&
      CONTACT_LINE_PATTERN.test(trimmed) &&
      !isBulletLine(line)
    ) {
      blocks.push(
        themeBlock(trimmed, { sizeHalfPoints: theme.contactSize, afterTwips: theme.contactAfter }),
      );
    } else if (isBulletLine(line)) {
      blocks.push(cleanBulletBlock(stripBulletMarker(line).trim(), theme));
    } else if (isHeadingLine(line)) {
      blocks.push(
        themeBlock(trimmed.toUpperCase(), {
          sizeHalfPoints: theme.headingSize,
          bold: true,
          beforeTwips: theme.headingBefore,
          afterTwips: theme.headingAfter,
          extraPt: HEADING_RULE_PT,
        }),
      );
    } else {
      blocks.push(
        themeBlock(trimmed, {
          sizeHalfPoints: theme.bodySize,
          beforeTwips: previousBlank ? theme.blockBefore : 0,
          afterTwips: theme.blockAfter,
        }),
      );
    }

    contentIndex += 1;
    previousBlank = false;
  });

  return [{ kind: 'blocks', blocks }];
};

const childElements = (element: Element): Element[] =>
  Array.from(element.childNodes).filter(
    (node): node is Element => node.nodeType === 1 && (node as Element).namespaceURI === WORD_NS,
  );

const firstChildElement = (element: Element | null, localName: string): Element | null =>
  element ? (childElements(element).find((child) => child.localName === localName) ?? null) : null;

const lastChildElement = (element: Element | null, localName: string): Element | null => {
  if (!element) return null;
  const matches = childElements(element).filter((child) => child.localName === localName);
  return matches[matches.length - 1] ?? null;
};

const intAttribute = (element: Element | null, localName: string): number | null => {
  const raw = element?.getAttributeNS(WORD_NS, localName) ?? null;
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const numberAttribute = (element: Element | null, localName: string): number | null => {
  const raw = element?.getAttributeNS(WORD_NS, localName) ?? null;
  if (raw === null) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const isToggleOn = (element: Element | null): boolean | null => {
  if (!element) return null;
  const value = element.getAttributeNS(WORD_NS, 'val');
  return value !== '0' && value !== 'false';
};

type Formatting = {
  fontFamily: string | null;
  sizeHalfPoints: number | null;
  bold: boolean | null;
  beforeTwips: number | null;
  afterTwips: number | null;
  lineTwips: number | null;
  lineRule: string | null;
  indentLeftTwips: number | null;
  indentRightTwips: number | null;
};

const EMPTY_FORMATTING: Formatting = {
  fontFamily: null,
  sizeHalfPoints: null,
  bold: null,
  beforeTwips: null,
  afterTwips: null,
  lineTwips: null,
  lineRule: null,
  indentLeftTwips: null,
  indentRightTwips: null,
};

const readFontFamily = (fonts: Element | null): string | null =>
  fonts?.getAttributeNS(WORD_NS, 'ascii') ?? fonts?.getAttributeNS(WORD_NS, 'hAnsi') ?? null;

const readFormatting = (
  paragraphProperties: Element | null,
  runProperties: Element | null,
): Formatting => {
  const spacing = firstChildElement(paragraphProperties, 'spacing');
  const indent = firstChildElement(paragraphProperties, 'ind');
  return {
    fontFamily: readFontFamily(firstChildElement(runProperties, 'rFonts')),
    sizeHalfPoints: intAttribute(firstChildElement(runProperties, 'sz'), 'val'),
    bold: isToggleOn(firstChildElement(runProperties, 'b')),
    beforeTwips: intAttribute(spacing, 'before'),
    afterTwips: intAttribute(spacing, 'after'),
    lineTwips: numberAttribute(spacing, 'line'),
    lineRule: spacing?.getAttributeNS(WORD_NS, 'lineRule') ?? null,
    indentLeftTwips: intAttribute(indent, 'left') ?? intAttribute(indent, 'start'),
    indentRightTwips: intAttribute(indent, 'right') ?? intAttribute(indent, 'end'),
  };
};

const mergeFormatting = (base: Formatting, override: Formatting): Formatting => ({
  fontFamily: override.fontFamily ?? base.fontFamily,
  sizeHalfPoints: override.sizeHalfPoints ?? base.sizeHalfPoints,
  bold: override.bold ?? base.bold,
  beforeTwips: override.beforeTwips ?? base.beforeTwips,
  afterTwips: override.afterTwips ?? base.afterTwips,
  lineTwips: override.lineTwips ?? base.lineTwips,
  lineRule: override.lineRule ?? base.lineRule,
  indentLeftTwips: override.indentLeftTwips ?? base.indentLeftTwips,
  indentRightTwips: override.indentRightTwips ?? base.indentRightTwips,
});

type StyleSheet = {
  documentDefaults: Formatting;
  byStyleId: Map<string, Formatting>;
};

const readStyleSheet = (styles: Document | null): StyleSheet => {
  const root = styles?.documentElement ?? null;
  if (!root) return { documentDefaults: EMPTY_FORMATTING, byStyleId: new Map() };

  const defaults = firstChildElement(root, 'docDefaults');
  const documentDefaults = readFormatting(
    firstChildElement(firstChildElement(defaults, 'pPrDefault'), 'pPr'),
    firstChildElement(firstChildElement(defaults, 'rPrDefault'), 'rPr'),
  );

  const definitions = new Map<string, { own: Formatting; basedOn: string | null }>();
  childElements(root)
    .filter((child) => child.localName === 'style')
    .forEach((style) => {
      const styleId = style.getAttributeNS(WORD_NS, 'styleId');
      if (!styleId) return;
      definitions.set(styleId, {
        own: readFormatting(firstChildElement(style, 'pPr'), firstChildElement(style, 'rPr')),
        basedOn: firstChildElement(style, 'basedOn')?.getAttributeNS(WORD_NS, 'val') ?? null,
      });
    });

  const byStyleId = new Map<string, Formatting>();
  const resolve = (styleId: string, seen: Set<string>): Formatting => {
    const cached = byStyleId.get(styleId);
    if (cached) return cached;
    const definition = definitions.get(styleId);
    if (!definition || seen.has(styleId)) return documentDefaults;
    seen.add(styleId);
    const resolved = mergeFormatting(
      definition.basedOn ? resolve(definition.basedOn, seen) : documentDefaults,
      definition.own,
    );
    byStyleId.set(styleId, resolved);
    return resolved;
  };
  definitions.forEach((_definition, styleId) => resolve(styleId, new Set()));

  return { documentDefaults, byStyleId };
};

type KeepParagraph = {
  text: string;
  bold: boolean;
  fontFamily: string;
  baseHalfPoints: number;
  widthPt: number;
  beforeTwips: number;
  afterTwips: number;
  lineTwips: number | null;
  lineRule: string | null;
};

type KeepRow = { columns: KeepNode[][] };

type KeepNode =
  { kind: 'paragraph'; paragraph: KeepParagraph } | { kind: 'table'; rows: KeepRow[] };

type KeepSection = {
  columnCount: number;
  nodes: KeepNode[];
};

type KeepDocument = {
  contentHeightPt: number;
  sections: KeepSection[];
};

const textRuns = (paragraph: Element): Element[] =>
  Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 'r')).filter(
    (run) => paragraphText(run).trim().length > 0,
  );

const runFormatting = (
  paragraph: Element,
): { fontFamily: string | null; sizeHalfPoints: number | null; bold: boolean | null } => {
  const properties = textRuns(paragraph).map((run) => firstChildElement(run, 'rPr'));
  if (properties.length === 0) return { fontFamily: null, sizeHalfPoints: null, bold: null };

  const sizes = properties
    .map((rPr) => intAttribute(firstChildElement(rPr, 'sz'), 'val'))
    .filter((size): size is number => size !== null);
  const boldFlags = properties.map((rPr) => isToggleOn(firstChildElement(rPr, 'b')));
  const families = properties
    .map((rPr) => readFontFamily(firstChildElement(rPr, 'rFonts')))
    .filter((family): family is string => family !== null);

  return {
    fontFamily: families[0] ?? null,
    sizeHalfPoints: sizes.length > 0 ? Math.max(...sizes) : null,
    bold: boldFlags.some((flag) => flag !== null) ? boldFlags.every((flag) => flag === true) : null,
  };
};

const readParagraph = (
  paragraph: Element,
  text: string,
  styleSheet: StyleSheet,
  containerWidthPt: number,
): KeepParagraph => {
  const properties = firstChildElement(paragraph, 'pPr');
  const styleId = firstChildElement(properties, 'pStyle')?.getAttributeNS(WORD_NS, 'val') ?? null;
  const inherited =
    (styleId ? styleSheet.byStyleId.get(styleId) : null) ?? styleSheet.documentDefaults;
  const merged = mergeFormatting(
    inherited,
    readFormatting(properties, firstChildElement(properties, 'rPr')),
  );
  const runs = runFormatting(paragraph);

  // Keep-formatting exports scale type and spacing but leave w:ind untouched, so
  // indents hold their authored width at every scale.
  const indentPt = twipsToPt(
    Math.max(0, merged.indentLeftTwips ?? 0) + Math.max(0, merged.indentRightTwips ?? 0),
  );

  return {
    text: text.trim(),
    bold: runs.bold ?? merged.bold ?? false,
    fontFamily: runs.fontFamily ?? merged.fontFamily ?? FONT,
    baseHalfPoints: runs.sizeHalfPoints ?? merged.sizeHalfPoints ?? DEFAULT_BODY_HALF_POINTS,
    widthPt: Math.max(MIN_BLOCK_WIDTH_PT, containerWidthPt - indentPt),
    beforeTwips: merged.beforeTwips ?? 0,
    afterTwips: merged.afterTwips ?? 0,
    lineTwips: merged.lineTwips,
    lineRule: merged.lineRule,
  };
};

type KeepContext = {
  styleSheet: StyleSheet;
  paragraphs: Element[];
  indexByParagraph: Map<Element, number>;
  replacementsByLine: Map<string, string>;
  insertionsByAnchor: Map<string, string[]>;
  usedAnchors: Set<string>;
};

const readParagraphNodes = (
  paragraph: Element,
  widthPt: number,
  context: KeepContext,
): KeepNode[] => {
  const nodes: KeepNode[] = [];
  const originalText = paragraphText(paragraph);
  const normalized = normalizeResumeLine(originalText);
  const tailored = context.replacementsByLine.get(normalized);
  const isDeleted = tailored !== undefined && tailored.length === 0;

  if (!isDeleted) {
    nodes.push({
      kind: 'paragraph',
      paragraph: readParagraph(paragraph, tailored ?? originalText, context.styleSheet, widthPt),
    });
  }

  const textsToInsert = context.insertionsByAnchor.get(normalized);
  if (!textsToInsert || context.usedAnchors.has(normalized)) return nodes;
  context.usedAnchors.add(normalized);

  const template = findBulletTemplate(
    context.paragraphs,
    context.indexByParagraph.get(paragraph) ?? 0,
  );
  textsToInsert.forEach((text) => {
    nodes.push({
      kind: 'paragraph',
      paragraph: readParagraph(
        template,
        resolveInsertText(text, template),
        context.styleSheet,
        widthPt,
      ),
    });
  });

  return nodes;
};

const readTable = (table: Element, widthPt: number, context: KeepContext): KeepNode => {
  const grid = firstChildElement(table, 'tblGrid');
  const gridWidths = grid
    ? childElements(grid)
        .filter((column) => column.localName === 'gridCol')
        .map((column) => intAttribute(column, 'w') ?? 0)
    : [];
  const cellMargin = firstChildElement(firstChildElement(table, 'tblPr'), 'tblCellMar');
  const gutterPt = twipsToPt(
    (intAttribute(firstChildElement(cellMargin, 'left'), 'w') ?? DEFAULT_CELL_MARGIN_TWIPS) +
      (intAttribute(firstChildElement(cellMargin, 'right'), 'w') ?? DEFAULT_CELL_MARGIN_TWIPS),
  );

  const rows: KeepRow[] = childElements(table)
    .filter((child) => child.localName === 'tr')
    .map((row) => {
      const cells = childElements(row).filter((child) => child.localName === 'tc');
      const columnWidths = distributeColumnWidths(
        gridWidths.length > 0 ? gridWidths : null,
        Math.max(gridWidths.length, cells.length, 1),
        widthPt,
      );

      let gridColumn = 0;
      return {
        columns: cells.map((cell) => {
          const span = Math.max(
            1,
            intAttribute(firstChildElement(firstChildElement(cell, 'tcPr'), 'gridSpan'), 'val') ??
              1,
          );
          const cellWidthPt = columnWidths
            .slice(gridColumn, gridColumn + span)
            .reduce((sum, width) => sum + width, 0);
          gridColumn += span;
          return readContainer(cell, Math.max(MIN_BLOCK_WIDTH_PT, cellWidthPt - gutterPt), context);
        }),
      };
    });

  return { kind: 'table', rows };
};

const readNodes = (elements: Element[], widthPt: number, context: KeepContext): KeepNode[] =>
  elements.flatMap((child) => {
    if (child.localName === 'p') return readParagraphNodes(child, widthPt, context);
    if (child.localName === 'tbl') return [readTable(child, widthPt, context)];
    if (child.localName === 'sdt') {
      const content = firstChildElement(child, 'sdtContent');
      return content ? readNodes(childElements(content), widthPt, context) : [];
    }
    return [];
  });

const readContainer = (container: Element, widthPt: number, context: KeepContext): KeepNode[] =>
  readNodes(childElements(container), widthPt, context);

const readPageMetrics = (
  sectionProperties: Element | null,
): { contentHeightPt: number; contentWidthPt: number } => {
  const pageSize = firstChildElement(sectionProperties, 'pgSz');
  const pageMargin = firstChildElement(sectionProperties, 'pgMar');
  const heightTwips = intAttribute(pageSize, 'h') ?? PAGE_HEIGHT;
  const widthTwips = intAttribute(pageSize, 'w') ?? PAGE_WIDTH;
  const topTwips = Math.abs(intAttribute(pageMargin, 'top') ?? RESUME_MARGIN);
  const bottomTwips = Math.abs(intAttribute(pageMargin, 'bottom') ?? RESUME_MARGIN);
  const leftTwips = Math.abs(intAttribute(pageMargin, 'left') ?? RESUME_MARGIN);
  const rightTwips = Math.abs(intAttribute(pageMargin, 'right') ?? RESUME_MARGIN);
  return {
    contentHeightPt: twipsToPt(Math.max(1, heightTwips - topTwips - bottomTwips)),
    contentWidthPt: twipsToPt(Math.max(1, widthTwips - leftTwips - rightTwips)),
  };
};

// A section break lives in the pPr of its own last paragraph, and the body's
// trailing sectPr closes the final section.
const splitBodySections = (
  body: Element,
): { elements: Element[]; properties: Element | null }[] => {
  const sections: { elements: Element[]; properties: Element | null }[] = [];
  let pending: Element[] = [];

  childElements(body).forEach((child) => {
    if (child.localName === 'sectPr') {
      sections.push({ elements: pending, properties: child });
      pending = [];
      return;
    }
    pending.push(child);
    const properties =
      child.localName === 'p' ? firstChildElement(firstChildElement(child, 'pPr'), 'sectPr') : null;
    if (!properties) return;
    sections.push({ elements: pending, properties });
    pending = [];
  });

  if (pending.length > 0) sections.push({ elements: pending, properties: null });
  return sections;
};

const readColumnLayout = (
  sectionProperties: Element | null,
  contentWidthPt: number,
): { columnCount: number; columnWidthPt: number } => {
  const columns = firstChildElement(sectionProperties, 'cols');
  const columnCount = Math.max(1, intAttribute(columns, 'num') ?? 1);
  if (columnCount === 1) return { columnCount: 1, columnWidthPt: contentWidthPt };

  const declared = columns
    ? childElements(columns)
        .filter((column) => column.localName === 'col')
        .map((column) => intAttribute(column, 'w'))
        .filter((width): width is number => width !== null && width > 0)
    : [];
  if (declared.length > 0) {
    const averageTwips = declared.reduce((sum, width) => sum + width, 0) / declared.length;
    return { columnCount, columnWidthPt: twipsToPt(averageTwips) };
  }

  const spacingPt = twipsToPt(intAttribute(columns, 'space') ?? RESUME_MARGIN);
  return {
    columnCount,
    columnWidthPt: Math.max(
      MIN_BLOCK_WIDTH_PT,
      (contentWidthPt - spacingPt * (columnCount - 1)) / columnCount,
    ),
  };
};

const parseXmlPart = async (zip: JSZip, path: string): Promise<Document | null> => {
  const entry = zip.file(path);
  if (!entry) return null;
  const parsed = new DOMParser().parseFromString(await entry.async('string'), 'application/xml');
  return parsed.getElementsByTagName('parsererror').length > 0 ? null : parsed;
};

const readKeepDocument = async (
  file: File,
  replacements: DocxReplacement[],
  insertions: DocxInsertion[],
): Promise<KeepDocument | null> => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const parsed = await parseXmlPart(zip, 'word/document.xml');
  if (!parsed) return null;
  const body = firstChildElement(parsed.documentElement, 'body');
  if (!body) return null;

  const replacementsByLine = new Map<string, string>();
  replacements.forEach((replacement) => {
    const key = normalizeResumeLine(replacement.original);
    if (key.length === 0) return;
    replacementsByLine.set(key, stripBulletMarker(replacement.tailored).trim());
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

  const paragraphs = Array.from(parsed.getElementsByTagNameNS(WORD_NS, 'p'));
  const context: KeepContext = {
    styleSheet: readStyleSheet(await parseXmlPart(zip, 'word/styles.xml')),
    paragraphs,
    indexByParagraph: new Map(paragraphs.map((paragraph, index) => [paragraph, index])),
    replacementsByLine,
    insertionsByAnchor,
    usedAnchors: new Set(),
  };

  const finalProperties = lastChildElement(body, 'sectPr');
  return {
    contentHeightPt: readPageMetrics(finalProperties).contentHeightPt,
    sections: splitBodySections(body).map((section) => {
      const properties = section.properties ?? finalProperties;
      const { contentWidthPt } = readPageMetrics(properties);
      const { columnCount, columnWidthPt } = readColumnLayout(properties, contentWidthPt);
      return { columnCount, nodes: readNodes(section.elements, columnWidthPt, context) };
    }),
  };
};

const keepLineHeightPt = (paragraph: KeepParagraph, fontPt: number, scale: number): number => {
  const naturalPt = fontPt * lineHeightMultiplier(paragraph.fontFamily);
  const { lineTwips, lineRule } = paragraph;
  if (lineTwips === null || lineTwips <= 0) return naturalPt;
  if (lineRule === 'exact') return twipsToPt(scaleTwips(lineTwips, scale));
  if (lineRule === 'atLeast') return Math.max(twipsToPt(scaleTwips(lineTwips, scale)), naturalPt);
  return (lineTwips / TWIPS_PER_AUTO_LINE) * naturalPt;
};

const scaleKeepParagraph = (paragraph: KeepParagraph, scale: number): FlowBlock => {
  const fontPt = halfPointsToPt(scaleHalfPoints(paragraph.baseHalfPoints, scale));
  return {
    text: paragraph.text,
    bold: paragraph.bold,
    fontFamily: paragraph.fontFamily,
    fontPt,
    lineHeightPt: keepLineHeightPt(paragraph, fontPt, scale),
    widthPt: paragraph.widthPt,
    beforePt: twipsToPt(scaleTwips(paragraph.beforeTwips, scale)),
    afterPt: twipsToPt(scaleTwips(paragraph.afterTwips, scale)),
    extraPt: 0,
  };
};

const scaleKeepNodes = (nodes: KeepNode[], scale: number): FlowSegment[] =>
  nodes.map((node) =>
    node.kind === 'paragraph'
      ? { kind: 'blocks' as const, blocks: [scaleKeepParagraph(node.paragraph, scale)] }
      : {
          kind: 'table' as const,
          rows: node.rows.map((row) => ({
            columns: row.columns.map((column) => scaleKeepNodes(column, scale)),
          })),
        },
  );

const keepPage = (keepDocument: KeepDocument, scale: number): FlowPage => ({
  contentHeightPt: keepDocument.contentHeightPt,
  sections: keepDocument.sections.map((section) => ({
    columnCount: section.columnCount,
    segments: scaleKeepNodes(section.nodes, scale),
  })),
});

const FIT_SCALE_STEP = 0.01;
const SCALE_CANDIDATES: number[] = Array.from(
  { length: Math.round((EXPORT_SCALE_MAX - EXPORT_SCALE_MIN) / FIT_SCALE_STEP) + 1 },
  (_unused, index) =>
    clampExportScale(Number((EXPORT_SCALE_MAX - index * FIT_SCALE_STEP).toFixed(2))),
);

export type FitScaleInput = {
  resumeDocument: ResumeDocument | null;
  resumeText: string;
  textsByNodeId: Map<string, string>;
  layout: DocxCleanLayout | null | undefined;
  originalFile: File | null;
  replacements: DocxReplacement[];
  insertions: DocxInsertion[];
};

const cleanPage = (input: FitScaleInput, scale: number, spacingScale = scale): FlowPage => ({
  contentHeightPt: CLEAN_CONTENT_HEIGHT_PT,
  sections: [
    {
      columnCount: 1,
      segments: input.resumeDocument
        ? cleanDocumentSegments(
            input.resumeDocument,
            input.textsByNodeId,
            input.layout,
            scale,
            spacingScale,
          )
        : templateSegments(input.resumeText, scale, spacingScale),
    },
  ],
});

export const isOriginalSinglePage = async (file: File): Promise<boolean> => {
  const original = await readKeepDocument(file, [], []);
  if (!original) return false;
  return countKeepPages(keepPage(original, EXPORT_SCALE_DEFAULT)) <= 1;
};

export type FitToOnePageScales = {
  clean: number;
  cleanSpacing: number;
  keep: number;
};

const largestFittingScale = (fits: (scale: number) => boolean): number =>
  SCALE_CANDIDATES.find(fits) ?? EXPORT_SCALE_MIN;

export const computeFitToOnePageScale = async (
  input: FitScaleInput,
): Promise<FitToOnePageScales> => {
  const original = input.originalFile
    ? await readKeepDocument(input.originalFile, input.replacements, input.insertions)
    : null;

  const clean = largestFittingScale((scale) => countCleanPages(cleanPage(input, scale)) <= 1);
  const cleanSpacing = largestFittingScale(
    (spacingScale) => countCleanPages(cleanPage(input, clean, spacingScale)) <= 1,
  );
  if (original === null) return { clean, cleanSpacing, keep: clean };

  return {
    clean,
    cleanSpacing,
    keep: largestFittingScale((scale) => countKeepPages(keepPage(original, scale)) <= 1),
  };
};
