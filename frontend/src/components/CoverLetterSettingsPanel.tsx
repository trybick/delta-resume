import { Group, Select, Stack, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { coverLetterLengthOptions, coverLetterToneOptions } from '../lib/types';
import type { CoverLetterLength, CoverLetterSettings, CoverLetterTone } from '../lib/types';

type CoverLetterSettingsPanelProps = {
  settings: CoverLetterSettings;
  isLoading: boolean;
  onChange: (next: CoverLetterSettings) => void;
};

const CoverLetterSettingsPanel = ({
  settings,
  isLoading,
  onChange,
}: CoverLetterSettingsPanelProps) => {
  const handleLengthChange = (value: string | null) => {
    if (!value) return;
    onChange({ ...settings, length: value as CoverLetterLength });
  };

  const handleToneChange = (value: string | null) => {
    if (!value) return;
    onChange({ ...settings, tone: value as CoverLetterTone });
  };

  return (
    <Stack gap="sm">
      <Group grow align="flex-start" preventGrowOverflow={false}>
        <Select
          label="Length"
          data={coverLetterLengthOptions}
          value={settings.length}
          onChange={handleLengthChange}
          allowDeselect={false}
          disabled={isLoading}
        />
        <Select
          label="Tone"
          data={coverLetterToneOptions}
          value={settings.tone}
          onChange={handleToneChange}
          allowDeselect={false}
          disabled={isLoading}
        />
      </Group>
      <Group gap={6} align="center" wrap="nowrap">
        <IconInfoCircle size={16} color="var(--mantine-color-dimmed)" />
        <Text size="sm" c="dimmed">
          Changes save automatically and apply to your next cover letter.
        </Text>
      </Group>
    </Stack>
  );
};

export default CoverLetterSettingsPanel;
