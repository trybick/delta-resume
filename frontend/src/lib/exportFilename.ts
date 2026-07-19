import type { ResumeStructure } from './types';

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
  structure?: ResumeStructure | null,
): string | null => {
  if (structure && structure.headerLines.length > 0) {
    const header = (lines[structure.headerLines[0]] ?? '').trim();
    if (header.length > 0) return header;
  }
  const firstLine = lines.find((line) => line.trim().length > 0);
  return firstLine?.trim() ?? null;
};
