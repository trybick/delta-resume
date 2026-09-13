import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Menu,
  Paper,
  Popover,
  Progress,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowUpRight,
  IconBriefcase,
  IconChevronDown,
  IconDownload,
  IconFolderOpen,
  IconLock,
  IconSparkles,
  IconTargetArrow,
  IconTrash,
} from '@tabler/icons-react';
import { getTailorRun } from '../lib/api';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { loadOriginalDocx } from '../lib/docxStore';
import { proAccent } from '../lib/proAccent';
import { useResumeExport } from '../hooks/useResumeExport';
import type { OriginalDocx, TailorRunDetail, TailorRunSummary } from '../lib/types';
import ResumeExportMenu from './ResumeExportMenu';

type ApplicationsListProps = {
  runs: TailorRunSummary[];
  hiddenOlderCount: number;
  isLoading: boolean;
  isProPlan: boolean;
  onReopen: (runId: string) => void;
  onDelete: (runId: string) => void;
  onNewApplication: () => void;
  onUpgradeClick: () => void;
  onKeepFormattingGate: () => void;
};

const formatRunDate = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const runTitle = (run: TailorRunSummary): { primary: string; secondary: string | null } => {
  const company = run.companyName?.trim() || null;
  const title = run.jobTitle?.trim() || null;
  if (company && title) return { primary: company, secondary: title };
  if (company) return { primary: company, secondary: null };
  if (title) return { primary: title, secondary: null };
  return { primary: run.resumeName || 'Untitled application', secondary: null };
};

const initialsFor = (label: string): string =>
  label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

type RunExportMenuProps = {
  runId: string;
  isProPlan: boolean;
  onKeepFormattingGate: () => void;
};

