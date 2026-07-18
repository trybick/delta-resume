import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Collapse,
  Group,
  Menu,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useAuth, useUser } from '@clerk/clerk-react';
import {
  IconAlertCircle,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconFileDescription,
  IconFileTypePdf,
  IconLock,
  IconMail,
  IconRefresh,
  IconSettings,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AnalyticsEvents, createDebouncedTracker, trackEvent } from '../lib/analytics';
import type { CoverLetterResult, CoverLetterSettings, CoverLetterStatus } from '../lib/types';
import {
  coverLetterLengthOptions,
  coverLetterToneOptions,
  defaultUserSettings,
} from '../lib/types';
import { getSettings, putSettings } from '../lib/api';
import { buildCoverLetterDocx, downloadDocx } from '../lib/exportDocx';
import { convertDocxToPdfWithFallback, downloadPdf } from '../lib/exportPdf';
import {
  formatCoverLetterText,
  formatCoverLetterSignature,
  prependCoverLetterDate,
} from '../lib/formatCoverLetter';
import { SAMPLE_COVER_LETTER_RESULT } from '../lib/mockTailor';
import { appTheme } from '../lib/theme';
import CoverLetterSettingsPanel from './CoverLetterSettingsPanel';

type CoverLetterPanelProps = {
  isProPlan: boolean;
  status: CoverLetterStatus;
  result: CoverLetterResult | null;
  errorMessage: string | null;
  isExample?: boolean;
  exampleResult?: CoverLetterResult;
  onRetry: () => void;
  onUpgradeClick: () => void;
};

const LockedTeaser = ({
  isProPlan,
  onUpgradeClick,
}: {
  isProPlan: boolean;
  onUpgradeClick: () => void;
}) => (
  <Card withBorder shadow="xs" padding="lg" style={{ position: 'relative', overflow: 'hidden' }}>
    <Stack gap="md" style={{ filter: 'blur(5px)', userSelect: 'none' }} aria-hidden>
      <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
        {prependCoverLetterDate(SAMPLE_COVER_LETTER_RESULT.letter)}
      </Text>
    </Stack>
    <Center
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'color-mix(in srgb, var(--mantine-color-body) 55%, transparent)',
      }}
    >
      <Stack align="center" gap="xs" p="md">
        <IconLock size={32} color="var(--mantine-primary-color-filled)" />
        <Group gap={6}>
          <Title order={5}>Cover letters are a Pro feature</Title>
          <Badge variant="gradient" gradient={{ ...appTheme.upgradeGradient, deg: 45 }}>
            Pro
          </Badge>
        </Group>
        <Text size="sm" c="dimmed" ta="center" maw={340}>
          Every tailor run also writes a matching cover letter, ready to copy or download as a
          polished .docx.
        </Text>
        {!isProPlan && (
          <Button
            mt={4}
            onClick={() => {
              trackEvent(AnalyticsEvents.CoverLetterUpgradeTeaser);
              onUpgradeClick();
            }}
          >
            Upgrade to Pro
          </Button>
        )}
      </Stack>
    </Center>
  </Card>
);

const ExampleCoverLetter = ({
  exampleResult,
  isProPlan,
  onUpgradeClick,
}: {
  exampleResult: CoverLetterResult;
  isProPlan: boolean;
  onUpgradeClick: () => void;
}) => (
  <Card withBorder shadow="xs" padding="lg">
    <Stack gap="md">
      <Group gap="sm">
        <Badge color="cyan" variant="light">
          Example
        </Badge>
      </Group>
      {!isProPlan && (
        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="sm" c="dimmed">
            On the Pro plan, every tailor run also writes a cover letter like this one.
          </Text>
          <Button
            size="xs"
            onClick={() => {
              trackEvent(AnalyticsEvents.CoverLetterUpgradeExample);
              onUpgradeClick();
            }}
          >
            Upgrade to Pro
          </Button>
        </Group>
      )}
      <Box
        p="md"
        style={{
          borderRadius: 8,
          border: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'var(--mantine-color-default-hover)',
        }}
      >
        <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
          {prependCoverLetterDate(exampleResult.letter)}
        </Text>
      </Box>
    </Stack>
  </Card>
);

