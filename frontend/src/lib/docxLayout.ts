import JSZip from 'jszip';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const RELATIONSHIPS_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_RELATIONSHIPS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

export type DocxCellRef = {
  tableIndex: number;
  rowIndex: number;
  columnIndex: number;
  columnCount: number;
};

export type DocxTableInfo = {
  columnCount: number;
  columnWidths: number[] | null;
};

export type DocxLayoutLine = {
  text: string;
  cell: DocxCellRef | null;
  bold: boolean;
};

export type DocxLayout = {
  lines: DocxLayoutLine[];
  tables: DocxTableInfo[];
  hrefByAnchorText: Map<string, string>;
};

export type DocxCleanLayout = {
  cellRefsByLine: Map<number, DocxCellRef>;
  boldLines: Set<number>;
  tables: DocxTableInfo[];
  hrefByAnchorText: Map<string, string>;
};

const normalizeForMatch = (text: string): string =>
  text
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const childElements = (element: Element, localName: string): Element[] =>
  Array.from(element.childNodes).filter(
    (node): node is Element =>
      node.nodeType === 1 &&
      (node as Element).namespaceURI === WORD_NS &&
      (node as Element).localName === localName,
  );

const firstChildElement = (element: Element, localName: string): Element | null =>
  childElements(element, localName)[0] ?? null;

const intAttribute = (element: Element | null, localName: string): number | null => {
  if (!element) return null;
  const raw = element.getAttributeNS(WORD_NS, localName);
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

// Line text exists only to match against the mammoth-extracted resume text, so
// it has to drop tabs and breaks exactly the way mammoth's raw text does.
const runText = (element: Element): string => {
  let text = '';
  Array.from(element.childNodes).forEach((node) => {
    if (node.nodeType !== 1) return;
    const child = node as Element;
    if (child.namespaceURI !== WORD_NS) {
      text += runText(child);
      return;
    }
    if (child.localName === 't') {
      text += child.textContent ?? '';
      return;
    }
    if (child.localName === 'tab') {
      text += ' ';
      return;
    }
    if (child.localName === 'noBreakHyphen') {
      text += '-';
      return;
    }
    if (
      child.localName === 'br' ||
      child.localName === 'cr' ||
      child.localName === 'rPr' ||
      child.localName === 'instrText'
    ) {
      return;
    }
    text += runText(child);
  });
  return text;
};

const paragraphText = (paragraph: Element): string => runText(paragraph).trim();

const readRelationshipTargets = async (zip: JSZip): Promise<Map<string, string>> => {
  const targets = new Map<string, string>();
  const entry = zip.file('word/_rels/document.xml.rels');
  if (!entry) return targets;
  const parsed = new DOMParser().parseFromString(await entry.async('string'), 'application/xml');
  Array.from(parsed.getElementsByTagNameNS(PACKAGE_RELATIONSHIPS_NS, 'Relationship')).forEach(
    (relationship) => {
      const id = relationship.getAttribute('Id');
      const target = relationship.getAttribute('Target');
      const mode = relationship.getAttribute('TargetMode');
      if (!id || !target || mode !== 'External') return;
      targets.set(id, target);
    },
  );
  return targets;
};

const FIELD_HYPERLINK_PATTERN = /HYPERLINK\s+"([^"]+)"/i;

