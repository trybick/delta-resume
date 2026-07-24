import type {
  AddedBullet,
  BulletChange,
  ChangeDecision,
  ResumeBlock,
  ResumeBulletNode,
  ResumeDocument,
  ResumeEntry,
  ResumeSection,
} from './types';

const BULLET_MARKER = /^[\s\u00A0]*(?:[-–—•‣◦▪▫·∙●○*+>][\s\u00A0]*|\d{1,2}[.)][\s\u00A0]+)/;

const stripBulletMarker = (line: string): string => line.replace(BULLET_MARKER, '');

const isBulletLine = (line: string): boolean => {
  const trimmed = line.trim();
  const stripped = stripBulletMarker(line).trim();
  return stripped !== trimmed && stripped.length > 0;
};

export type DocumentTextLookup = {
  lines: string[];
  textForLines: (sourceLines: number[]) => string;
  textForNode: (nodeId: string) => string | null;
};

export const createLookup = (resumeText: string, document: ResumeDocument | null): DocumentTextLookup => {
  const lines = resumeText.split('\n');
  const textForLines = (sourceLines: number[]): string =>
    sourceLines
      .map((lineIndex) => (lines[lineIndex] ?? '').trim())
      .filter((line) => line.length > 0)
      .join(' ');

  const nodeLines = new Map<string, number[]>();

  const remember = (id: string, sourceLines: number[]) => {
    nodeLines.set(id, sourceLines);
  };

  if (document) {
    remember(document.header.name.id, document.header.name.sourceLines);
    document.header.contact.forEach((item) => remember(item.id, item.sourceLines));
    document.sections.forEach((section) => {
      if (section.heading) remember(section.heading.id, section.heading.sourceLines);
      section.blocks.forEach((block) => {
        if (block.kind === 'entry') {
          remember(block.id, block.headingSourceLines);
          block.bullets.forEach((bullet) => remember(bullet.id, bullet.sourceLines));
          return;
        }
        remember(block.id, block.sourceLines);
      });
    });
  }

  return {
    lines,
    textForLines,
    textForNode: (nodeId: string) => {
      const sourceLines = nodeLines.get(nodeId);
      if (!sourceLines) return null;
      return textForLines(sourceLines);
    },
  };
};

export const parseResumeDocument = (raw: unknown): ResumeDocument | null => {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      return parseResumeDocument(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object') return null;
  const value = raw as ResumeDocument;
  if (!value.header?.name?.id || !Array.isArray(value.sections)) return null;
  return value;
};

export type ReviewSegment =
  | { kind: 'change'; change: BulletChange }
  | { kind: 'added'; bullet: AddedBullet }
  | { kind: 'context'; nodeId: string; text: string; sourceLines: number[] };

const formatEntryHeading = (
  entry: ResumeEntry,
  lookup: DocumentTextLookup,
): string => {
  const parts = [entry.title, entry.organization, entry.location].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  );
  const dateText =
    entry.dates?.text ??
    [entry.dates?.start, entry.dates?.end].filter(Boolean).join(' – ');
  if (parts.length === 0 && !dateText) {
    return lookup.textForLines(entry.headingSourceLines);
  }
  const left = parts.join(', ');
  if (left && dateText) return `${left} ${dateText}`;
  return left || dateText || lookup.textForLines(entry.headingSourceLines);
};

export const buildReviewSegments = (
  resumeText: string,
  document: ResumeDocument | null | undefined,
  changes: BulletChange[],
  _decisions: Record<string, ChangeDecision>,
  addedBullets: AddedBullet[],
): ReviewSegment[] => {
  const lookup = createLookup(resumeText, document ?? null);
  const changesByTarget = new Map(changes.map((change) => [change.targetId, change]));
  const addedByAnchor = new Map<string, AddedBullet[]>();
  addedBullets.forEach((bullet) => {
    const group = addedByAnchor.get(bullet.afterId);
    if (group) {
      group.push(bullet);
      return;
    }
    addedByAnchor.set(bullet.afterId, [bullet]);
  });

  const pushAdded = (segments: ReviewSegment[], nodeId: string) => {
    const added = addedByAnchor.get(nodeId);
    if (!added) return;
    added.forEach((bullet) => segments.push({ kind: 'added', bullet }));
  };

  const pushNode = (
    segments: ReviewSegment[],
    nodeId: string,
    text: string,
    sourceLines: number[],
  ) => {
    const change = changesByTarget.get(nodeId);
    if (change) {
      segments.push({ kind: 'change', change });
    } else {
      segments.push({ kind: 'context', nodeId, text, sourceLines });
    }
    pushAdded(segments, nodeId);
  };

  if (!document) {
    const segments: ReviewSegment[] = [];
    const consumed = new Set<number>();
    changes.forEach((change) => {
      change.sourceLines.slice(1).forEach((lineIndex) => consumed.add(lineIndex));
    });
    const changesByLine = new Map(
      changes.map((change) => [change.sourceLines[0] ?? -1, change] as const),
    );
    lookup.lines.forEach((line, lineIndex) => {
      if (consumed.has(lineIndex)) return;
      const change = changesByLine.get(lineIndex);
      if (change) {
        segments.push({ kind: 'change', change });
        pushAdded(segments, change.targetId);
        return;
      }
      if (line.trim().length === 0) return;
      segments.push({
        kind: 'context',
        nodeId: `line.${lineIndex}`,
        text: line,
        sourceLines: [lineIndex],
      });
      pushAdded(segments, `line.${lineIndex}`);
    });
    return segments;
  }

  const segments: ReviewSegment[] = [];
  pushNode(
    segments,
    document.header.name.id,
    lookup.textForLines(document.header.name.sourceLines),
    document.header.name.sourceLines,
  );
  document.header.contact.forEach((item) => {
    pushNode(segments, item.id, lookup.textForLines(item.sourceLines), item.sourceLines);
  });

  document.sections.forEach((section) => {
    if (section.heading) {
      pushNode(
        segments,
        section.heading.id,
        lookup.textForLines(section.heading.sourceLines),
        section.heading.sourceLines,
      );
    }
    section.blocks.forEach((block) => {
      if (block.kind === 'entry') {
        pushNode(
          segments,
          block.id,
          formatEntryHeading(block, lookup),
          block.headingSourceLines,
        );
        block.bullets.forEach((bullet) => {
          pushNode(
            segments,
            bullet.id,
            lookup.textForLines(bullet.sourceLines),
            bullet.sourceLines,
          );
        });
        return;
      }
      pushNode(segments, block.id, lookup.textForLines(block.sourceLines), block.sourceLines);
    });
  });

  return segments;
};

