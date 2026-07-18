import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Group,
  Menu,
  Stack,
  Text,
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
  IconMail,
  IconRefresh,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AnalyticsEvents, createDebouncedTracker, trackEvent } from '../lib/analytics';
import type { CoverLetterResult, CoverLetterSettings, CoverLetterStatus } from '../lib/types';
import { defaultUserSettings } from '../lib/types';
import { getSettings, putSettings } from '../lib/api';
import { buildCoverLetterDocx, downloadDocx } from '../lib/exportDocx';
import { convertDocxToPdfWithFallback, downloadPdf } from '../lib/exportPdf';
import {
  formatCoverLetterText,
  formatCoverLetterSignature,
} from '../lib/formatCoverLetter';
import ExampleCoverLetter from './ExampleCoverLetter';
import LockedTeaser from './LockedTeaser';
import NameAndSettingsRow from './NameAndSettingsRow';
import WritingLoader from './WritingLoader';

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