const collectHyperlinks = (
  body: Element,
  relationshipTargets: Map<string, string>,
): Map<string, string> => {
  const hrefByAnchorText = new Map<string, string>();

  const remember = (anchorText: string, href: string) => {
    const key = normalizeForMatch(anchorText);
    if (key.length === 0 || hrefByAnchorText.has(key)) return;
    hrefByAnchorText.set(key, href);
  };

  Array.from(body.getElementsByTagNameNS(WORD_NS, 'hyperlink')).forEach((hyperlink) => {
    const relationshipId = hyperlink.getAttributeNS(RELATIONSHIPS_NS, 'id');
    if (!relationshipId) return;
    const href = relationshipTargets.get(relationshipId);
    if (!href) return;
    remember(runText(hyperlink), href);
  });

  // Older documents encode links as HYPERLINK fields: an instrText run holding the
  // url, then the display runs, then a fldChar "end" run.
  const instructions = Array.from(body.getElementsByTagNameNS(WORD_NS, 'instrText'));
  instructions.forEach((instruction) => {
    const match = FIELD_HYPERLINK_PATTERN.exec(instruction.textContent ?? '');
    if (!match) return;
    const run = instruction.parentElement;
    if (!run) return;
    let anchorText = '';
    let sibling = run.nextElementSibling;
    while (sibling) {
      if (sibling.namespaceURI === WORD_NS && sibling.localName === 'r') {
        const isFieldEnd = Array.from(sibling.getElementsByTagNameNS(WORD_NS, 'fldChar')).some(
          (fieldChar) => fieldChar.getAttributeNS(WORD_NS, 'fldCharType') === 'end',
        );
        if (isFieldEnd) break;
        anchorText += runText(sibling);
      }
      sibling = sibling.nextElementSibling;
    }
    remember(anchorText, match[1]);
  });

  return hrefByAnchorText;
};

type LayoutWalker = {
  lines: DocxLayoutLine[];
  sources: Element[];
  tables: DocxTableInfo[];
};

const tableColumnWidths = (table: Element): number[] | null => {
  const grid = firstChildElement(table, 'tblGrid');
  if (!grid) return null;
  const widths = childElements(grid, 'gridCol')
    .map((column) => intAttribute(column, 'w'))
    .filter((width): width is number => width !== null && width > 0);
  return widths.length > 0 ? widths : null;
};

// A line counts as bold only when every one of its text runs is bold, which is
// what distinguishes a group heading from a sentence with emphasis in it.
const isBoldParagraph = (paragraph: Element): boolean => {
  const runs = childElements(paragraph, 'r').filter((run) => runText(run).trim().length > 0);
  if (runs.length === 0) return false;
  return runs.every((run) => {
    const properties = firstChildElement(run, 'rPr');
    const bold = properties ? firstChildElement(properties, 'b') : null;
    if (!bold) return false;
    const value = bold.getAttributeNS(WORD_NS, 'val');
    return value === null || value === '1' || value === 'true' || value === 'on';
  });
};

const cellSpan = (cell: Element): number => {
  const properties = firstChildElement(cell, 'tcPr');
  if (!properties) return 1;
  const span = intAttribute(firstChildElement(properties, 'gridSpan'), 'val');
  return span !== null && span > 0 ? span : 1;
};

const walkTable = (walker: LayoutWalker, table: Element): void => {
  const rows = childElements(table, 'tr');
  const gridWidths = tableColumnWidths(table);
  const spannedColumnCount = rows.reduce((widest, row) => {
    const span = childElements(row, 'tc').reduce((total, cell) => total + cellSpan(cell), 0);
    return Math.max(widest, span);
  }, 0);
  const columnCount = Math.max(gridWidths?.length ?? 0, spannedColumnCount, 1);

  const tableIndex = walker.tables.length;
  walker.tables.push({
    columnCount,
    columnWidths: gridWidths?.length === columnCount ? gridWidths : null,
  });

  rows.forEach((row, rowIndex) => {
    let columnIndex = 0;
    childElements(row, 'tc').forEach((cell) => {
      const cellRef: DocxCellRef = {
        tableIndex,
        rowIndex,
        columnIndex: Math.min(columnIndex, columnCount - 1),
        columnCount,
      };
      walkContainer(walker, cell, cellRef);
      columnIndex += cellSpan(cell);
    });
  });
};

const walkContainer = (
  walker: LayoutWalker,
  container: Element,
  cell: DocxCellRef | null,
): void => {
  Array.from(container.childNodes).forEach((node) => {
    if (node.nodeType !== 1) return;
    const child = node as Element;
    if (child.namespaceURI !== WORD_NS) return;
    if (child.localName === 'p') {
      walker.lines.push({ text: paragraphText(child), cell, bold: isBoldParagraph(child) });
      walker.sources.push(child);
      return;
    }
    if (child.localName === 'tbl') {
      walkTable(walker, child);
      return;
    }
    if (child.localName === 'sdt') {
      const content = firstChildElement(child, 'sdtContent');
      if (content) walkContainer(walker, content, cell);
    }
  });
};

