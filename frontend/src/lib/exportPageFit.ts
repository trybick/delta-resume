import JSZip from 'jszip';
import {
  EXPORT_SCALE_DEFAULT,
  EXPORT_SCALE_MAX,
  EXPORT_SCALE_MIN,
  EXPORT_SCALE_STEP,
  clampExportScale,
  createResumeTheme,
  isBulletLine,
  isHeadingLine,
  stripBulletMarker,
  type DocxInsertion,
  type DocxReplacement,
} from './exportDocx';
import type { DocxCellRef, DocxCleanLayout, DocxTableInfo } from './docxLayout';
import { entryDisplayDate, entryDisplayLeft } from './resumeModel';
import type { ResumeDocument } from './types';

const WORD_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/main';
const FONT = 'Arial';
const RESUME_MARGIN_PT = 36;
const PAGE_HEIGHT_PT = 792;
const CONTENT_HEIGHT_PT = PAGE_HEIGHT_PT - RESUME_MARGIN_PT * 2;
const CONTENT_WIDTH_PT = 540;
const LINE_HEIGHT_MULTIPLIER = 1.18;
const HEADING_RULE_PT = 4;
const FIT_SAFETY_MARGIN_PT = 10;
const MAX_TABLE_SHARE_OF_DOCUMENT = 0.8;

type FlowBlock = {
  text: string;
  fontPt: number;
  bold: boolean;
  widthPt: number;
  beforePt: number;
  afterPt: number;
  extraPt?: number;
};

type TableRowGroup = {
  columns: FlowBlock[][];
};

type FlowSegment = { kind: 'blocks'; blocks: FlowBlock[] } | { kind: 'table'; rows: TableRowGroup[] };

let measureContext: CanvasRenderingContext2D | null = null;

const measureCanvas = (): CanvasRenderingContext2D => {
  if (measureContext) return measureContext;
  const canvas = document.createElement('canvas');
  measureContext = canvas.getContext('2d');
  if (!measureContext) throw new Error('canvas unavailable');
  return measureContext;
};

const fontString = (fontPt: number, bold: boolean): string =>
  `${bold ? 'bold' : 'normal'} ${fontPt}px ${FONT}`;

const wrapText = (text: string, widthPt: number, fontPt: number, bold: boolean): string[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const context = measureCanvas();
  context.font = fontString(fontPt, bold);
  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= widthPt || !current) {
      current = candidate;
      return;
    }
    lines.push(current);
    current = word;
  });
  if (current) lines.push(current);
  return lines;
};

const blockHeight = (block: FlowBlock): number => {
  const lines = wrapText(block.text, block.widthPt, block.fontPt, block.bold);
  if (lines.length === 0) return 0;
  const lineHeight = block.fontPt * LINE_HEIGHT_MULTIPLIER;
  return block.beforePt + lines.length * lineHeight + block.afterPt + (block.extraPt ?? 0);
};

const paginateBlocks = (blocks: FlowBlock[]): number => {
  let pages = 1;
  let y = 0;
  blocks.forEach((block) => {
    const height = blockHeight(block);
    if (height <= 0) return;
    if (y + height > CONTENT_HEIGHT_PT - FIT_SAFETY_MARGIN_PT && y > 0) {
      pages += 1;
      y = 0;
    }
    y += height;
  });
  return pages;
};

const paginateSegments = (segments: FlowSegment[]): number => {
  let pages = 1;
  let y = 0;
  const advance = (height: number) => {
    if (height <= 0) return;
    if (y + height > CONTENT_HEIGHT_PT - FIT_SAFETY_MARGIN_PT && y > 0) {
      pages += 1;
      y = 0;
    }
    y += height;
  };

  segments.forEach((segment) => {
    if (segment.kind === 'blocks') {
      segment.blocks.forEach((block) => advance(blockHeight(block)));
      return;
    }
    segment.rows.forEach((row) => {
      const rowHeight = Math.max(
        0,
        ...row.columns.map((column) =>
          column.reduce((sum, block) => sum + blockHeight(block), 0),
        ),
      );
      advance(rowHeight);
    });
  });
  return pages;
};

const halfPointsToPt = (halfPoints: number): number => halfPoints / 2;

const twipsToPt = (twips: number): number => twips / 20;

