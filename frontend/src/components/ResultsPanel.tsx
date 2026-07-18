import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Center,
  Collapse,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowsVertical,
  IconBolt,
  IconChevronDown,
  IconCircleCheck,
  IconCopy,
  IconCopyCheck,
  IconDownload,
  IconEye,
  IconFileDescription,
  IconFileText,
  IconFileTypePdf,
  IconList,
  IconLock,
  IconPlus,
  IconSparkles,
  IconTargetArrow,
} from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { appTheme } from '../lib/theme';
import type {
  AddedBullet,
  BulletChange,
  ChangeDecision,
  JobRequirement,
  TailorResult,
  TailorStatus,
} from '../lib/types';
import { copyResumeRichText } from '../lib/copyResume';
import { applyAddedBullets } from '../lib/insertions';
import {
  buildStructuredDocx,
  buildTemplateDocx,
  downloadDocx,
  normalizeResumeTextForComparison,
  patchOriginalDocx,
} from '../lib/exportDocx';
import { convertDocxToPdfWithFallback, downloadPdf } from '../lib/exportPdf';
import AddedBulletRow from './AddedBulletRow';
import DiffBullet from './DiffBullet';
import DocumentPreviewModal, { type PreviewVariant } from './DocumentPreviewModal';
import TailoringLoader from './TailoringLoader';

type OriginalDocx = {
  file: File;
  parsedText: string;
};

type ResultsPanelProps = {
  status: TailorStatus;
  result: TailorResult | null;
  isExample?: boolean;
  isProPlan: boolean;
  originalDocx?: OriginalDocx | null;
  onShowExample?: () => void;
  onUpgradeClick: () => void;
};

const buildDecisionMap = (result: TailorResult | null): Record<string, ChangeDecision> => {
  if (!result) return {};
  return Object.fromEntries(result.changes.map((change) => [change.id, 'accepted']));
};

const CONTEXT_LINES_PER_SIDE = 2;
const MIN_HIDDEN_LINES = 3;

type ContextSplit = {
  leading: string[];
  hidden: string[];
  trailing: string[];
};

const isBlankLine = (line: string) => line.trim() === '';

type TrimmedSegment = {
  lines: string[];
  offset: number;
};

const trimBlankEdges = (lines: string[]): TrimmedSegment => {
  let start = 0;
  while (start < lines.length && isBlankLine(lines[start])) {
    start += 1;
  }
  let end = lines.length;
  while (end > start && isBlankLine(lines[end - 1])) {
    end -= 1;
  }
  return { lines: lines.slice(start, end), offset: start };
};

const splitContextLines = (lines: string[], collapsed: boolean): ContextSplit => {
  const expandedSplit: ContextSplit = { leading: lines, hidden: [], trailing: [] };
  if (!collapsed || lines.length < CONTEXT_LINES_PER_SIDE * 2 + MIN_HIDDEN_LINES) {
    return expandedSplit;
  }
  let leadingEnd = CONTEXT_LINES_PER_SIDE;
  while (leadingEnd > 0 && isBlankLine(lines[leadingEnd - 1])) {
    leadingEnd -= 1;
  }
  let trailingStart = lines.length - CONTEXT_LINES_PER_SIDE;
  while (trailingStart < lines.length && isBlankLine(lines[trailingStart])) {
    trailingStart += 1;
  }
  const hidden = lines.slice(leadingEnd, trailingStart);
  if (hidden.length < MIN_HIDDEN_LINES) return expandedSplit;
  return {
    leading: lines.slice(0, leadingEnd),
    hidden,
    trailing: lines.slice(trailingStart),
  };
};

type ResumeSegment =
  | { kind: 'change'; change: BulletChange }
  | { kind: 'added'; bullet: AddedBullet }
  | { kind: 'context'; startIndex: number; lines: string[] };