type ColumnSection = {
  paragraphs: Element[];
  columnCount: number;
  columnWidths: number[] | null;
};

const sectionColumns = (
  sectionProperties: Element,
): { columnCount: number; columnWidths: number[] | null } => {
  const columns = firstChildElement(sectionProperties, 'cols');
  if (!columns) return { columnCount: 1, columnWidths: null };
  const specs = childElements(columns, 'col');
  const columnCount = Math.max(intAttribute(columns, 'num') ?? 0, specs.length, 1);
  const widths = specs
    .map((column) => intAttribute(column, 'w'))
    .filter((width): width is number => width !== null && width > 0);
  return { columnCount, columnWidths: widths.length === columnCount ? widths : null };
};

// A sectPr describes the section that ends with it, so body content accumulates
// until one shows up: either on the last paragraph of the section or, for the
// final section, as the last child of the body.
const readColumnSections = (body: Element): ColumnSection[] => {
  const sections: ColumnSection[] = [];
  let current: Element[] = [];

  Array.from(body.childNodes).forEach((node) => {
    if (node.nodeType !== 1) return;
    const child = node as Element;
    if (child.namespaceURI !== WORD_NS) return;

    if (child.localName === 'sectPr') {
      sections.push({ paragraphs: current, ...sectionColumns(child) });
      current = [];
      return;
    }

    current.push(child);
    if (child.localName !== 'p') return;
    const properties = firstChildElement(child, 'pPr');
    const sectionProperties = properties ? firstChildElement(properties, 'sectPr') : null;
    if (!sectionProperties) return;
    sections.push({ paragraphs: current, ...sectionColumns(sectionProperties) });
    current = [];
  });

  return sections.filter((section) => section.columnCount > 1);
};

const hasColumnBreak = (paragraph: Element): boolean =>
  Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 'br')).some(
    (lineBreak) => lineBreak.getAttributeNS(WORD_NS, 'type') === 'column',
  );

const balancedColumnStarts = (total: number, columnCount: number): number[] => {
  const base = Math.floor(total / columnCount);
  const remainder = total % columnCount;
  const starts: number[] = [];
  let cursor = 0;
  for (let column = 0; column < columnCount; column += 1) {
    starts.push(cursor);
    cursor += base + (column < remainder ? 1 : 0);
  }
  return starts;
};

// Word decides where newspaper columns break at render time, so recover the
// split from an explicit column break, then from bold group headings, and only
// fall back to the even balance Word itself applies to a continuous section.
const columnStartsFor = (
  entries: { paragraph: Element; breakBefore: boolean }[],
  columnCount: number,
): number[] => {
  const breakStarts = entries.flatMap((entry, index) =>
    index === 0 || entry.breakBefore ? [index] : [],
  );
  if (breakStarts.length === columnCount) return breakStarts;

  const boldStarts = entries.flatMap((entry, index) =>
    isBoldParagraph(entry.paragraph) ? [index] : [],
  );
  if (boldStarts.length === columnCount && boldStarts[0] === 0) return boldStarts;

  return balancedColumnStarts(entries.length, columnCount);
};

const applyColumnSections = (walker: LayoutWalker, body: Element): void => {
  const lineIndexBySource = new Map<Element, number>();
  walker.sources.forEach((source, index) => {
    if (!lineIndexBySource.has(source)) lineIndexBySource.set(source, index);
  });

  readColumnSections(body).forEach((section) => {
    const entries: { lineIndex: number; paragraph: Element; breakBefore: boolean }[] = [];
    let pendingBreak = false;

    section.paragraphs.forEach((paragraph) => {
      if (paragraph.localName !== 'p') return;
      const breakHere = hasColumnBreak(paragraph);
      const lineIndex = lineIndexBySource.get(paragraph);
      const line = lineIndex === undefined ? null : walker.lines[lineIndex];
      if (lineIndex === undefined || !line || line.cell !== null || line.text.length === 0) {
        pendingBreak = pendingBreak || breakHere;
        return;
      }
      entries.push({ lineIndex, paragraph, breakBefore: pendingBreak || breakHere });
      pendingBreak = false;
    });

    if (entries.length < section.columnCount) return;

    const starts = columnStartsFor(entries, section.columnCount);
    const tableIndex = walker.tables.length;
    walker.tables.push({
      columnCount: section.columnCount,
      columnWidths: section.columnWidths,
    });

    entries.forEach((entry, index) => {
      const columnIndex = starts.reduce(
        (found, start, column) => (index >= start ? column : found),
        0,
      );
      walker.lines[entry.lineIndex].cell = {
        tableIndex,
        rowIndex: 0,
        columnIndex,
        columnCount: section.columnCount,
      };
    });
  });
};