const formatAddedBulletLine = (text: string, anchorLine: string | undefined): string => {
  const trimmed = (text ?? '').trim();
  if (trimmed.length === 0) return trimmed;
  if (isBulletLine(trimmed)) return trimmed;
  if (anchorLine !== undefined && isBulletLine(anchorLine)) {
    const prefix = anchorLine.slice(
      0,
      anchorLine.length - stripBulletMarker(anchorLine).length,
    );
    return `${prefix}${trimmed}`;
  }
  return trimmed.startsWith('-') ? trimmed : `- ${trimmed}`;
};

export type MergedResume = {
  lines: string[];
  document: ResumeDocument | null;
  textsByNodeId: Map<string, string>;
};

export const lineAnchorIndex = (nodeId: string): number | null => {
  const match = /^line\.(\d+)$/.exec(nodeId);
  return match ? Number(match[1]) : null;
};

export const applyDecisionsAndInsertions = (
  resumeText: string,
  document: ResumeDocument | null | undefined,
  changes: BulletChange[],
  decisions: Record<string, ChangeDecision>,
  addedBullets: AddedBullet[],
): MergedResume => {
  const lookup = createLookup(resumeText, document ?? null);
  const changesByTarget = new Map(changes.map((change) => [change.targetId, change]));
  const textsByNodeId = new Map<string, string>();

  const resolveNodeText = (nodeId: string, sourceLines: number[]): string => {
    const change = changesByTarget.get(nodeId);
    if (change && decisions[change.id] !== 'reverted') {
      textsByNodeId.set(nodeId, change.tailored);
      return change.tailored;
    }
    const original = lookup.textForLines(sourceLines);
    textsByNodeId.set(nodeId, original);
    return original;
  };

  const activeAdded = addedBullets.filter((bullet) => bullet.text.trim().length > 0);

  if (!document) {
    const consumed = new Set<number>();
    changes.forEach((change) => {
      change.sourceLines.slice(1).forEach((lineIndex) => consumed.add(lineIndex));
    });
    const changesByLine = new Map(
      changes.map((change) => [change.sourceLines[0] ?? -1, change] as const),
    );
    const addedByLine = new Map<number, AddedBullet[]>();
    activeAdded.forEach((bullet) => {
      const anchorIndex = lineAnchorIndex(bullet.afterId);
      const anchorFromChange =
        anchorIndex === null
          ? (changes.find((change) => change.targetId === bullet.afterId)?.sourceLines[0] ?? null)
          : anchorIndex;
      const resolvedIndex = anchorFromChange ?? lookup.lines.length - 1;
      const group = addedByLine.get(resolvedIndex);
      if (group) {
        group.push(bullet);
        return;
      }
      addedByLine.set(resolvedIndex, [bullet]);
    });

    const lines: string[] = [];
    lookup.lines.forEach((line, lineIndex) => {
      if (!consumed.has(lineIndex)) {
        const change = changesByLine.get(lineIndex);
        if (!change) {
          lines.push(line);
        } else if (decisions[change.id] === 'reverted') {
          lines.push(change.original);
        } else {
          lines.push(change.tailored);
        }
      }
      const added = addedByLine.get(lineIndex);
      if (added) {
        added.forEach((bullet) => {
          lines.push(formatAddedBulletLine(bullet.text, lookup.lines[lineIndex]));
        });
      }
    });
    return { lines, document: null, textsByNodeId };
  }

  const addedByAnchor = new Map<string, AddedBullet[]>();
  activeAdded.forEach((bullet) => {
    const group = addedByAnchor.get(bullet.afterId);
    if (group) {
      group.push(bullet);
      return;
    }
    addedByAnchor.set(bullet.afterId, [bullet]);
  });
  const claimedAnchors = new Set<string>();

  let syntheticIndex = 0;
  const nextSyntheticId = (prefix: string) => {
    syntheticIndex += 1;
    return `${prefix}.added.${syntheticIndex}`;
  };

  const syntheticBulletsFor = (anchorId: string): ResumeBulletNode[] => {
    const extras = addedByAnchor.get(anchorId);
    if (!extras || claimedAnchors.has(anchorId)) return [];
    claimedAnchors.add(anchorId);
    return extras.map((item) => {
      const id = nextSyntheticId(anchorId);
      const text = formatAddedBulletLine(item.text, textsByNodeId.get(anchorId));
      textsByNodeId.set(id, text);
      return { id, sourceLines: [] };
    });
  };

  const syntheticEntryFor = (anchorId: string): ResumeEntry | null => {
    const bullets = syntheticBulletsFor(anchorId);
    if (bullets.length === 0) return null;
    return {
      kind: 'entry',
      id: nextSyntheticId(anchorId),
      title: null,
      organization: null,
      location: null,
      dates: null,
      headingSourceLines: [],
      bullets,
    };
  };

  const mapBlock = (block: ResumeBlock): ResumeBlock[] => {
    if (block.kind === 'entry') {
      resolveNodeText(block.id, block.headingSourceLines);
      block.bullets.forEach((bullet) => resolveNodeText(bullet.id, bullet.sourceLines));
      const bullets: ResumeBulletNode[] = [
        ...syntheticBulletsFor(block.id),
        ...block.bullets.flatMap((bullet) => [bullet, ...syntheticBulletsFor(bullet.id)]),
      ];
      return [{ ...block, bullets }];
    }
    resolveNodeText(block.id, block.sourceLines);
    const trailingEntry = syntheticEntryFor(block.id);
    return trailingEntry ? [block, trailingEntry] : [block];
  };

  const sections: ResumeSection[] = document.sections.map((section) => {
    const leadingBlocks: ResumeBlock[] = [];
    if (section.heading) {
      resolveNodeText(section.heading.id, section.heading.sourceLines);
      const headingEntry = syntheticEntryFor(section.heading.id);
      if (headingEntry) leadingBlocks.push(headingEntry);
    }
    const blocks = [...leadingBlocks, ...section.blocks.flatMap(mapBlock)];
    return { ...section, blocks };
  });

  resolveNodeText(document.header.name.id, document.header.name.sourceLines);
  document.header.contact.forEach((item) =>
    resolveNodeText(item.id, item.sourceLines),
  );

  // Anchors that matched no node (stale requirement data) land at the end of the
  // last section rather than being silently dropped.
  const unclaimedAnchors = [...addedByAnchor.keys()].filter(
    (anchorId) => !claimedAnchors.has(anchorId),
  );
  if (unclaimedAnchors.length > 0 && sections.length > 0) {
    const lastSection = sections[sections.length - 1];
    unclaimedAnchors.forEach((anchorId) => {
      const entry = syntheticEntryFor(anchorId);
      if (entry) lastSection.blocks = [...lastSection.blocks, entry];
    });
  }

  const mergedDocument: ResumeDocument = {
    ...document,
    sections,
  };

  const lines: string[] = [];
  const emit = (text: string) => {
    if (text.length > 0) lines.push(text);
  };

  emit(textsByNodeId.get(mergedDocument.header.name.id) ?? '');
  mergedDocument.header.contact.forEach((item) => {
    emit(textsByNodeId.get(item.id) ?? '');
  });
  lines.push('');

  mergedDocument.sections.forEach((section) => {
    if (section.heading) {
      emit(textsByNodeId.get(section.heading.id) ?? '');
      lines.push('');
    }
    section.blocks.forEach((block) => {
      if (block.kind === 'entry') {
        emit(textsByNodeId.get(block.id) ?? '');
        block.bullets.forEach((bullet) => emit(textsByNodeId.get(bullet.id) ?? ''));
        lines.push('');
        return;
      }
      emit(textsByNodeId.get(block.id) ?? '');
    });
    lines.push('');
  });

  return {
    lines: lines.join('\n').replace(/\n{3,}/g, '\n\n').split('\n'),
    document: mergedDocument,
    textsByNodeId,
  };
};

export const entryDisplayLeft = (entry: ResumeEntry): string => {
  const parts = [entry.title, entry.organization, entry.location].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  );
  return parts.join(', ');
};

export const entryDisplayDate = (entry: ResumeEntry): string | null => {
  if (entry.dates?.text) return entry.dates.text;
  const start = entry.dates?.start;
  const end = entry.dates?.end;
  if (start && end) return `${start} – ${end}`;
  return start ?? end ?? null;
};