const themeBlock = (
  text: string,
  options: {
    sizeHalfPoints: number;
    bold?: boolean;
    widthPt?: number;
    beforePt?: number;
    afterPt?: number;
    extraPt?: number;
  },
): FlowBlock => ({
  text,
  fontPt: halfPointsToPt(options.sizeHalfPoints),
  bold: options.bold ?? false,
  widthPt: options.widthPt ?? CONTENT_WIDTH_PT,
  beforePt: options.beforePt ?? 0,
  afterPt: options.afterPt ?? 0,
  extraPt: options.extraPt,
});

type RenderedFlowItem = {
  cell: DocxCellRef | null;
  spansCells: boolean;
  block: FlowBlock;
};

const scaleColumnWidths = (columnWidths: number[] | null, columnCount: number): number[] => {
  const total = columnWidths?.reduce((sum, width) => sum + width, 0) ?? 0;
  if (!columnWidths || columnWidths.length !== columnCount || total <= 0) {
    const even = Math.floor(CONTENT_WIDTH_PT / columnCount);
    return Array.from({ length: columnCount }, (_, index) =>
      index === columnCount - 1 ? CONTENT_WIDTH_PT - even * (columnCount - 1) : even,
    );
  }
  return columnWidths.map((width) => (width / total) * CONTENT_WIDTH_PT);
};

const restoreTableSegments = (
  items: RenderedFlowItem[],
  tables: DocxTableInfo[],
): FlowSegment[] => {
  const groups: RenderedFlowItem[][] = [];
  items.forEach((item) => {
    const current = groups[groups.length - 1];
    const currentTableIndex = current?.[0].cell?.tableIndex ?? null;
    if (current && currentTableIndex === (item.cell?.tableIndex ?? null)) {
      current.push(item);
      return;
    }
    groups.push([item]);
  });

  return groups.map((group) => {
    const cell = group[0].cell;
    if (!cell) {
      return { kind: 'blocks' as const, blocks: group.map((item) => item.block) };
    }
    const info = tables[cell.tableIndex];
    const columnCount = info?.columnCount ?? cell.columnCount;
    if (
      columnCount < 2 ||
      group.some((item) => item.spansCells) ||
      group.length > items.length * MAX_TABLE_SHARE_OF_DOCUMENT
    ) {
      return { kind: 'blocks' as const, blocks: group.map((item) => item.block) };
    }

    const widths = scaleColumnWidths(info?.columnWidths ?? null, columnCount);
    const rowIndexes = [...new Set(group.map((item) => item.cell!.rowIndex))].sort(
      (left, right) => left - right,
    );
    const rows: TableRowGroup[] = rowIndexes.map((rowIndex) => ({
      columns: widths.map((widthPt, columnIndex) =>
        group
          .filter(
            (item) =>
              item.cell!.rowIndex === rowIndex && item.cell!.columnIndex === columnIndex,
          )
          .map((item) => ({ ...item.block, widthPt: Math.max(20, widthPt - 8) })),
      ),
    }));
    return { kind: 'table' as const, rows };
  });
};