const RunExportMenu = ({ runId, isProPlan, onKeepFormattingGate }: RunExportMenuProps) => {
  const [detail, setDetail] = useState<TailorRunDetail | null>(null);
  const [originalDocx, setOriginalDocx] = useState<OriginalDocx | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const decisions = detail?.decisions.decisions ?? {};
  const activeAddedBullets = useMemo(
    () =>
      (detail?.decisions.addedBullets ?? []).filter(
        (bullet) => typeof bullet.text === 'string' && bullet.text.trim().length > 0,
      ),
    [detail],
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
    result: detail?.result ?? null,
    isExample: false,
    originalDocx,
    companyName: detail?.companyName ?? undefined,
    decisions,
    activeAddedBullets,
    isGuest: false,
    isProPlan,
    onKeepFormattingGate,
  });

  const handleOpen = () => {
    if (detail || isLoadingDetail) return;
    setIsLoadingDetail(true);
    void (async () => {
      try {
        const loaded = await getTailorRun(runId);
        setDetail(loaded);
        const file = await loadOriginalDocx(loaded.result.resumeText);
        setOriginalDocx(file ? { file, parsedText: loaded.result.resumeText } : null);
      } catch {
        setDetail(null);
      } finally {
        setIsLoadingDetail(false);
      }
    })();
  };

  return (
    <Menu position="bottom-end" withinPortal onOpen={handleOpen}>
      <Menu.Target>
        <Button
          size="xs"
          variant="default"
          leftSection={<IconDownload size={14} />}
          rightSection={<IconChevronDown size={12} />}
          loading={isExporting || isLoadingDetail}
        >
          Export
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {detail ? (
          <ResumeExportMenu
            isExample={false}
            isGuest={false}
            isProPlan={isProPlan}
            canPatchOriginal={canPatchOriginal}
            exportScale={exportScale}
            onExportScaleChange={setExportScale}
            fitToOnePage={fitToOnePage}
            onFitToOnePageChange={setFitToOnePage}
            isComputingFit={isComputingFit}
            onCopy={() => void handleCopy()}
            onExport={(variant, format) => void handleExport(variant, format)}
            onExportGate={() => undefined}
          />
        ) : (
          <Menu.Item disabled>Loading export options…</Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
};

type CompactCoverageProps = {
  coveredCount: number;
  totalCount: number;
};

const CompactCoverage = ({ coveredCount, totalCount }: CompactCoverageProps) => {
  const missing = Math.max(0, totalCount - coveredCount);
  return (
    <Tooltip
      label={`${coveredCount} of ${totalCount} job requirements covered${missing > 0 ? `, ${missing} missing` : ''}`}
    >
      <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
        <IconTargetArrow
          size={14}
          stroke={1.8}
          color="var(--mantine-color-green-5)"
          style={{ flexShrink: 0 }}
        />
        <Progress
          value={(coveredCount / totalCount) * 100}
          size={6}
          radius="xl"
          color="green.6"
          w={{ base: 72, sm: 120 }}
          style={{ flexShrink: 0 }}
        />
        <Text size="xs" lh={1} style={{ whiteSpace: 'nowrap' }}>
          <Text component="span" size="xs" fw={700} c="green.5">
            {coveredCount}
          </Text>
          <Text component="span" size="xs" c="dimmed">
            {' '}
            of {totalCount}
          </Text>
        </Text>
      </Group>
    </Tooltip>
  );
};

const ApplicationsList = ({
  runs,
  hiddenOlderCount,
  isLoading,
  isProPlan,
  onReopen,
  onDelete,
  onNewApplication,
  onUpgradeClick,
  onKeepFormattingGate,
}: ApplicationsListProps) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    trackEvent(AnalyticsEvents.RunsListOpen);
  }, []);

  const totalCount = runs.length + hiddenOlderCount;

  const header = (
    <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
      <Stack gap={2}>
        <Group gap="sm" align="baseline">
          <Title order={2} fw={700} style={{ letterSpacing: '-0.015em' }}>
            Your applications
          </Title>
          {totalCount > 0 && (
            <Text size="sm" c="dimmed" fw={500}>
              {totalCount}
            </Text>
          )}
        </Group>
        <Text size="sm" c="dimmed">
          Every tailor run, saved with the changes you approved. Re-open to keep reviewing or export
          again.
        </Text>
      </Stack>
      <Button
        size="sm"
        leftSection={<IconSparkles size={16} />}
        onClick={onNewApplication}
        className="tailor-button"
      >
        New application
      </Button>
    </Group>
  );

  if (isLoading) {
    return (
      <Stack gap="lg">
        {header}
        <Paper withBorder radius="md" p="xl">
          <Group justify="center" py="xl">
            <Loader size="sm" />
          </Group>
        </Paper>
      </Stack>
    );
  }

  if (runs.length === 0 && hiddenOlderCount === 0) {
    return (
      <Stack gap="lg">
        {header}
        <Paper
          withBorder
          radius="md"
          p="xl"
          style={{
            borderStyle: 'dashed',
            background: 'linear-gradient(160deg, rgba(34, 184, 207, 0.05) 0%, transparent 60%)',
          }}
        >
          <Stack align="center" gap="md" py="lg">
            <ThemeIcon size={56} radius="xl" variant="light" color="cyan">
              <IconFolderOpen size={26} stroke={1.6} />
            </ThemeIcon>
            <Stack gap={4} align="center">
              <Title order={4}>No applications yet</Title>
              <Text size="sm" c="dimmed" ta="center" maw={380} lh={1.5}>
                Tailor your resume for a job and it lands here with the company, role, and every
                change you approved, ready to re-open or export.
              </Text>
            </Stack>
            <Button
              leftSection={<IconSparkles size={16} />}
              onClick={onNewApplication}
              className="tailor-button"
            >
              Tailor my resume
            </Button>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {header}
      <Stack gap="sm">
        {runs.map((run) => {
          const { primary, secondary } = runTitle(run);
          const metaParts = [
            formatRunDate(run.createdAt),
            run.resumeName || null,
            run.changeCount > 0
              ? `${run.changeCount} ${run.changeCount === 1 ? 'change' : 'changes'}`
              : null,
          ].filter((part): part is string => part !== null);

          return (
            <Paper key={run.id} withBorder radius="md" p="md" className="saved-resume-card">
              <Group justify="space-between" align="center" wrap="wrap" gap="md">
                <Group gap="md" wrap="nowrap" style={{ flex: 1, minWidth: 220 }}>
                  <ThemeIcon
                    size={44}
                    radius="md"
                    variant="light"
                    color="cyan"
                    style={{ flexShrink: 0 }}
                  >
                    {run.companyName ? (
                      <Text size="sm" fw={700} lh={1}>
                        {initialsFor(primary)}
                      </Text>
                    ) : (
                      <IconBriefcase size={20} stroke={1.7} />
                    )}
                  </ThemeIcon>
                  <Stack gap={2} style={{ minWidth: 0 }}>
                    <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                      <Text fw={600} truncate>
                        {primary}
                      </Text>
                      {secondary && (
                        <Text c="dimmed" truncate>
                          · {secondary}
                        </Text>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" truncate>
                      {metaParts.join(' · ')}
                    </Text>
                  </Stack>
                </Group>

                {run.totalCount > 0 && (
                  <Box visibleFrom="sm">
                    <CompactCoverage coveredCount={run.coveredCount} totalCount={run.totalCount} />
                  </Box>
                )}

                <Group gap="xs" wrap="nowrap" style={{ marginLeft: 'auto' }}>
                  <Button
                    size="xs"
                    variant="light"
                    rightSection={<IconArrowUpRight size={14} />}
                    onClick={() => {
                      trackEvent(AnalyticsEvents.RunReopen);
                      onReopen(run.id);
                    }}
                  >
                    Re-open
                  </Button>
                  <RunExportMenu
                    runId={run.id}
                    isProPlan={isProPlan}
                    onKeepFormattingGate={onKeepFormattingGate}
                  />
                  <Popover
                    opened={confirmDeleteId === run.id}
                    onChange={(open) => setConfirmDeleteId(open ? run.id : null)}
                    position="bottom-end"
                    withArrow
                  >
                    <Popover.Target>
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label="Delete application"
                        onClick={() => setConfirmDeleteId(run.id)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Popover.Target>
                    <Popover.Dropdown>
                      <Stack gap="xs">
                        <Text size="sm">Delete this application?</Text>
                        <Group gap="xs" justify="flex-end">
                          <Button
                            size="xs"
                            variant="default"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="xs"
                            color="red"
                            onClick={() => {
                              trackEvent(AnalyticsEvents.RunDelete);
                              setConfirmDeleteId(null);
                              void onDelete(run.id);
                            }}
                          >
                            Delete
                          </Button>
                        </Group>
                      </Stack>
                    </Popover.Dropdown>
                  </Popover>
                </Group>
              </Group>
              {run.totalCount > 0 && (
                <Box hiddenFrom="sm" mt="sm">
                  <CompactCoverage coveredCount={run.coveredCount} totalCount={run.totalCount} />
                </Box>
              )}
            </Paper>
          );
        })}
      </Stack>

      {hiddenOlderCount > 0 && (
        <Paper
          radius="md"
          p="md"
          style={{
            border: `1px dashed ${proAccent.insightBorderColor}`,
            background: proAccent.insightBackground,
          }}
        >
          <Group justify="space-between" align="center" wrap="wrap" gap="md">
            <Group gap="md" wrap="nowrap">
              <ThemeIcon size={40} radius="md" variant="light" color={proAccent.badgeColor}>
                <IconLock size={18} />
              </ThemeIcon>
              <Stack gap={2}>
                <Text fw={600}>
                  {hiddenOlderCount} older {hiddenOlderCount === 1 ? 'application' : 'applications'}{' '}
                  saved
                </Text>
                <Text size="sm" c="dimmed">
                  Free accounts see the last 3. Pro keeps your full history, re-openable anytime.
                </Text>
              </Stack>
            </Group>
            <Button
              size="sm"
              variant="gradient"
              gradient={{ ...proAccent.gradient, deg: 45 }}
              rightSection={
                <Badge size="xs" variant="white" color="dark" radius="sm">
                  Pro
                </Badge>
              }
              onClick={onUpgradeClick}
            >
              Unlock full history
            </Button>
          </Group>
        </Paper>
      )}
    </Stack>
  );
};

export default ApplicationsList;
