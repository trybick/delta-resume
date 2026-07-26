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
};

export type DocxLayout = {
  lines: DocxLayoutLine[];
  tables: DocxTableInfo[];
  hrefByAnchorText: Map<string, string>;
};

export type DocxCleanLayout = {
  cellRefsByLine: Map<number, DocxCellRef>;
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
    if (child.localName === 'tab' || child.localName === 'br' || child.localName === 'cr') {
      text += ' ';
      return;
    }
    if (child.localName === 'noBreakHyphen') {
      text += '-';
      return;
    }
    if (child.localName === 'rPr' || child.localName === 'instrText') return;
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
      walker.lines.push({ text: paragraphText(child), cell });
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

  const walker: LayoutWalker = { lines: [], tables: [] };
  walkContainer(walker, body, null);

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

// The layout is keyed by position in the original document while the rest of the
// app is keyed by line index in the extracted resume text. The two only line up
// when the same file produced both, so an exact sequence match is required and
// anything else falls back to no table information at all.
export const buildCellRefsByLine = (
  layout: DocxLayout,
  resumeText: string,
): Map<number, DocxCellRef> => {
  const empty = new Map<number, DocxCellRef>();
  const layoutLines = layout.lines.filter((line) => line.text.trim().length > 0);
  const resumeLines = resumeText
    .split('\n')
    .map((text, lineIndex) => ({ text, lineIndex }))
    .filter((line) => line.text.trim().length > 0);

  if (layoutLines.length !== resumeLines.length) return empty;

  const cellRefsByLine = new Map<number, DocxCellRef>();
  for (let index = 0; index < resumeLines.length; index += 1) {
    const layoutLine = layoutLines[index];
    const resumeLine = resumeLines[index];
    if (normalizeForMatch(layoutLine.text) !== normalizeForMatch(resumeLine.text)) return empty;
    if (layoutLine.cell) cellRefsByLine.set(resumeLine.lineIndex, layoutLine.cell);
  }
  return cellRefsByLine;
};

export const readCleanLayout = async (file: File, resumeText: string): Promise<DocxCleanLayout> => {
  const layout = await readDocxLayout(file);
  return {
    cellRefsByLine: buildCellRefsByLine(layout, resumeText),
    tables: layout.tables,
    hrefByAnchorText: layout.hrefByAnchorText,
  };
};
