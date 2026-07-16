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
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowsVertical,
  IconChevronDown,
  IconCopy,
  IconCopyCheck,
  IconDownload,
  IconEye,
  IconFileDescription,
  IconFileTypePdf,
  IconLock,
  IconSparkles,
  IconTargetArrow,
} from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import type {
  BulletChange,
  ChangeDecision,
  JobRequirement,
  TailorResult,
  TailorStatus,
} from '../lib/types';
import { copyResumeRichText } from '../lib/copyResume';
import {
  buildStructuredDocx,
  buildTemplateDocx,
  downloadDocx,
  normalizeResumeTextForComparison,
  patchOriginalDocx,
} from '../lib/exportDocx';
import { convertDocxToPdf, downloadPdf } from '../lib/exportPdf';
import DiffBullet from './DiffBullet';
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
  | { kind: 'context'; startIndex: number; lines: string[] };

const buildSegments = (
  lines: string[],
  changesByLine: Map<number, BulletChange>,
): ResumeSegment[] => {
  const segments: ResumeSegment[] = [];
  lines.forEach((line, lineIndex) => {
    const change = changesByLine.get(lineIndex);
    if (change) {
      segments.push({ kind: 'change', change });
      return;
    }
    const previousSegment = segments[segments.length - 1];
    if (previousSegment && previousSegment.kind === 'context') {
      previousSegment.lines.push(line);
      return;
    }
    segments.push({ kind: 'context', startIndex: lineIndex, lines: [line] });
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

const GapRow = ({ requirement }: { requirement: JobRequirement }) => (
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
      <Text size="sm" fw={500}>
        {requirement.text}
      </Text>
    </Group>
    {requirement.gapHint && (
      <Text size="xs" c="dimmed">
        {requirement.gapHint}
      </Text>
    )}
  </Stack>
);

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
    <UnstyledButton
      onClick={onToggle}
      w="100%"
      aria-expanded={open}
      style={{ display: 'block' }}
    >
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

const hasMustHaveGaps = (result: TailorResult): boolean => {
  const changesByLine = new Map(result.changes.map((change) => [change.lineIndex, change]));
  return result.requirements.some((requirement) => {
    const covered =
      requirement.satisfiedBy.length > 0 ||
      requirement.satisfiedByChanges.some((lineIndex) => changesByLine.has(lineIndex));
    return !covered && requirement.importance === 'must';
  });
};

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
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set());
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(() => (result ? hasMustHaveGaps(result) : false));
  const [isExporting, setIsExporting] = useState(false);
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

  const buildMergedLines = (): string[] => {
    if (!result) return [];
    return result.resumeText.split('\n').map((line, lineIndex) => {
      const change = changesByLine.get(lineIndex);
      if (!change) return line;
      return decisions[change.id] === 'reverted' ? change.original : change.tailored;
    });
  };

  const buildMergedText = (): string => buildMergedLines().join('\n');

  const handleCopy = async () => {
    if (!result || isExample) return;
    trackEvent(AnalyticsEvents.ResumeCopy);
    try {
      await copyResumeRichText(buildMergedLines(), result.structure);
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

  const buildCleanDocx = (): Promise<Blob> =>
    result?.structure
      ? buildStructuredDocx(buildMergedLines(), result.structure)
      : buildTemplateDocx(buildMergedText());

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
        const pdfBlob = await convertDocxToPdf(docxBlob);
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

  const requirements = result?.requirements ?? [];

  const isRequirementCovered = (requirement: JobRequirement): boolean =>
    requirement.satisfiedBy.length > 0 ||
    requirement.satisfiedByChanges.some((lineIndex) => {
      const change = changesByLine.get(lineIndex);
      return change !== undefined && decisions[change.id] !== 'reverted';
    });

  const coveredCount = requirements.filter(isRequirementCovered).length;
  const coveredByChangesCount = requirements.filter(
    (requirement) => requirement.satisfiedBy.length === 0 && isRequirementCovered(requirement),
  ).length;
  const gaps = requirements.filter((requirement) => !isRequirementCovered(requirement));
  const visibleGaps = isProPlan ? gaps : gaps.slice(0, 1);
  const lockedGaps = isProPlan ? [] : gaps.slice(1);

  const handleGapsUpgradeClick = () => {
    trackEvent(AnalyticsEvents.GapsUpgradeClick);
    onUpgradeClick();
  };

  const handleSummaryToggle = () => {
    setSummaryOpen((current) => !current);
  };

  const handleGapsToggle = () => {
    setGapsOpen((current) => !current);
  };

  if (status === 'idle') {
    return (
      <Card withBorder shadow="xs" padding="xl" h="100%">
        <Center h="100%" mih={360}>
          <Stack align="center" gap="xs">
            <IconSparkles size={40} color="var(--mantine-primary-color-filled)" />
            <Title order={4}>Your tailored resume will appear here</Title>
            <Text size="sm" c="dimmed" ta="center" maw={360}>
              Attach your base resume, paste a job description, and click &ldquo;Tailor
              Resume&rdquo; to see suggested bullet changes.
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
  const segments = buildSegments(lines, changesByLine);

  return (
    <Card withBorder shadow="xs" padding="lg">
      <Stack gap="md">
        <Stack gap="xs">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Title order={4}>
              {bulletChangeCount} bullet{bulletChangeCount === 1 ? '' : 's'}
              {skillChangeCount > 0
                ? `, ${skillChangeCount} skill${skillChangeCount === 1 ? '' : 's'}`
                : ''}
              {paragraphChangeCount > 0 ? ', summary' : ''} updated
            </Title>
            <Group gap="sm" wrap="nowrap">
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
                  {isExample && (
                    <>
                      <Menu.Label>Example preview — export unavailable</Menu.Label>
                      <Menu.Divider />
                    </>
                  )}
                  <Menu.Item
                    leftSection={copied ? <IconCopyCheck size={16} /> : <IconCopy size={16} />}
                    disabled={isExample}
                    onClick={handleCopy}
                  >
                    {copied ? 'Copied' : 'Copy to clipboard'}
                  </Menu.Item>
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
          {(isExample || requirements.length > 0) && (
            <Group gap="sm">
              {isExample && (
                <Badge color="cyan" variant="light">
                  Example
                </Badge>
              )}
              {requirements.length > 0 && (
                <Tooltip label="How many of the job's key requirements your resume demonstrates, counting the changes you keep applied.">
                  <Badge color="green" variant="light" leftSection={<IconTargetArrow size={12} />}>
                    Covers {coveredCount} of {requirements.length} requirements
                    {coveredByChangesCount > 0 ? ` · +${coveredByChangesCount} from changes` : ''}
                  </Badge>
                </Tooltip>
              )}
            </Group>
          )}
        </Stack>

        <CollapsibleInsight
          open={summaryOpen}
          onToggle={handleSummaryToggle}
          icon={<IconSparkles size={13} color="var(--mantine-color-cyan-4)" stroke={1.8} />}
          label="Why these changes"
          labelColor="cyan.4"
          borderColor="var(--mantine-color-cyan-6)"
          background="linear-gradient(90deg, rgba(34, 184, 207, 0.07), transparent 65%)"
          ariaLabel="Why these changes"
        >
          <Text size="sm" c="dimmed" lh={1.6}>
            {result.summary}
          </Text>
        </CollapsibleInsight>

        {gaps.length > 0 && (
          <CollapsibleInsight
            open={gapsOpen}
            onToggle={handleGapsToggle}
            icon={
              <IconTargetArrow size={13} color="var(--mantine-color-orange-5)" stroke={1.8} />
            }
            label={`${gaps.length} requirement${gaps.length === 1 ? '' : 's'} your resume doesn’t show`}
            labelColor="orange.5"
            borderColor="var(--mantine-color-orange-6)"
            background="linear-gradient(90deg, rgba(232, 145, 45, 0.07), transparent 65%)"
            ariaLabel="Requirement gaps"
          >
            <Stack gap="sm">
              <Text size="sm" c="dimmed" lh={1.6}>
                This job asks for these, but your resume doesn&rsquo;t demonstrate them yet. If you
                have the experience, adding a bullet for it would strengthen your match.
              </Text>
              {visibleGaps.map((requirement) => (
                <GapRow key={requirement.text} requirement={requirement} />
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

        <div>
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
        </div>
      </Stack>
    </Card>
  );
};

export default ResultsPanel;