export const buildCleanFlowSegments = (
  resumeDocument: ResumeDocument,
  textsByNodeId: Map<string, string>,
  layout: DocxCleanLayout | null | undefined,
  scale = EXPORT_SCALE_DEFAULT,
): FlowSegment[] => {
  const theme = createResumeTheme(scale);
  const items: RenderedFlowItem[] = [];
  const textOf = (nodeId: string): string => textsByNodeId.get(nodeId)?.trim() ?? '';

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

  const push = (sourceLines: number[], block: FlowBlock) => {
    items.push({ ...placementFor(sourceLines), block });
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
        afterPt: twipsToPt(theme.nameAfter),
      }),
    );
  }

  resumeDocument.header.contact.forEach((item) => {
    const text = textOf(item.id);
    if (!text) return;
    push(
      item.sourceLines,
      themeBlock(text, {
        sizeHalfPoints: theme.contactSize,
        afterPt: twipsToPt(theme.contactAfter),
      }),
    );
  });

  resumeDocument.sections.forEach((section) => {
    if (section.heading) {
      const headingText = textOf(section.heading.id);
      if (headingText) {
        push(
          section.heading.sourceLines,
          themeBlock(headingText.toUpperCase(), {
            sizeHalfPoints: theme.headingSize,
            bold: true,
            beforePt: twipsToPt(theme.headingBefore),
            afterPt: twipsToPt(theme.headingAfter),
            extraPt: HEADING_RULE_PT,
          }),
        );
      }
    }

    section.blocks.forEach((block) => {
      if (block.kind === 'entry') {
        const left = entryDisplayLeft(block) || textOf(block.id);
        const dateText = entryDisplayDate(block);
        if (left && dateText) {
          push(
            block.headingSourceLines,
            themeBlock(`${left}\t${dateText}`, {
              sizeHalfPoints: theme.bodySize,
              bold: true,
              beforePt: twipsToPt(theme.blockBefore),
              afterPt: twipsToPt(theme.blockAfter),
            }),
          );
        } else if (left || dateText) {
          push(
            block.headingSourceLines,
            themeBlock(left || dateText || '', {
              sizeHalfPoints: theme.bodySize,
              bold: true,
              beforePt: twipsToPt(theme.blockBefore),
              afterPt: twipsToPt(theme.blockAfter),
            }),
          );
        }
        block.bullets.forEach((bullet) => {
          const text = stripBulletMarker(textOf(bullet.id)).trim();
          if (!text) return;
          push(
            bullet.sourceLines,
            themeBlock(text, {
              sizeHalfPoints: theme.bodySize,
              widthPt: CONTENT_WIDTH_PT - twipsToPt(theme.bulletIndent),
              afterPt: twipsToPt(theme.bulletAfter),
            }),
          );
        });
        return;
      }

      if (block.kind === 'bullet') {
        const text = stripBulletMarker(textOf(block.id)).trim();
        if (!text) return;
        push(
          block.sourceLines,
          themeBlock(text, {
            sizeHalfPoints: theme.bodySize,
            widthPt: CONTENT_WIDTH_PT - twipsToPt(theme.bulletIndent),
            afterPt: twipsToPt(theme.bulletAfter),
          }),
        );
        return;
      }

      const text = textOf(block.id);
      if (!text) return;
      push(
        block.sourceLines,
        themeBlock(text, {
          sizeHalfPoints: theme.bodySize,
          bold: wasBold(block.sourceLines),
          afterPt: twipsToPt(
            block.kind === 'skillsGroup' ? theme.blockAfter : theme.paragraphAfter,
          ),
        }),
      );
    });
  });

  return restoreTableSegments(items, layout?.tables ?? []);
};

export const buildTemplateFlowSegments = (
  resumeText: string,
  scale = EXPORT_SCALE_DEFAULT,
): FlowSegment[] => {
  const theme = createResumeTheme(scale);
  const blocks: FlowBlock[] = [];
  let previousBlank = false;
  let contentIndex = 0;

  const lines = resumeText.split('\n');
  lines.forEach((line) => {
    if (line.trim().length === 0) {
      previousBlank = true;
      return;
    }

    const trimmed = line.trim();
    if (contentIndex === 0) {
      blocks.push(
        themeBlock(trimmed, {
          sizeHalfPoints: theme.nameSize,
          bold: true,
          afterPt: twipsToPt(theme.nameAfter),
        }),
      );
    } else if (contentIndex <= 3 && /@|\bwww\.|https?:|linkedin|github|(?:\d[\s().-]*){7,}/i.test(trimmed) && !isBulletLine(line)) {
      blocks.push(
        themeBlock(trimmed, {
          sizeHalfPoints: theme.contactSize,
          afterPt: twipsToPt(theme.contactAfter),
        }),
      );
    } else if (isBulletLine(line)) {
      blocks.push(
        themeBlock(stripBulletMarker(line).trim(), {
          sizeHalfPoints: theme.bodySize,
          widthPt: CONTENT_WIDTH_PT - twipsToPt(theme.bulletIndent),
          afterPt: twipsToPt(theme.bulletAfter),
        }),
      );
    } else if (isHeadingLine(line)) {
      blocks.push(
        themeBlock(trimmed.toUpperCase(), {
          sizeHalfPoints: theme.headingSize,
          bold: true,
          beforePt: twipsToPt(theme.headingBefore),
          afterPt: twipsToPt(theme.headingAfter),
          extraPt: HEADING_RULE_PT,
        }),
      );
    } else {
      blocks.push(
        themeBlock(trimmed, {
          sizeHalfPoints: theme.bodySize,
          beforePt: previousBlank ? twipsToPt(theme.blockBefore) : 0,
          afterPt: twipsToPt(theme.blockAfter),
        }),
      );
    }

    contentIndex += 1;
    previousBlank = false;
  });

  return [{ kind: 'blocks', blocks }];
};

