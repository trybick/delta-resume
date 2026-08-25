import type { ReactNode } from 'react';
import { Badge, Box, Button, Collapse, Group, Stack, Text, TextInput } from '@mantine/core';
import { IconChevronDown, IconSettings } from '@tabler/icons-react';
import {
  coverLetterLengthOptions,
  coverLetterToneOptions,
  type CoverLetterSettings,
} from '../lib/types';
import { proAccent } from '../lib/proAccent';
import CoverLetterSettingsPanel from './CoverLetterSettingsPanel';

type NameAndSettingsRowProps = {
  candidateName: string;
  onCandidateNameChange: (value: string) => void;
  settingsOpened: boolean;
  onToggleSettings: () => void;
  settings: CoverLetterSettings;
  isSettingsLoading: boolean;
  onSettingsChange: (next: CoverLetterSettings) => void;
  isProPlan: boolean;
  onUpgradeClick: () => void;
  trailing?: ReactNode;
  settingsDisabled?: boolean;
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
  isProPlan,
  onUpgradeClick,
  trailing,
  settingsDisabled = false,
}: NameAndSettingsRowProps) => {
  const handleToggleSettings = () => {
    if (!isProPlan) {
      onUpgradeClick();
      return;
    }
    onToggleSettings();
  };

  return (
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
          disabled={isProPlan && settingsDisabled}
          onClick={handleToggleSettings}
        >
          Settings
          {!isProPlan && (
            <Badge
              size="xs"
              variant="gradient"
              gradient={{ ...proAccent.gradient, deg: 45 }}
              h={16}
              ml={6}
            >
              Pro
            </Badge>
          )}
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
};

export default NameAndSettingsRow;