const writingStageMessages: string[] = [
  'Reading the job description…',
  'Picking out your strongest matching experience…',
  'Drafting an opening that hooks the reader…',
  'Writing the body paragraphs…',
  'Wrapping up with a confident closing…',
];

const writingMessageIntervalMs = 2600;

const SkeletonParagraph = ({ widths }: { widths: string[] }) => (
  <Stack gap={8}>
    {widths.map((width, index) => (
      <Skeleton key={index} height={10} radius="xl" width={width} />
    ))}
  </Stack>
);

const WritingLoader = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % writingStageMessages.length);
    }, writingMessageIntervalMs);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <Card withBorder shadow="xs" padding="xl" style={{ position: 'relative', overflow: 'hidden' }}>
      <Box className="tailoring-loader-topbar" />
      <Stack gap="lg" mt="xs">
        <Group gap="sm" align="center">
          <Box className="tailoring-loader-sparkle" style={{ display: 'flex' }}>
            <IconMail size={24} color="var(--mantine-primary-color-filled)" />
          </Box>
          <Text
            key={messageIndex}
            size="sm"
            c="dimmed"
            className="tailoring-loader-message"
            aria-live="polite"
          >
            {writingStageMessages[messageIndex]}
          </Text>
        </Group>
        <Stack gap="lg">
          <Skeleton height={10} radius="xl" width="28%" />
          <SkeletonParagraph widths={['96%', '91%', '94%', '55%']} />
          <SkeletonParagraph widths={['93%', '97%', '88%', '95%', '42%']} />
          <SkeletonParagraph widths={['90%', '68%']} />
          <Stack gap={8}>
            <Skeleton height={10} radius="xl" width="18%" />
            <Skeleton height={10} radius="xl" width="24%" />
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
};

type NameAndSettingsRowProps = {
  candidateName: string;
  onCandidateNameChange: (value: string) => void;
  settingsOpened: boolean;
  onToggleSettings: () => void;
  settings: CoverLetterSettings;
  isSettingsLoading: boolean;
  onSettingsChange: (next: CoverLetterSettings) => void;
  trailing?: ReactNode;
};

const buildSettingsHint = (settings: CoverLetterSettings): string => {
  const lengthLabel =
    coverLetterLengthOptions
      .find((option) => option.value === settings.length)
      ?.label.split(' (')[0] ?? '';
  const toneLabel =
    coverLetterToneOptions.find((option) => option.value === settings.tone)?.label ?? '';
  return `${lengthLabel}, ${toneLabel}`;
};

const NameAndSettingsRow = ({
  candidateName,
  onCandidateNameChange,
  settingsOpened,
  onToggleSettings,
  settings,
  isSettingsLoading,
  onSettingsChange,
  trailing,
}: NameAndSettingsRowProps) => (
  <Stack gap="sm">
    <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
      <Group gap="sm" align="center" wrap="wrap" style={{ flex: '1 1 16rem', minWidth: 0 }}>
        <Text
          component="label"
          htmlFor="cover-letter-candidate-name"
          size="sm"
          fw={500}
          style={{ whiteSpace: 'nowrap' }}
        >
          Signature name
        </Text>
        <TextInput
          id="cover-letter-candidate-name"
          name="name"
          autoComplete="name"
          placeholder="e.g. Jordan Applicant"
          value={candidateName}
          onChange={(event) => onCandidateNameChange(event.currentTarget.value)}
          maw={280}
          style={{ flex: 1, minWidth: 140 }}
        />
      </Group>
      {trailing && (
        <Group gap="xs" wrap="nowrap" style={{ marginLeft: 'auto' }}>
          {trailing}
        </Group>
      )}
    </Group>
    <Group>
      <Button
        size="xs"
        variant={settingsOpened ? 'light' : 'subtle'}
        color="gray"
        leftSection={<IconSettings size={16} />}
        rightSection={
          <IconChevronDown
            size={14}
            style={{
              transform: settingsOpened ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms ease',
            }}
          />
        }
        aria-expanded={settingsOpened}
        onClick={onToggleSettings}
      >
        Settings
        {!isSettingsLoading && (
          <Text span size="xs" c="dimmed" ml={6}>
            {buildSettingsHint(settings)}
          </Text>
        )}
      </Button>
    </Group>
    <Collapse expanded={settingsOpened}>
      <Box
        p="md"
        style={{
          borderRadius: 8,
          border: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'var(--mantine-color-default-hover)',
        }}
      >
        <CoverLetterSettingsPanel
          settings={settings}
          isLoading={isSettingsLoading}
          onChange={onSettingsChange}
        />
      </Box>
    </Collapse>
  </Stack>
);