const normalizeLine = (line: string): string =>
  line.replace(/^[\s\u00A0]*(?:[-–—•‣◦▪▫·∙●○*+>][\s\u00A0]*|\d{1,2}[.)][\s\u00A0]+)/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const intAttribute = (element: Element | null, localName: string): number | null => {
  if (!element) return null;
  const raw = element.getAttributeNS(WORD_NS, localName);
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const firstChildElement = (element: Element, localName: string): Element | null => {
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType !== 1) continue;
    const child = node as Element;
    if (child.namespaceURI === WORD_NS && child.localName === localName) return child;
  }
  return null;
};

const paragraphRunText = (paragraph: Element): string =>
  Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 't'))
    .map((node) => node.textContent ?? '')
    .join('');

const paragraphProperties = (paragraph: Element) => {
  const properties = firstChildElement(paragraph, 'pPr');
  const spacing = properties ? firstChildElement(properties, 'spacing') : null;
  const indent = properties ? firstChildElement(properties, 'indent') : null;
  return { spacing, indent };
};

const dominantRunSizeHalfPoints = (paragraph: Element, scale: number): number => {
  const runs = Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 'r')).filter(
    (run) => paragraphRunText(run).trim().length > 0,
  );
  const sizes = runs
    .map((run) => {
      const properties = firstChildElement(run, 'rPr');
      const size = properties ? firstChildElement(properties, 'sz') : null;
      return intAttribute(size, 'val');
    })
    .filter((value): value is number => value !== null);
  const base = sizes.length > 0 ? Math.max(...sizes) : 22;
  return Math.max(2, Math.round(base * scale));
};

const isBoldParagraph = (paragraph: Element): boolean => {
  const runs = Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 'r')).filter(
    (run) => paragraphRunText(run).trim().length > 0,
  );
  if (runs.length === 0) return false;
  return runs.every((run) => {
    const properties = firstChildElement(run, 'rPr');
    const bold = properties ? firstChildElement(properties, 'b') : null;
    if (!bold) return false;
    const value = bold.getAttributeNS(WORD_NS, 'val');
    return value !== '0' && value !== 'false';
  });
};

const paragraphFlowBlock = (paragraph: Element, text: string, scale: number): FlowBlock | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const { spacing, indent } = paragraphProperties(paragraph);
  const beforeTwips = intAttribute(spacing, 'before') ?? 0;
  const afterTwips = intAttribute(spacing, 'after') ?? 0;
  const leftTwips = intAttribute(indent, 'left') ?? 0;
  const hangingTwips = intAttribute(indent, 'hanging') ?? 0;
  const bulletIndentPt = Math.max(leftTwips, hangingTwips) * scale;
  const fontHalfPoints = dominantRunSizeHalfPoints(paragraph, scale);
  const numbered = paragraph.getElementsByTagNameNS(WORD_NS, 'numPr').length > 0;
  const widthPt = numbered
    ? CONTENT_WIDTH_PT - twipsToPt(bulletIndentPt)
    : CONTENT_WIDTH_PT;

  return {
    text: trimmed,
    fontPt: halfPointsToPt(fontHalfPoints),
    bold: isBoldParagraph(paragraph),
    widthPt,
    beforePt: twipsToPt(beforeTwips * scale),
    afterPt: twipsToPt(afterTwips * scale),
  };
};