const buildSegments = (
  lines: string[],
  changesByLine: Map<number, BulletChange>,
  addedByAnchor: Map<number, AddedBullet[]>,
): ResumeSegment[] => {
  const segments: ResumeSegment[] = [];
  lines.forEach((line, lineIndex) => {
    const change = changesByLine.get(lineIndex);
    if (change) {
      segments.push({ kind: 'change', change });
    } else {
      const previousSegment = segments[segments.length - 1];
      if (previousSegment && previousSegment.kind === 'context') {
        previousSegment.lines.push(line);
      } else {
        segments.push({ kind: 'context', startIndex: lineIndex, lines: [line] });
      }
    }
    const addedBullets = addedByAnchor.get(lineIndex);
    if (addedBullets) {
      addedBullets.forEach((bullet) => segments.push({ kind: 'added', bullet }));
    }
  });
  return segments;
};

const ContextLine = ({ line }: { line: string }) => (
  <Text
    c="dimmed"
    style={{
      fontFamily: 'ui-monospace, monospace',
      fontSize: 'var(--mantine-font-size-xs)',
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
    }}
  >
    {line.trim() === '' ? '\u00A0' : line}
  </Text>
);

type CollapsedContextProps = {
  hiddenCount: number;
  onExpand: () => void;
};

type GapRowProps = {
  requirement: JobRequirement;
  addedBullet?: AddedBullet;
  onAdd?: (requirement: JobRequirement) => void;
  onUndo?: (id: string) => void;
};

const hasDraftBullet = (
  requirement: JobRequirement,
): requirement is JobRequirement & { draftBullet: string; insertAfterLine: number } =>
  typeof requirement.draftBullet === 'string' &&
  requirement.draftBullet.length > 0 &&
  typeof requirement.insertAfterLine === 'number';

const GapRow = ({ requirement, addedBullet, onAdd, onUndo }: GapRowProps) => {
  const canAdd = onAdd !== undefined && addedBullet === undefined && hasDraftBullet(requirement);

  return (
    <Stack gap={2}>
      <Group gap="xs" wrap="nowrap" align="center">
        <Badge
          size="xs"
          variant="light"
          color={requirement.importance === 'must' ? 'orange' : 'gray'}
          style={{ flexShrink: 0 }}
        >
          {requirement.importance === 'must' ? 'Must-have' : 'Nice-to-have'}
        </Badge>
        <Text size="sm" fw={500} style={{ flex: 1, minWidth: 0 }}>
          {requirement.text}
        </Text>
        {addedBullet && onUndo && (
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            <IconCircleCheck size={14} color="var(--mantine-color-green-5)" />
            <Text size="xs" fw={600} c="green.5">
              Added
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              onClick={() => onUndo(addedBullet.id)}
            >
              Undo
            </Button>
          </Group>
        )}
        {canAdd && (
          <Button
            size="compact-xs"
            variant="light"
            leftSection={<IconPlus size={12} />}
            style={{ flexShrink: 0 }}
            onClick={() => onAdd(requirement)}
          >
            Add to resume
          </Button>
        )}
      </Group>
      {requirement.gapHint && !addedBullet && (
        <Text size="xs" c="dimmed">
          {requirement.gapHint}
        </Text>
      )}
    </Stack>
  );
};

type CollapsibleInsightProps = {
  open: boolean;
  onToggle: () => void;
  icon: ReactNode;
  label: string;
  labelColor: string;
  borderColor: string;
  background: string;
  ariaLabel: string;
  children: ReactNode;
};

const CollapsibleInsight = ({
  open,
  onToggle,
  icon,
  label,
  labelColor,
  borderColor,
  background,
  ariaLabel,
  children,
}: CollapsibleInsightProps) => (
  <Paper
    component="section"
    aria-label={ariaLabel}
    px="md"
    py="xs"
    style={{
      borderLeft: `2px solid ${borderColor}`,
      borderRadius: '0 var(--mantine-radius-md) var(--mantine-radius-md) 0',
      background,
    }}
  >
    <UnstyledButton onClick={onToggle} w="100%" aria-expanded={open} style={{ display: 'block' }}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          {icon}
          <Text size="xs" fw={600} c={labelColor} tt="uppercase" lts={0.6} truncate>
            {label}
          </Text>
        </Group>
        <IconChevronDown
          size={14}
          color="var(--mantine-color-gray-5)"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        />
      </Group>
    </UnstyledButton>
    <Collapse expanded={open}>
      <Box pt={6}>{children}</Box>
    </Collapse>
  </Paper>
);