const CoverLetterPanel = ({
  isProPlan,
  status,
  result,
  errorMessage,
  isExample = false,
  exampleResult,
  onRetry,
  onUpgradeClick,
}: CoverLetterPanelProps) => {
  const { user } = useUser();
  const { has } = useAuth();
  const onProPlan = isProPlan || (has?.({ plan: 'pro' }) ?? false);
  const [candidateName, setCandidateName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [coverLetterSettings, setCoverLetterSettings] = useState<CoverLetterSettings>(
    defaultUserSettings.coverLetter,
  );
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const hasPrefilledName = useRef(false);
  const trackEditCandidateName = useMemo(
    () => createDebouncedTracker(AnalyticsEvents.EditCandidateName),
    [],
  );

  const clerkFullName = user?.fullName ?? '';

  useEffect(() => {
    if (hasPrefilledName.current || clerkFullName.length === 0) return;
    hasPrefilledName.current = true;
    setCandidateName((current) => (current.length === 0 ? clerkFullName : current));
  }, [clerkFullName]);

  useEffect(() => {
    if (!onProPlan || isExample) return;
    let cancelled = false;
    setIsSettingsLoading(true);
    getSettings()
      .then((settings) => {
        if (cancelled) return;
        setCoverLetterSettings(settings.coverLetter);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onProPlan, isExample]);

  const handleToggleSettings = () => {
    setSettingsOpened((current) => {
      const next = !current;
      trackEvent(AnalyticsEvents.CoverLetterSettingsToggle, { open: next });
      return next;
    });
  };

  const handleSettingsChange = async (next: CoverLetterSettings) => {
    const previous = coverLetterSettings;
    setCoverLetterSettings(next);
    try {
      await putSettings({ coverLetter: next });
      trackEvent(AnalyticsEvents.CoverLetterSettingsSave, {
        length: next.length,
        tone: next.tone,
      });
    } catch {
      setCoverLetterSettings(previous);
      notifications.show({
        color: 'red',
        title: 'Could not save settings',
        message: 'Something went wrong. Please try again.',
      });
    }
  };

  const handleCandidateNameChange = (value: string) => {
    trackEditCandidateName();
    setCandidateName(value);
  };

  const nameAndSettingsRow = (
    <NameAndSettingsRow
      candidateName={candidateName}
      onCandidateNameChange={handleCandidateNameChange}
      settingsOpened={settingsOpened}
      onToggleSettings={handleToggleSettings}
      settings={coverLetterSettings}
      isSettingsLoading={isSettingsLoading}
      onSettingsChange={handleSettingsChange}
    />
  );

  if (isExample && exampleResult) {
    return (
      <ExampleCoverLetter
        exampleResult={exampleResult}
        isProPlan={onProPlan}
        onUpgradeClick={onUpgradeClick}
      />
    );
  }

  if (!onProPlan) {
    return <LockedTeaser isProPlan={onProPlan} onUpgradeClick={onUpgradeClick} />;
  }

  if (status === 'idle') {
    return (
      <Card withBorder shadow="xs" padding="lg">
        <Stack gap="md">
          {nameAndSettingsRow}
          <Stack align="center" gap="xs" py="md">
            <IconMail size={32} color="var(--mantine-primary-color-filled)" />
            <Title order={5}>No cover letter yet</Title>
            <Text size="sm" c="dimmed" ta="center" maw={340}>
              Your next tailor run will also write a matching cover letter, and it will show up here.
            </Text>
          </Stack>
        </Stack>
      </Card>
    );
  }

  if (status === 'loading') return <WritingLoader />;

  if (status === 'error') {
    return (
      <Card withBorder shadow="xs" padding="lg">
        <Stack gap="md">
          {nameAndSettingsRow}
          <Alert color="red" icon={<IconAlertCircle size={18} />} title="Cover letter failed">
            {errorMessage ?? 'Something went wrong while writing your cover letter.'}
          </Alert>
          <Group>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={() => {
                trackEvent(AnalyticsEvents.CoverLetterRetry);
                onRetry();
              }}
            >
              Try again
            </Button>
          </Group>
        </Stack>
      </Card>
    );
  }

  if (!result) return null;

  const displayLetter = formatCoverLetterText(result.letter, candidateName);

  const handleCopy = async () => {
    trackEvent(AnalyticsEvents.CoverLetterCopy);
    try {
      await navigator.clipboard.writeText(displayLetter);
      trackEvent(AnalyticsEvents.CopySuccess, { source: 'cover_letter' });
      notifications.show({
        color: 'green',
        title: 'Copied',
        message: 'Cover letter copied to clipboard.',
      });
    } catch {
      trackEvent(AnalyticsEvents.CopyFailure, { source: 'cover_letter' });
      notifications.show({
        color: 'red',
        title: 'Copy failed',
        message: 'Could not copy the cover letter to your clipboard.',
      });
    }
  };

  const buildCoverLetterBlob = (): Promise<Blob> =>
    buildCoverLetterDocx(
      formatCoverLetterSignature(result.letter, candidateName),
      candidateName,
      result.jobTitle,
      result.companyName,
    );

  const handleExport = async (format: 'docx' | 'pdf') => {
    if (isExporting) return;
    trackEvent(AnalyticsEvents.CoverLetterExport, { format });
    setIsExporting(true);
    try {
      const docxBlob = await buildCoverLetterBlob();
      if (format === 'docx') {
        downloadDocx(docxBlob, 'cover-letter.docx');
        trackEvent(AnalyticsEvents.ExportSuccess, {
          source: 'cover_letter',
          format,
        });
        return;
      }
      try {
        const pdfBlob = await convertDocxToPdfWithFallback(docxBlob);
        downloadPdf(pdfBlob, 'cover-letter.pdf');
        trackEvent(AnalyticsEvents.ExportSuccess, {
          source: 'cover_letter',
          format,
        });
      } catch {
        trackEvent(AnalyticsEvents.ExportFailure, {
          source: 'cover_letter',
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
        source: 'cover_letter',
        format,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card withBorder shadow="xs" padding="lg">
      <Stack gap="md">
        <NameAndSettingsRow
          candidateName={candidateName}
          onCandidateNameChange={handleCandidateNameChange}
          settingsOpened={settingsOpened}
          onToggleSettings={handleToggleSettings}
          settings={coverLetterSettings}
          isSettingsLoading={isSettingsLoading}
          onSettingsChange={handleSettingsChange}
          trailing={
            <Menu
              position="bottom-end"
              withinPortal
              onOpen={() => trackEvent(AnalyticsEvents.CoverLetterExportMenuOpen)}
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
                <Menu.Item leftSection={<IconCopy size={16} />} onClick={handleCopy}>
                  Copy to clipboard
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconFileDescription size={16} />}
                  onClick={() => handleExport('docx')}
                >
                  Word (.docx)
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFileTypePdf size={16} />}
                  onClick={() => handleExport('pdf')}
                >
                  PDF (.pdf)
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          }
        />
        <Box
          p="md"
          style={{
            borderRadius: 8,
            border: '1px solid var(--mantine-color-default-border)',
            backgroundColor: 'var(--mantine-color-default-hover)',
          }}
        >
          <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {displayLetter}
          </Text>
        </Box>
      </Stack>
    </Card>
  );
};

export default CoverLetterPanel;
