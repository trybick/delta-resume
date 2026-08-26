import { Box, Button, Card, Group, Stack, Text } from '@mantine/core';
import { IconChevronDown, IconDownload } from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { prependCoverLetterDate } from '../lib/formatCoverLetter';
import { proAccent } from '../lib/proAccent';
import { useProUpgradeCtaLabel } from '../hooks/useProPlan';
import type { CoverLetterResult, CoverLetterSettings } from '../lib/types';
import NameAndSettingsRow from './NameAndSettingsRow';

type ExampleCoverLetterProps = {
  exampleResult: CoverLetterResult;
  isProPlan: boolean;
  onUpgradeClick: () => void;
  candidateName: string;
  onCandidateNameChange: (value: string) => void;
  settingsOpened: boolean;
  onToggleSettings: () => void;
  settings: CoverLetterSettings;
  isSettingsLoading: boolean;
  onSettingsChange: (next: CoverLetterSettings) => Promise<void>;
};

const ExampleCoverLetter = ({
  exampleResult,
  isProPlan,
  onUpgradeClick,
  candidateName,
  onCandidateNameChange,
  settingsOpened,
  onToggleSettings,
  settings,
  isSettingsLoading,
  onSettingsChange,
}: ExampleCoverLetterProps) => {
  const upgradeCtaLabel = useProUpgradeCtaLabel();

  return (
    <Card withBorder shadow="xs" padding="lg">
      <Stack gap="md">
        <NameAndSettingsRow
          candidateName={candidateName}
          onCandidateNameChange={onCandidateNameChange}
          settingsOpened={settingsOpened}
          onToggleSettings={onToggleSettings}
          settings={settings}
          isSettingsLoading={isSettingsLoading}
          onSettingsChange={onSettingsChange}
          isProPlan={isProPlan}
          onUpgradeClick={onUpgradeClick}
          settingsDisabled
          trailing={
            <Button
              size="xs"
              variant="light"
              leftSection={<IconDownload size={16} />}
              rightSection={<IconChevronDown size={14} />}
              disabled
            >
              Export
            </Button>
          }
        />
        {!isProPlan && (
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm" c="dimmed">
              On the Pro plan, you can pick the length and tone of every cover letter.
            </Text>
            <Button
              size="xs"
              variant="gradient"
              gradient={{ ...proAccent.gradient, deg: 45 }}
              onClick={() => {
                trackEvent(AnalyticsEvents.CoverLetterUpgradeExample);
                onUpgradeClick();
              }}
            >
              {upgradeCtaLabel}
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
};

export default ExampleCoverLetter;
