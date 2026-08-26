import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Menu,
  Paper,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconEye,
  IconFileDescription,
  IconFileText,
  IconFileTypePdf,
  IconLock,
  IconSparkles,
} from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { ExportScaleControl } from './ExportScaleControl';
import { hasDraftBullet } from '../lib/hasDraftBullet';
import { LOCKED_GAP_PLACEHOLDERS } from '../lib/lockedGapPlaceholders';
import { proAccent } from '../lib/proAccent';
import { buildReviewSegments } from '../lib/resumeModel';
import { appTheme } from '../lib/theme';
import type {
  AddedBullet,
  BulletChange,
  ChangeDecision,
  JobRequirement,
  OriginalDocx,
  TailorResult,
  TailorStatus,
} from '../lib/types';
import { useProUpgradeCtaLabel } from '../hooks/useProPlan';
import { useResumeExport } from '../hooks/useResumeExport';
import AddedBulletRow from './AddedBulletRow';
import RequirementsCoverage from './RequirementsCoverage';
import CollapsedContext from './CollapsedContext';
import CollapsibleInsight from './CollapsibleInsight';
import ContextLine from './ContextLine';
import DiffBullet from './DiffBullet';
import GapRow from './GapRow';
import IdleStep from './IdleStep';
import TailoringLoader from './TailoringLoader';