const readLayout = async (file: File): Promise<DocxLayout> => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) throw new Error('missing document.xml');

  const parsed = new DOMParser().parseFromString(
    await documentEntry.async('string'),
    'application/xml',
  );
  if (parsed.getElementsByTagName('parsererror').length > 0) {
    throw new Error('could not parse document.xml');
  }

  const body = parsed.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body) throw new Error('missing document body');

  const walker: LayoutWalker = { lines: [], sources: [], tables: [] };
  walkContainer(walker, body, null);
  applyColumnSections(walker, body);

  return {
    lines: walker.lines,
    tables: walker.tables,
    hrefByAnchorText: collectHyperlinks(body, await readRelationshipTargets(zip)),
  };
};

const layoutCache = new WeakMap<File, Promise<DocxLayout>>();

export const readDocxLayout = (file: File): Promise<DocxLayout> => {
  const cached = layoutCache.get(file);
  if (cached) return cached;
  const pending = readLayout(file);
  layoutCache.set(file, pending);
  return pending;
};

const MAX_ALIGNMENT_CELLS = 4_000_000;

// Pairs up two line sequences by longest common subsequence. Matching on order
// rather than position means a line the two extractors disagree on only costs
// that one line, and repeated text (two cells both reading "React") still lands
// on the right occurrence.
const alignSequences = (left: string[], right: string[]): Map<number, number> => {
  const pairs = new Map<number, number>();
  const rows = left.length;
  const columns = right.length;
  if (rows === 0 || columns === 0 || rows * columns > MAX_ALIGNMENT_CELLS) return pairs;

  const width = columns + 1;
  const lengths = new Uint32Array((rows + 1) * width);
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      lengths[row * width + column] =
        left[row] === right[column]
          ? lengths[(row + 1) * width + column + 1] + 1
          : Math.max(lengths[(row + 1) * width + column], lengths[row * width + column + 1]);
    }
  }

  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (left[row] === right[column]) {
      pairs.set(row, column);
      row += 1;
      column += 1;
      continue;
    }
    if (lengths[(row + 1) * width + column] >= lengths[row * width + column + 1]) {
      row += 1;
      continue;
    }
    column += 1;
  }
  return pairs;
};

// The layout is keyed by position in the original document while the rest of the
// app is keyed by line index in the extracted resume text.
export const buildLineMetadata = (
  layout: DocxLayout,
  resumeText: string,
): { cellRefsByLine: Map<number, DocxCellRef>; boldLines: Set<number> } => {
  const layoutLines = layout.lines.filter((line) => line.text.trim().length > 0);
  const resumeLines = resumeText
    .split('\n')
    .map((text, lineIndex) => ({ text, lineIndex }))
    .filter((line) => line.text.trim().length > 0);

  const pairs = alignSequences(
    layoutLines.map((line) => normalizeForMatch(line.text)),
    resumeLines.map((line) => normalizeForMatch(line.text)),
  );

  const cellRefsByLine = new Map<number, DocxCellRef>();
  const boldLines = new Set<number>();
  pairs.forEach((resumeIndex, layoutIndex) => {
    const layoutLine = layoutLines[layoutIndex];
    const { lineIndex } = resumeLines[resumeIndex];
    if (layoutLine.cell) cellRefsByLine.set(lineIndex, layoutLine.cell);
    if (layoutLine.bold) boldLines.add(lineIndex);
  });
  return { cellRefsByLine, boldLines };
};

export const readCleanLayout = async (file: File, resumeText: string): Promise<DocxCleanLayout> => {
  const layout = await readDocxLayout(file);
  return {
    ...buildLineMetadata(layout, resumeText),
    tables: layout.tables,
    hrefByAnchorText: layout.hrefByAnchorText,
  };
};