type ChangeStatSegmentProps = {
  icon: ReactNode;
  count: number;
  label: string;
};

const ChangeStatSegment = ({ icon, count, label }: ChangeStatSegmentProps) => (
  <Group
    gap={6}
    wrap="nowrap"
    px={12}
    py={6}
    style={{
      flexShrink: 0,
      borderLeft: '1px solid color-mix(in srgb, var(--mantine-color-green-6) 20%, transparent)',
    }}
  >
    {icon}
    <Text size="sm" fw={700} c="green.5" lh={1}>
      {count}
    </Text>
    <Text size="sm" fw={500} c="dimmed" lh={1}>
      {label}
    </Text>
  </Group>
);

type ChangeStatsPillProps = {
  bulletCount: number;
  skillCount: number;
  paragraphCount: number;
};

const ChangeStatsPill = ({ bulletCount, skillCount, paragraphCount }: ChangeStatsPillProps) => (
  <Group
    gap={0}
    align="stretch"
    wrap="nowrap"
    style={{
      flexShrink: 0,
      borderRadius: 999,
      overflow: 'hidden',
      border: '1px solid color-mix(in srgb, var(--mantine-color-green-6) 25%, transparent)',
    }}
  >
    <Group
      gap={6}
      wrap="nowrap"
      px={12}
      py={6}
      style={{
        flexShrink: 0,
        backgroundColor: 'color-mix(in srgb, var(--mantine-color-green-6) 14%, var(--mantine-color-body))',
      }}
    >
      <IconCircleCheck size={14} color="var(--mantine-color-green-5)" stroke={1.8} />
      <Text size="xs" fw={700} c="green.5" tt="uppercase" lts={0.6} lh={1}>
        Updated
      </Text>
    </Group>
    {bulletCount > 0 && (
      <ChangeStatSegment
        icon={<IconList size={14} color="var(--mantine-color-green-5)" stroke={1.8} />}
        count={bulletCount}
        label={bulletCount === 1 ? 'bullet' : 'bullets'}
      />
    )}
    {skillCount > 0 && (
      <ChangeStatSegment
        icon={<IconBolt size={14} color="var(--mantine-color-green-5)" stroke={1.8} />}
        count={skillCount}
        label={skillCount === 1 ? 'skill' : 'skills'}
      />
    )}
    {paragraphCount > 0 && (
      <ChangeStatSegment
        icon={<IconFileText size={14} color="var(--mantine-color-green-5)" stroke={1.8} />}
        count={paragraphCount}
        label="summary"
      />
    )}
  </Group>
);

const hasMustHaveGaps = (result: TailorResult): boolean => {
  const changesByLine = new Map(result.changes.map((change) => [change.lineIndex, change]));
  return result.requirements.some((requirement) => {
    const covered =
      requirement.satisfiedBy.length > 0 ||
      requirement.satisfiedByChanges.some((lineIndex) => changesByLine.has(lineIndex));
    return !covered && requirement.importance === 'must';
  });
};

type IdleStepProps = {
  index: number;
  label: string;
};

const IdleStep = ({ index, label }: IdleStepProps) => (
  <Group
    gap={6}
    wrap="nowrap"
    px={10}
    py={5}
    style={{
      borderRadius: 999,
      border: '1px dashed var(--mantine-color-default-border)',
    }}
  >
    <Text size="xs" fw={700} c="cyan.4" lh={1}>
      {index}
    </Text>
    <Text size="xs" c="dimmed" lh={1}>
      {label}
    </Text>
  </Group>
);

