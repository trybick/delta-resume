import type { ResumeDocument } from './types';

export const slugifyFilenamePart = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

export const buildExportFilename = (
  parts: Array<string | null | undefined>,
  fallback: string,
  extension: 'docx' | 'pdf',
): string => {
  const slugs = parts
    .map((part) => (part ? slugifyFilenamePart(part) : ''))
    .filter((slug) => slug.length > 0);
  const base = slugs.length > 0 ? slugs.join('-') : fallback;
  return `${base}.${extension}`;
};

export const extractCandidateNameFromResume = (
  lines: string[],
  document?: ResumeDocument | null,
  textsByNodeId?: Map<string, string>,
): string | null => {
  if (document) {
    const fromMap = textsByNodeId?.get(document.header.name.id)?.trim();
    if (fromMap) return fromMap;
    const fromLines = document.header.name.sourceLines
      .map((lineIndex) => (lines[lineIndex] ?? '').trim())
      .filter((line) => line.length > 0)
      .join(' ');
    if (fromLines) return fromLines;
  }
  const firstLine = lines.find((line) => line.trim().length > 0);
  return firstLine?.trim() ?? null;
};
