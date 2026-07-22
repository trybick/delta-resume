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
import type { CoverLetterResult, CoverLetterStatus } from '../lib/types';
import { buildCoverLetterDocx, downloadDocx } from '../lib/exportDocx';
import { buildExportFilename } from '../lib/exportFilename';
import { PdfConversionError, convertDocxToPdf, downloadPdf } from '../lib/exportPdf';
import {
  formatCoverLetterText,
  formatCoverLetterSignature,
} from '../lib/formatCoverLetter';
import { useCoverLetterSettings } from '../hooks/useCoverLetterSettings';
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
  onShowExample?: () => void;
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
  onShowExample,
}: CoverLetterPanelProps) => {
  const { user } = useUser();
  const { has } = useAuth();
  const onProPlan = isProPlan || (has?.({ plan: 'pro' }) ?? false);
  const [candidateName, setCandidateName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const hasPrefilledName = useRef(false);
  const trackEditCandidateName = useMemo(
    () => createDebouncedTracker(AnalyticsEvents.EditCandidateName),
    [],
  );
  const {
    settings: coverLetterSettings,
    isSettingsLoading,
    settingsOpened,
    handleToggleSettings,
    handleSettingsChange,
  } = useCoverLetterSettings({ enabled: onProPlan && !isExample });

  const clerkFullName = user?.fullName ?? '';

  useEffect(() => {
    if (hasPrefilledName.current || clerkFullName.length === 0) return;
    hasPrefilledName.current = true;
    setCandidateName((current) => (current.length === 0 ? clerkFullName : current));
  }, [clerkFullName]);

  const handleCandidateNameChange = (value: string) => {
    trackEditCandidateName();
    setCandidateName(value);
  };

  const disabledExportButton = (
    <Button
      size="xs"
      variant="light"
      leftSection={<IconDownload size={16} />}
      rightSection={<IconChevronDown size={14} />}
      disabled
    >
      Export
    </Button>
  );

  const nameAndSettingsRow = (
    <NameAndSettingsRow
      candidateName={candidateName}
      onCandidateNameChange={handleCandidateNameChange}
      settingsOpened={settingsOpened}
      onToggleSettings={handleToggleSettings}
      settings={coverLetterSettings}
      isSettingsLoading={isSettingsLoading}
      onSettingsChange={handleSettingsChange}
      trailing={disabledExportButton}
    />
  );

  if (isExample && exampleResult) {
    return (
      <ExampleCoverLetter
        exampleResult={exampleResult}
        isProPlan={onProPlan}
        onUpgradeClick={onUpgradeClick}
        candidateName={candidateName}
        onCandidateNameChange={handleCandidateNameChange}
        settingsOpened={settingsOpened}
        onToggleSettings={handleToggleSettings}
        settings={coverLetterSettings}
        isSettingsLoading={isSettingsLoading}
        onSettingsChange={handleSettingsChange}
      />
    );
  }

  if (!onProPlan) {
    return (
      <LockedTeaser
        isProPlan={onProPlan}
        onUpgradeClick={onUpgradeClick}
        onShowExample={onShowExample}
      />
    );
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
      const filename = buildExportFilename(
        [candidateName, result.companyName, 'cover-letter'],
        'cover-letter',
        format,
      );
      if (format === 'docx') {
        downloadDocx(docxBlob, filename);
        trackEvent(AnalyticsEvents.ExportSuccess, {
          source: 'cover_letter',
          format,
        });
        return;
      }
      const pdfBlob = await convertDocxToPdf(docxBlob);
      downloadPdf(pdfBlob, filename);
      trackEvent(AnalyticsEvents.ExportSuccess, {
        source: 'cover_letter',
        format,
      });
    } catch (error) {
      trackEvent(AnalyticsEvents.ExportFailure, {
        source: 'cover_letter',
        format,
      });
      if (!(error instanceof PdfConversionError)) {
        notifications.show({
          color: 'red',
          title: 'Export failed',
          message: 'Could not generate the file. Please try again.',
        });
      }
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