const CollapsedContext = ({ hiddenCount, onExpand }: CollapsedContextProps) => (
  <UnstyledButton
    onClick={onExpand}
    my={6}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      padding: '4px 10px',
      borderRadius: 6,
      border: '1px dashed var(--mantine-color-default-border)',
      backgroundColor: 'var(--mantine-color-default-hover)',
    }}
  >
    <IconArrowsVertical size={14} color="var(--mantine-primary-color-filled)" />
    <Text size="xs" c="dimmed">
      Show {hiddenCount} hidden line{hiddenCount === 1 ? '' : 's'} from original
    </Text>
  </UnstyledButton>
);

const ResultsPanel = ({
  status,
  result,
  isExample = false,
  isProPlan,
  originalDocx = null,
  onShowExample,
  onUpgradeClick,
}: ResultsPanelProps) => {
  const [decisions, setDecisions] = useState<Record<string, ChangeDecision>>(() =>
    buildDecisionMap(result),
  );
  const [addedBullets, setAddedBullets] = useState<AddedBullet[]>([]);
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(() => (result ? hasMustHaveGaps(result) : false));
  const [isExporting, setIsExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setExpandedSegments(new Set());
  }, [result]);

  useEffect(
    () => () => {
      if (copiedTimeoutRef.current !== null) window.clearTimeout(copiedTimeoutRef.current);
    },
    [],
  );

  const handleExpandSegment = (startIndex: number, hiddenCount: number) => {
    trackEvent(AnalyticsEvents.ShowHiddenLines, { hidden_count: hiddenCount });
    setExpandedSegments((current) => new Set(current).add(startIndex));
  };

  const changesByLine = useMemo(() => {
    if (!result) return new Map<number, BulletChange>();
    return new Map(result.changes.map((change) => [change.lineIndex, change]));
  }, [result]);

  const handleDecisionChange = (id: string, decision: ChangeDecision) => {
    setDecisions((current) => ({ ...current, [id]: decision }));
  };

  const handleAddGapBullet = (requirement: JobRequirement) => {
    if (!hasDraftBullet(requirement)) return;
    trackEvent(AnalyticsEvents.AddGapBullet, { importance: requirement.importance });
    setAddedBullets((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        requirementText: requirement.text,
        text: requirement.draftBullet,
        afterLineIndex: requirement.insertAfterLine,
      },
    ]);
  };

  const handleRemoveAddedBullet = (id: string) => {
    trackEvent(AnalyticsEvents.RemoveGapBullet);
    setAddedBullets((current) => current.filter((bullet) => bullet.id !== id));
  };

  const handleAddedBulletTextChange = (id: string, text: string) => {
    setAddedBullets((current) =>
      current.map((bullet) => (bullet.id === id ? { ...bullet, text } : bullet)),
    );
  };

  const addedByAnchor = useMemo(() => {
    const map = new Map<number, AddedBullet[]>();
    addedBullets.forEach((bullet) => {
      const group = map.get(bullet.afterLineIndex);
      if (group) {
        group.push(bullet);
        return;
      }
      map.set(bullet.afterLineIndex, [bullet]);
    });
    return map;
  }, [addedBullets]);

  const addedByRequirement = useMemo(
    () => new Map(addedBullets.map((bullet) => [bullet.requirementText, bullet])),
    [addedBullets],
  );

  const activeAddedBullets = addedBullets.filter(
    (bullet) => typeof bullet.text === 'string' && bullet.text.trim().length > 0,
  );

  const buildMergedLines = (): string[] => {
    if (!result) return [];
    return result.resumeText.split('\n').map((line, lineIndex) => {
      const change = changesByLine.get(lineIndex);
      if (!change) return line;
      return decisions[change.id] === 'reverted' ? change.original : change.tailored;
    });
  };

  const buildMergedResume = () =>
    applyAddedBullets(buildMergedLines(), result?.structure, activeAddedBullets);

  const handleCopy = async () => {
    if (!result || isExample) return;
    trackEvent(AnalyticsEvents.ResumeCopy);
    try {
      const merged = buildMergedResume();
      await copyResumeRichText(merged.lines, merged.structure);
      trackEvent(AnalyticsEvents.CopySuccess, { source: 'resume' });
      setCopied(true);
      if (copiedTimeoutRef.current !== null) window.clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      trackEvent(AnalyticsEvents.CopyFailure, { source: 'resume' });
      notifications.show({
        color: 'red',
        title: 'Copy failed',
        message: 'Could not copy the resume to your clipboard.',
      });
    }
  };

  const canPatchOriginal =
    result !== null &&
    originalDocx !== null &&
    normalizeResumeTextForComparison(originalDocx.parsedText) ===
      normalizeResumeTextForComparison(result.resumeText);

  const buildCleanDocx = (): Promise<Blob> => {
    const merged = buildMergedResume();
    return merged.structure
      ? buildStructuredDocx(merged.lines, merged.structure)
      : buildTemplateDocx(merged.lines.join('\n'));
  };

  const buildPatchedDocx = async (): Promise<Blob> => {
    if (!result || !originalDocx) return buildCleanDocx();
    const replacements = result.changes
      .filter((change) => decisions[change.id] !== 'reverted')
      .map((change) => ({ original: change.original, tailored: change.tailored }));
    try {
      return await patchOriginalDocx(originalDocx.file, replacements);
    } catch {
      notifications.show({
        color: 'orange',
        title: 'Original layout unavailable',
        message:
          'We could not preserve your original formatting, so a clean template was used instead.',
      });
      return buildCleanDocx();
    }
  };

  const handleExport = async (variant: 'keep' | 'clean', format: 'docx' | 'pdf') => {
    if (!result || isExample || isExporting) return;
    trackEvent(AnalyticsEvents.ResumeExport, { variant, format });
    if (variant === 'keep' && activeAddedBullets.length > 0) {
      notifications.show({
        color: 'orange',
        title: 'Added bullets not included',
        message:
          'New bullets can\u2019t be inserted into your original file. Use the clean template or copy to clipboard to include them.',
      });
    }
    setIsExporting(true);
    try {
      const docxBlob = variant === 'keep' ? await buildPatchedDocx() : await buildCleanDocx();
      if (format === 'docx') {
        downloadDocx(docxBlob, 'tailored-resume.docx');
        trackEvent(AnalyticsEvents.ExportSuccess, {
          source: 'resume',
          variant,
          format,
        });
        return;
      }
      try {
        const pdfBlob = await convertDocxToPdfWithFallback(docxBlob);
        downloadPdf(pdfBlob, 'tailored-resume.pdf');
        trackEvent(AnalyticsEvents.ExportSuccess, {
          source: 'resume',
          variant,
          format,
        });
      } catch {
        trackEvent(AnalyticsEvents.ExportFailure, {
          source: 'resume',
          variant,
          format,
        });
        notifications.show({
          color: 'red',
          title: 'PDF export failed',
          message: 'Could not generate a PDF. Try downloading the .docx instead.',
        });
      }
    } catch {
      trackEvent(AnalyticsEvents.ExportFailure, {
        source: 'resume',
        variant,
        format,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const buildPreviewDocx = (variant: PreviewVariant): Promise<Blob> =>
    variant === 'keep' ? buildPatchedDocx() : buildCleanDocx();

  const handlePreviewOpen = () => {
    if (!result || isExample) return;
    trackEvent(AnalyticsEvents.ResumePreviewOpen);
    setPreviewOpen(true);
  };

  const handlePreviewClose = () => {
    trackEvent(AnalyticsEvents.ResumePreviewClose);
    setPreviewOpen(false);
  };

  const requirements = result?.requirements ?? [];

  const isRequirementCovered = (requirement: JobRequirement): boolean =>
    requirement.satisfiedBy.length > 0 ||
    requirement.satisfiedByChanges.some((lineIndex) => {
      const change = changesByLine.get(lineIndex);
      return change !== undefined && decisions[change.id] !== 'reverted';
    });

  const isRequirementResolved = (requirement: JobRequirement): boolean =>
    isRequirementCovered(requirement) || addedByRequirement.has(requirement.text);

  const coveredCount = requirements.filter(isRequirementResolved).length;
  const coveredByChangesCount = requirements.filter(
    (requirement) => requirement.satisfiedBy.length === 0 && isRequirementCovered(requirement),
  ).length;
  const gaps = requirements.filter((requirement) => !isRequirementCovered(requirement));
  const unresolvedGapCount = gaps.filter(
    (requirement) => !addedByRequirement.has(requirement.text),
  ).length;
  const gapsLabel =
    unresolvedGapCount > 0
      ? `${unresolvedGapCount} requirement${unresolvedGapCount === 1 ? '' : 's'} your resume doesn’t show`
      : 'Requirement gaps addressed';
  const visibleGaps = isProPlan || isExample ? gaps : gaps.slice(0, 1);
  const lockedGaps = isProPlan || isExample ? [] : gaps.slice(1);

  const handleGapsUpgradeClick = () => {
    trackEvent(AnalyticsEvents.GapsUpgradeClick);
    onUpgradeClick();
  };

  const handleSummaryToggle = () => {
    setSummaryOpen((current) => {
      const next = !current;
      trackEvent(AnalyticsEvents.SummaryToggle, { open: next });
      return next;
    });
  };

  const handleGapsToggle = () => {
    setGapsOpen((current) => {
      const next = !current;
      trackEvent(AnalyticsEvents.GapsToggle, { open: next });
      return next;
    });
  };

  if (status === 'idle') {
    return (
      <Card withBorder shadow="xs" padding="xl" h="100%">
        <Center h="100%" mih={360}>
          <Stack align="center" gap="sm">
            <ThemeIcon
              size={56}
              radius="xl"
              variant="gradient"
              gradient={{ ...appTheme.gradient, deg: 45 }}
            >
              <IconSparkles size={30} />
            </ThemeIcon>
            <Title order={4}>Your tailored resume will appear here</Title>
            <Text size="sm" c="dimmed" ta="center" maw={360}>
              AI-suggested rewrites show up as inline diffs you can accept, tweak, or revert.
            </Text>
            <Group gap="xs" justify="center">
              <IdleStep index={1} label="Add your resume" />
              <IdleStep index={2} label="Paste the job post" />
              <IdleStep index={3} label="Review changes" />
            </Group>
            <Text size="xs" c="dimmed" ta="center" maw={360}>
              You stay in control of every change, and your resume is never stored.
            </Text>
            {onShowExample && (
              <Button
                mt="xs"
                variant="light"
                leftSection={<IconEye size={16} />}
                onClick={() => {
                  trackEvent(AnalyticsEvents.PreviewExample);
                  onShowExample();
                }}
              >
                Preview an example
              </Button>
            )}
          </Stack>
        </Center>
      </Card>
    );
  }

  if (status === 'loading') {
    return <TailoringLoader />;
  }

  if (!result) return null;

  const bulletChangeCount = result.changes.filter((change) => change.kind === 'bullet').length;
  const skillChangeCount = result.changes.filter((change) => change.kind === 'skill').length;
  const paragraphChangeCount = result.changes.filter(
    (change) => change.kind === 'paragraph',
  ).length;
  const lines = result.resumeText.split('\n');
  const segments = buildSegments(lines, changesByLine, addedByAnchor);

  return (
    <Card withBorder shadow="xs" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap="xs" style={{ flexShrink: 0 }}>
            <Group gap="sm" align="center" wrap="nowrap">
              <ChangeStatsPill
                bulletCount={bulletChangeCount}
                skillCount={skillChangeCount}
                paragraphCount={paragraphChangeCount}
              />
              {isExample && (
                <Badge color="cyan" variant="light" style={{ flexShrink: 0 }}>
                  Example
                </Badge>
              )}
            </Group>
            {requirements.length > 0 && (
              <Tooltip label="How many of the job's key requirements your resume demonstrates, counting the changes you keep applied.">
                <Badge
                  size="md"
                  color="green"
                  variant="light"
                  leftSection={<IconTargetArrow size={14} />}
                  style={{ width: 'fit-content' }}
                >
                  Covers {coveredCount} of {requirements.length} requirements
                  {coveredByChangesCount > 0 ? ` (+${coveredByChangesCount} from changes)` : ''}
                </Badge>
              </Tooltip>
            )}
          </Stack>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0, marginLeft: 'auto' }}>
            <Tooltip label="Preview the final document before downloading" withArrow>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconEye size={16} />}
                disabled={isExample}
                onClick={handlePreviewOpen}
              >
                Preview
              </Button>
            </Tooltip>
            <Menu
              position="bottom-end"
              withinPortal
              onOpen={() => trackEvent(AnalyticsEvents.ResumeExportMenuOpen)}
            >
              <Menu.Target>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconDownload size={16} />}
                  rightSection={<IconChevronDown size={14} />}
                  loading={isExporting}
                >
                  Export
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={copied ? <IconCopyCheck size={16} /> : <IconCopy size={16} />}
                  disabled={isExample}
                  onClick={handleCopy}
                >
                  {copied ? 'Copied' : 'Copy to clipboard'}
                </Menu.Item>
                <Menu.Divider />
                {isExample && (
                  <>
                    <Menu.Label>Example preview — export unavailable</Menu.Label>
                    <Menu.Divider />
                  </>
                )}
                {canPatchOriginal && (
                  <>
                    <Menu.Label>Keep my formatting</Menu.Label>
                    <Menu.Item
                      leftSection={<IconFileDescription size={16} />}
                      rightSection={
                        <Badge size="xs" variant="light" color="teal">
                          Recommended
                        </Badge>
                      }
                      disabled={isExample}
                      onClick={() => handleExport('keep', 'docx')}
                    >
                      Word (.docx)
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<IconFileTypePdf size={16} />}
                      disabled={isExample}
                      onClick={() => handleExport('keep', 'pdf')}
                    >
                      PDF (.pdf)
                    </Menu.Item>
                    <Menu.Divider />
                  </>
                )}
                {!canPatchOriginal && !isExample && (
                  <>
                    <Menu.Label>Keep my formatting</Menu.Label>
                    <Text size="xs" c="dimmed" px={12} pb={8} maw={240}>
                      Upload your resume as a .docx to export with your original formatting
                      preserved.
                    </Text>
                    <Menu.Divider />
                  </>
                )}
                <Menu.Label>Clean template</Menu.Label>
                <Menu.Item
                  leftSection={<IconFileDescription size={16} />}
                  disabled={isExample}
                  onClick={() => handleExport('clean', 'docx')}
                >
                  Word (.docx)
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFileTypePdf size={16} />}
                  disabled={isExample}
                  onClick={() => handleExport('clean', 'pdf')}
                >
                  PDF (.pdf)
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        <CollapsibleInsight
          open={summaryOpen}
          onToggle={handleSummaryToggle}
          icon={<IconSparkles size={13} color="var(--mantine-color-cyan-4)" stroke={1.8} />}
          label="Summary of changes"
          labelColor="cyan.4"
          borderColor="var(--mantine-color-cyan-6)"
          background="rgba(34, 184, 207, 0.07)"
          ariaLabel="Summary of changes"
        >
          <Text size="sm" c="dimmed" lh={1.6}>
            {result.summary}
          </Text>
        </CollapsibleInsight>

        {gaps.length > 0 && (
          <CollapsibleInsight
            open={gapsOpen}
            onToggle={handleGapsToggle}
            icon={<IconTargetArrow size={13} color="var(--mantine-color-orange-5)" stroke={1.8} />}
            label={gapsLabel}
            labelColor="orange.5"
            borderColor="var(--mantine-color-orange-6)"
            background="rgba(232, 145, 45, 0.07)"
            ariaLabel="Requirement gaps"
          >
            <Stack gap="sm">
              <Text size="sm" c="dimmed" lh={1.6}>
                This job asks for these, but your resume doesn&rsquo;t demonstrate them yet. If you
                have the experience, adding a bullet for it would strengthen your match.
              </Text>
              {visibleGaps.map((requirement) => (
                <GapRow
                  key={requirement.text}
                  requirement={requirement}
                  addedBullet={addedByRequirement.get(requirement.text)}
                  onAdd={handleAddGapBullet}
                  onUndo={handleRemoveAddedBullet}
                />
              ))}
              {lockedGaps.length > 0 && (
                <Box style={{ position: 'relative' }}>
                  <Stack gap="sm" style={{ filter: 'blur(5px)', userSelect: 'none' }} aria-hidden>
                    {lockedGaps.map((requirement) => (
                      <GapRow key={requirement.text} requirement={requirement} />
                    ))}
                  </Stack>
                  <Center
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor:
                        'color-mix(in srgb, var(--mantine-color-body) 55%, transparent)',
                    }}
                  >
                    <Stack align="center" gap={6} p="xs">
                      <Group gap={6}>
                        <IconLock size={16} color="var(--mantine-primary-color-filled)" />
                        <Text size="sm" fw={600}>
                          See all {gaps.length} missing requirements with Pro
                        </Text>
                        <Badge variant="gradient" gradient={{ from: 'indigo', to: 'cyan' }}>
                          Pro
                        </Badge>
                      </Group>
                      <Button size="xs" onClick={handleGapsUpgradeClick}>
                        Upgrade to Pro
                      </Button>
                    </Stack>
                  </Center>
                </Box>
              )}
            </Stack>
          </CollapsibleInsight>
        )}

        <Paper
          withBorder
          radius="md"
          p="lg"
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--mantine-color-default-hover) 40%, var(--mantine-color-body))',
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.12)',
          }}
        >
          <Group gap={6} mb="sm" wrap="nowrap">
            <IconFileText size={13} color="var(--mantine-color-gray-5)" stroke={1.8} />
            <Text size="xs" fw={600} c="dimmed" tt="uppercase" lts={0.6}>
              Your tailored resume
            </Text>
          </Group>
          {segments.map((segment) => {
            if (segment.kind === 'change') {
              return (
                <DiffBullet
                  key={segment.change.id}
                  change={segment.change}
                  decision={decisions[segment.change.id] ?? 'accepted'}
                  onDecisionChange={handleDecisionChange}
                />
              );
            }
            if (segment.kind === 'added') {
              return (
                <AddedBulletRow
                  key={segment.bullet.id}
                  bullet={segment.bullet}
                  onTextChange={handleAddedBulletTextChange}
                  onRemove={handleRemoveAddedBullet}
                />
              );
            }
            const trimmed = trimBlankEdges(segment.lines);
            if (trimmed.lines.length === 0) return null;
            const keyBase = segment.startIndex + trimmed.offset;
            const { leading, hidden, trailing } = splitContextLines(
              trimmed.lines,
              !expandedSegments.has(segment.startIndex),
            );
            return (
              <div key={segment.startIndex}>
                {leading.map((line, offset) => (
                  <ContextLine key={keyBase + offset} line={line} />
                ))}
                {hidden.length > 0 && (
                  <CollapsedContext
                    hiddenCount={hidden.length}
                    onExpand={() => handleExpandSegment(segment.startIndex, hidden.length)}
                  />
                )}
                {trailing.map((line, offset) => (
                  <ContextLine
                    key={keyBase + leading.length + hidden.length + offset}
                    line={line}
                  />
                ))}
              </div>
            );
          })}
        </Paper>
      </Stack>
      <DocumentPreviewModal
        opened={previewOpen}
        onClose={handlePreviewClose}
        originalFile={originalDocx?.file ?? null}
        canPatchOriginal={canPatchOriginal}
        buildDocx={buildPreviewDocx}
        onExport={handleExport}
      />
    </Card>
  );
};

export default ResultsPanel;
