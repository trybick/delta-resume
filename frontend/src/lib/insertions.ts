import { isBulletLine, stripBulletMarker } from './exportDocx';
import type { AddedBullet, ResumeStructure } from './types';

const anchorPrefix = (anchorLine: string): string =>
  anchorLine.slice(0, anchorLine.length - stripBulletMarker(anchorLine).length);

export const formatAddedBulletLine = (text: string, anchorLine: string | undefined): string => {
  const trimmed = (text ?? '').trim();
  if (trimmed.length === 0) return trimmed;
  if (isBulletLine(trimmed)) return trimmed;
  if (anchorLine !== undefined && isBulletLine(anchorLine)) {
    return `${anchorPrefix(anchorLine)}${trimmed}`;
  }
  return trimmed;
};

const clampAfterLineIndex = (index: number, lineCount: number): number =>
  Math.max(0, Math.min(index, lineCount - 1));

const groupByAnchor = (
  addedBullets: AddedBullet[],
  lineCount: number,
): Map<number, AddedBullet[]> => {
  const groups = new Map<number, AddedBullet[]>();
  addedBullets.forEach((bullet) => {
    const afterLineIndex =
      lineCount === 0 ? 0 : clampAfterLineIndex(bullet.afterLineIndex, lineCount);
    const group = groups.get(afterLineIndex);
    if (group) {
      group.push(bullet);
      return;
    }
    groups.set(afterLineIndex, [bullet]);
  });
  return groups;
};

type InsertionResult = {
  lines: string[];
  structure: ResumeStructure | null;
};

const remapStructure = (
  structure: ResumeStructure,
  oldToNew: number[],
  insertedIndexesByAnchor: Map<number, number[]>,
): ResumeStructure => {
  const claimed = new Set<number>();

  const bulletItemsFor = (anchorIndex: number) => {
    if (claimed.has(anchorIndex)) return [];
    const insertedIndexes = insertedIndexesByAnchor.get(anchorIndex);
    if (!insertedIndexes) return [];
    claimed.add(anchorIndex);
    return insertedIndexes.map((lineIndex) => ({
      kind: 'bullet' as const,
      lines: [lineIndex],
    }));
  };

  const sections = structure.sections.map((section) => {
    const headingInserts = section.headingLine === null ? [] : bulletItemsFor(section.headingLine);
    return {
      headingLine:
        section.headingLine === null ? null : (oldToNew[section.headingLine] ?? section.headingLine),
      items: [
        ...headingInserts,
        ...section.items.flatMap((item) => {
          const remappedItem = {
            kind: item.kind,
            lines: item.lines.map((lineIndex) => oldToNew[lineIndex] ?? lineIndex),
          };
          const inserted = item.lines.flatMap(bulletItemsFor);
          return [remappedItem, ...inserted];
        }),
      ],
    };
  });

  const unclaimedItems = [...insertedIndexesByAnchor.keys()]
    .filter((anchorIndex) => !claimed.has(anchorIndex))
    .flatMap(bulletItemsFor);

  if (unclaimedItems.length > 0 && sections.length > 0) {
    const lastSection = sections[sections.length - 1];
    lastSection.items = [...lastSection.items, ...unclaimedItems];
  }

  return {
    headerLines: structure.headerLines.map((lineIndex) => oldToNew[lineIndex] ?? lineIndex),
    sections,
  };
};

export const applyAddedBullets = (
  lines: string[],
  structure: ResumeStructure | null | undefined,
  addedBullets: AddedBullet[],
): InsertionResult => {
  if (addedBullets.length === 0) {
    return { lines, structure: structure ?? null };
  }

  const groups = groupByAnchor(addedBullets, lines.length);
  const mergedLines: string[] = [];
  const oldToNew: number[] = [];
  const insertedIndexesByAnchor = new Map<number, number[]>();

  if (lines.length === 0) {
    const group = groups.get(0);
    if (group) {
      const insertedIndexes: number[] = [];
      group.forEach((bullet) => {
        insertedIndexes.push(mergedLines.length);
        mergedLines.push(formatAddedBulletLine(bullet.text, undefined));
      });
      insertedIndexesByAnchor.set(0, insertedIndexes);
    }
  } else {
    lines.forEach((line, lineIndex) => {
      oldToNew[lineIndex] = mergedLines.length;
      mergedLines.push(line);
      const group = groups.get(lineIndex);
      if (!group) return;
      const insertedIndexes: number[] = [];
      group.forEach((bullet) => {
        insertedIndexes.push(mergedLines.length);
        mergedLines.push(formatAddedBulletLine(bullet.text, line));
      });
      insertedIndexesByAnchor.set(lineIndex, insertedIndexes);
    });
  }

  return {
    lines: mergedLines,
    structure: structure ? remapStructure(structure, oldToNew, insertedIndexesByAnchor) : null,
  };
};