type ResultsPanelProps = {
  status: TailorStatus;
  result: TailorResult | null;
  isExample?: boolean;
  exportMenuKey?: string | null;
  isProPlan: boolean;
  isGuest?: boolean;
  originalDocx?: OriginalDocx | null;
  companyName?: string;
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

const splitContextLines = (
  lines: string[],
  collapsed: boolean,
  isOpening: boolean,
): ContextSplit => {
  const expandedSplit: ContextSplit = { leading: lines, hidden: [], trailing: [] };
  if (!collapsed) return expandedSplit;
  const leadingCount = isOpening ? 0 : CONTEXT_LINES_PER_SIDE;
  const trailingCount = isOpening ? 0 : CONTEXT_LINES_PER_SIDE;
  const minHidden = isOpening ? 1 : MIN_HIDDEN_LINES;
  if (lines.length < leadingCount + trailingCount + minHidden) {
    return expandedSplit;
  }
  let leadingEnd = leadingCount;
  while (leadingEnd > 0 && isBlankLine(lines[leadingEnd - 1])) {
    leadingEnd -= 1;
  }
  let trailingStart = lines.length - trailingCount;
  while (trailingStart < lines.length && isBlankLine(lines[trailingStart])) {
    trailingStart += 1;
  }
  const hidden = lines.slice(leadingEnd, trailingStart);
  if (hidden.length < minHidden) return expandedSplit;
  return {
    leading: lines.slice(0, leadingEnd),
    hidden,
    trailing: lines.slice(trailingStart),
  };
};

type ResumeSegment =
  | { kind: 'change'; change: BulletChange }
  | { kind: 'added'; bullet: AddedBullet }
  | { kind: 'context'; nodeId: string; lines: string[] };

const ResultsPanel = ({
  status,
  result,
  isExample = false,
  exportMenuKey = null,
  isGuest = false,
  originalDocx = null,
  companyName,
  onShowExample,
  onUpgradeClick,
}: ResultsPanelProps) => {
  const [decisions, setDecisions] = useState<Record<string, ChangeDecision>>(() =>
    buildDecisionMap(result),
  );
  const [addedBullets, setAddedBullets] = useState<AddedBullet[]>([]);
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  const upgradeCtaLabel = useProUpgradeCtaLabel();
  const isNarrowMobile = useMediaQuery('(max-width: 36em)');

  useEffect(() => {
    setExpandedSegments(new Set());
  }, [result]);

  const handleExpandSegment = (nodeId: string, hiddenCount: number) => {
    trackEvent(AnalyticsEvents.ShowHiddenLines, { hidden_count: hiddenCount });
    setExpandedSegments((current) => new Set(current).add(nodeId));
  };

  const changesByTarget = useMemo(() => {
    if (!result) return new Map<string, BulletChange>();
    return new Map(result.changes.map((change) => [change.targetId, change]));
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
        afterId: requirement.insertAfterId,
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

  const addedByRequirement = useMemo(
    () => new Map(addedBullets.map((bullet) => [bullet.requirementText, bullet])),
    [addedBullets],
  );

  const activeAddedBullets = useMemo(
    () =>
      addedBullets.filter(
        (bullet) => typeof bullet.text === 'string' && bullet.text.trim().length > 0,
      ),
    [addedBullets],
  );

  const {
    isExporting,
    canPatchOriginal,
    exportScale,
    setExportScale,
    fitToOnePage,
    setFitToOnePage,
    isComputingFit,
    handleCopy,
    handleExport,
  } = useResumeExport({
    result,
    isExample,
    originalDocx,
    companyName,
    decisions,
    activeAddedBullets,
  });

  const requirements = result?.requirements ?? [];

  const isRequirementCovered = (requirement: JobRequirement): boolean =>
    requirement.satisfiedBy.length > 0 ||
    requirement.satisfiedByChanges.some((targetId) => {
      const change = changesByTarget.get(targetId);
      return change !== undefined && decisions[change.id] !== 'reverted';
    });

  const isRequirementResolved = (requirement: JobRequirement): boolean =>
    isRequirementCovered(requirement) || addedByRequirement.has(requirement.text);

  const coveredCount = requirements.filter(isRequirementResolved).length;
  const baseCoveredCount = requirements.filter(
    (requirement) => requirement.satisfiedBy.length > 0,
  ).length;
  const coveredByChangesCount = requirements.filter(
    (requirement) => requirement.satisfiedBy.length === 0 && isRequirementCovered(requirement),
  ).length;
  const coveredByAddedCount = requirements.filter(
    (requirement) => !isRequirementCovered(requirement) && addedByRequirement.has(requirement.text),
  ).length;
  const gaps = requirements.filter((requirement) => !isRequirementCovered(requirement));
  const unresolvedGapCount = gaps.filter(
    (requirement) => !addedByRequirement.has(requirement.text),
  ).length;
  const availableFillerCount = gaps.filter(
    (requirement) =>
      !requirement.locked &&
      !addedByRequirement.has(requirement.text) &&
      hasDraftBullet(requirement),
  ).length;
  const visibleGaps = gaps.filter((requirement) => !requirement.locked);
  const lockedGaps = gaps.filter((requirement) => requirement.locked);

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
              {isGuest
                ? 'You stay in control of every change, and your resume is never stored.'
                : 'You stay in control of every change. Saved to your account after each run — delete anytime.'}
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

  const reviewSegments = buildReviewSegments(
    result.resumeText,
    result.document,
    result.changes,
    decisions,
    addedBullets,
  );
  const segments: ResumeSegment[] = [];
  reviewSegments.forEach((segment) => {
    if (segment.kind !== 'context') {
      segments.push(segment);
      return;
    }
    const previous = segments[segments.length - 1];
    if (previous && previous.kind === 'context') {
      previous.lines.push(segment.text);
      return;
    }
    segments.push({ kind: 'context', nodeId: segment.nodeId, lines: [segment.text] });
  });
  const actionButtons = (
    <Group
      gap="xs"
      wrap="nowrap"
      grow={isNarrowMobile}
      preventGrowOverflow={false}
      style={{ flexShrink: 0 }}
    >
      <Menu
        key={exportMenuKey ?? undefined}
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
          <Menu.Item leftSection={<IconCopy size={16} />} disabled={isExample} onClick={handleCopy}>
            Copy to clipboard
          </Menu.Item>
          <Menu.Divider />
          {isExample && (
            <>
              <Menu.Label>Example preview — export unavailable</Menu.Label>
              <Menu.Divider />
            </>
          )}
          <Menu.Label>Settings</Menu.Label>
          <ExportScaleControl
            scale={exportScale}
            onChange={setExportScale}
            fitToOnePage={fitToOnePage}
            onFitToOnePageChange={setFitToOnePage}
            isComputingFit={isComputingFit}
            disabled={isExample}
          />
          <Menu.Divider />
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
                Upload your resume as a .docx to export with your original formatting preserved.
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
  );

  return (
    <Card className="results-card" withBorder shadow="xs" p={{ base: 'sm', sm: 'lg' }}>
      <Stack gap="md">
        <Stack gap="sm">
          {isNarrowMobile && actionButtons}
          <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
            {requirements.length > 0 && (
              <Box style={{ flex: 1, minWidth: 0 }}>
                <RequirementsCoverage
                  coveredCount={coveredCount}
                  totalCount={requirements.length}
                  baseCoveredCount={baseCoveredCount}
                  coveredByChangesCount={coveredByChangesCount}
                  coveredByAddedCount={coveredByAddedCount}
                  availableFillerCount={availableFillerCount}
                  unresolvedGapCount={unresolvedGapCount}
                  open={gaps.length > 0 ? gapsOpen : undefined}
                  onToggle={gaps.length > 0 ? handleGapsToggle : undefined}
                >
                  {gaps.length > 0 && (
                    <Stack gap="sm">
                      <Text size="sm" c="dimmed" lh={1.6}>
                        This job asks for these, but your resume doesn&rsquo;t show them yet. If you
                        have the experience, add a bullet.
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
                          <Stack
                            gap="sm"
                            style={{ filter: 'blur(5px)', userSelect: 'none' }}
                            aria-hidden
                          >
                            {lockedGaps.map((_, index) => (
                              <GapRow
                                key={index}
                                requirement={
                                  LOCKED_GAP_PLACEHOLDERS[index % LOCKED_GAP_PLACEHOLDERS.length]
                                }
                              />
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
                                <Badge
                                  variant="gradient"
                                  gradient={{ ...proAccent.gradient, deg: 45 }}
                                >
                                  Pro
                                </Badge>
                              </Group>
                              <Button
                                size="xs"
                                variant="gradient"
                                gradient={{ ...proAccent.gradient, deg: 45 }}
                                onClick={handleGapsUpgradeClick}
                              >
                                {upgradeCtaLabel}
                              </Button>
                            </Stack>
                          </Center>
                        </Box>
                      )}
                    </Stack>
                  )}
                </RequirementsCoverage>
              </Box>
            )}
            {!isNarrowMobile && actionButtons}
          </Group>
        </Stack>

        <CollapsibleInsight
          open={summaryOpen}
          onToggle={handleSummaryToggle}
          icon={<IconSparkles size={13} color="var(--mantine-color-violet-4)" stroke={1.8} />}
          label="Summary of changes"
          labelColor="violet.4"
          borderColor="var(--mantine-color-violet-6)"
          background="rgba(151, 117, 250, 0.07)"
          ariaLabel="Summary of changes"
        >
          <Text size="sm" c="dimmed" lh={1.6}>
            {result.summary}
          </Text>
        </CollapsibleInsight>

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
          {segments.map((segment, segmentIndex) => {
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
            const { leading, hidden, trailing } = splitContextLines(
              trimmed.lines,
              !expandedSegments.has(segment.nodeId),
              segmentIndex === 0,
            );
            return (
              <div key={segment.nodeId}>
                {leading.map((line, offset) => (
                  <ContextLine key={`${segment.nodeId}-l-${offset}`} line={line} />
                ))}
                {hidden.length > 0 && (
                  <CollapsedContext
                    hiddenCount={hidden.length}
                    onExpand={() => handleExpandSegment(segment.nodeId, hidden.length)}
                  />
                )}
                {trailing.map((line, offset) => (
                  <ContextLine key={`${segment.nodeId}-t-${offset}`} line={line} />
                ))}
              </div>
            );
          })}
        </Paper>
      </Stack>
    </Card>
  );
};

export default ResultsPanel;
