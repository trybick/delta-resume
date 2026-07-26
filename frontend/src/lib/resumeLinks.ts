export type LinkSegment = {
  text: string;
  href: string | null;
};

export type AnchorHrefs = Map<string, string>;

const URL_PATTERN =
  /\b(?:https?:\/\/[^\s<>()[\]{}"']+|www\.[^\s<>()[\]{}"']+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|(?:[\w-]+\.)+(?:com|org|net|io|dev|me|co|ai|app|xyz|info|edu|gov)(?:\/[^\s<>()[\]{}"']*)?)/gi;

const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;

const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

export const normalizeAnchorText = (text: string): string =>
  text
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const resolveHref = (raw: string): string | null => {
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^www\./i.test(raw)) return `https://${raw}`;
  if (raw.includes('@')) return `mailto:${raw}`;
  return `https://${raw}`;
};

const splitByUrls = (text: string): LinkSegment[] => {
  const segments: LinkSegment[] = [];
  let cursor = 0;
  URL_PATTERN.lastIndex = 0;

  for (let match = URL_PATTERN.exec(text); match !== null; match = URL_PATTERN.exec(text)) {
    const raw = match[0].replace(TRAILING_PUNCTUATION, '');
    const href = resolveHref(raw);
    if (href === null || raw.length === 0) continue;
    if (match.index > cursor) segments.push({ text: text.slice(cursor, match.index), href: null });
    segments.push({ text: raw, href });
    cursor = match.index + raw.length;
    URL_PATTERN.lastIndex = cursor;
  }

  if (cursor < text.length) segments.push({ text: text.slice(cursor), href: null });
  return segments;
};

type AnchorPattern = {
  pattern: RegExp;
  href: string;
};

// Anchor keys are whitespace-collapsed and lowercased, so matching them back
// against raw text needs a whitespace-tolerant, case-insensitive pattern.
const toAnchorPatterns = (anchorHrefs: AnchorHrefs): AnchorPattern[] =>
  [...anchorHrefs.entries()]
    .filter(([anchorText]) => anchorText.length > 1)
    .sort(([left], [right]) => right.length - left.length)
    .map(([anchorText, href]) => ({
      pattern: new RegExp(
        anchorText
          .split(' ')
          .map((word) => word.replace(REGEX_SPECIAL_CHARACTERS, '\\$&'))
          .join('\\s+'),
        'i',
      ),
      href,
    }));

type AnchorMatch = {
  start: number;
  text: string;
  href: string;
};

const findEarliestAnchor = (text: string, anchors: AnchorPattern[]): AnchorMatch | null => {
  let earliest: AnchorMatch | null = null;
  anchors.forEach(({ pattern, href }) => {
    const match = pattern.exec(text);
    if (!match) return;
    if (earliest !== null && match.index >= earliest.start) return;
    earliest = { start: match.index, text: match[0], href };
  });
  return earliest;
};

const splitByAnchors = (text: string, anchors: AnchorPattern[]): LinkSegment[] => {
  const segments: LinkSegment[] = [];
  let rest = text;

  while (rest.length > 0) {
    const anchor = findEarliestAnchor(rest, anchors);
    if (!anchor) {
      segments.push({ text: rest, href: null });
      break;
    }
    if (anchor.start > 0) segments.push({ text: rest.slice(0, anchor.start), href: null });
    segments.push({ text: anchor.text, href: anchor.href });
    rest = rest.slice(anchor.start + anchor.text.length);
  }

  return segments;
};

// A visible url always wins over an anchor guess, so anchor text is only matched
// inside the stretches that url detection left unlinked.
export const splitLinkSegments = (text: string, anchorHrefs?: AnchorHrefs): LinkSegment[] => {
  if (text.length === 0) return [];
  const anchors = anchorHrefs ? toAnchorPatterns(anchorHrefs) : [];
  const urlSegments = splitByUrls(text);
  const segments =
    anchors.length === 0
      ? urlSegments
      : urlSegments.flatMap((segment) =>
          segment.href === null ? splitByAnchors(segment.text, anchors) : [segment],
        );

  return segments.filter((segment) => segment.text.length > 0);
};