export const buildKeepFlowBlocks = async (
  file: File,
  replacements: DocxReplacement[],
  insertions: DocxInsertion[],
  scale = EXPORT_SCALE_DEFAULT,
): Promise<FlowBlock[]> => {
  const clampedScale = clampExportScale(scale);
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) return [];

  const parsed = new DOMParser().parseFromString(await documentEntry.async('string'), 'application/xml');
  if (parsed.getElementsByTagName('parsererror').length > 0) return [];

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

  const paragraphs = Array.from(parsed.getElementsByTagNameNS(WORD_NS, 'p'));
  const blocks: FlowBlock[] = [];
  const usedAnchors = new Set<string>();

  paragraphs.forEach((paragraph, paragraphIndex) => {
    let text = paragraphRunText(paragraph);
    const normalized = normalizeLine(text);
    const tailored = replacementMap.get(normalized);
    if (tailored !== undefined) {
      if (tailored.length === 0) return;
      text = tailored;
    }

    const block = paragraphFlowBlock(paragraph, text, clampedScale);
    if (block) blocks.push(block);

    const textsToInsert = insertionsByAnchor.get(normalized);
    if (!textsToInsert || usedAnchors.has(normalized)) return;
    usedAnchors.add(normalized);

    const template =
      paragraphs.slice(0, paragraphIndex + 1).reverse().find((candidate) => hasNumbering(candidate)) ??
      paragraph;

    textsToInsert.forEach((insertionText) => {
      const clone = template.cloneNode(true) as Element;
      const resolved = hasNumbering(template)
        ? stripBulletMarker(insertionText).trim()
        : insertionText.trim();
      const inserted = paragraphFlowBlock(clone, resolved, clampedScale);
      if (inserted) blocks.push(inserted);
    });
  });

  return blocks;
};

const hasNumbering = (paragraph: Element): boolean =>
  paragraph.getElementsByTagNameNS(WORD_NS, 'numPr').length > 0;

export const estimateCleanPageCount = (
  resumeDocument: ResumeDocument | null,
  resumeText: string,
  textsByNodeId: Map<string, string>,
  layout: DocxCleanLayout | null | undefined,
  scale: number,
): number => {
  const segments = resumeDocument
    ? buildCleanFlowSegments(resumeDocument, textsByNodeId, layout, scale)
    : buildTemplateFlowSegments(resumeText, scale);
  return paginateSegments(segments);
};

export const estimateKeepPageCount = async (
  file: File,
  replacements: DocxReplacement[],
  insertions: DocxInsertion[],
  scale: number,
): Promise<number> => paginateBlocks(await buildKeepFlowBlocks(file, replacements, insertions, scale));

export const findMaxOnePageScale = (estimatePages: (scale: number) => number): number => {
  const steps: number[] = [];
  for (
    let scale = EXPORT_SCALE_MAX;
    scale >= EXPORT_SCALE_MIN - 0.001;
    scale -= EXPORT_SCALE_STEP
  ) {
    steps.push(clampExportScale(Number(scale.toFixed(2))));
  }

  for (const scale of steps) {
    if (estimatePages(scale) <= 1) return scale;
  }
  return EXPORT_SCALE_MIN;
};

export const isOriginalSinglePage = async (file: File): Promise<boolean> => {
  const blocks = await buildKeepFlowBlocks(file, [], [], EXPORT_SCALE_DEFAULT);
  return paginateBlocks(blocks) <= 1;
};

export type FitScaleInput = {
  resumeDocument: ResumeDocument | null;
  resumeText: string;
  textsByNodeId: Map<string, string>;
  layout: DocxCleanLayout | null | undefined;
  originalFile: File | null;
  replacements: DocxReplacement[];
  insertions: DocxInsertion[];
};

export const findMaxOnePageScaleAsync = async (
  estimatePages: (scale: number) => Promise<number>,
): Promise<number> => {
  const steps: number[] = [];
  for (
    let scale = EXPORT_SCALE_MAX;
    scale >= EXPORT_SCALE_MIN - 0.001;
    scale -= EXPORT_SCALE_STEP
  ) {
    steps.push(clampExportScale(Number(scale.toFixed(2))));
  }

  for (const scale of steps) {
    if ((await estimatePages(scale)) <= 1) return scale;
  }
  return EXPORT_SCALE_MIN;
};

export const computeFitToOnePageScale = async (input: FitScaleInput): Promise<number> => {
  const cleanScale = findMaxOnePageScale((scale) =>
    estimateCleanPageCount(
      input.resumeDocument,
      input.resumeText,
      input.textsByNodeId,
      input.layout,
      scale,
    ),
  );

  if (!input.originalFile) return cleanScale;

  const keepScale = await findMaxOnePageScaleAsync((scale) =>
    estimateKeepPageCount(input.originalFile!, input.replacements, input.insertions, scale),
  );
  return Math.min(cleanScale, keepScale);
};
