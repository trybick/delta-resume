import { useEffect, useRef, useState } from 'react';
import { Group, Select, Stack, Text } from '@mantine/core';
import { IconCheck, IconInfoCircle } from '@tabler/icons-react';
import { coverLetterLengthOptions, coverLetterToneOptions } from '../lib/types';
import type { CoverLetterLength, CoverLetterSettings, CoverLetterTone } from '../lib/types';

type SettingsField = 'length' | 'tone';

type CoverLetterSettingsPanelProps = {
  settings: CoverLetterSettings;
  isLoading: boolean;
  onChange: (next: CoverLetterSettings) => Promise<void>;
};

const SAVED_FLASH_MS = 2000;

const isCoverLetterLength = (value: string): value is CoverLetterLength =>
  coverLetterLengthOptions.some((option) => option.value === value);

const isCoverLetterTone = (value: string): value is CoverLetterTone =>
  coverLetterToneOptions.some((option) => option.value === value);

type SavedFieldLabelProps = {
  label: string;
  saved: boolean;
};

const SavedFieldLabel = ({ label, saved }: SavedFieldLabelProps) => (
  <Group gap={6} component="span" wrap="nowrap">
    {label}
    {saved && (
      <IconCheck
        size={14}
        color="var(--mantine-color-green-filled)"
        aria-label="Saved"
      />
    )}
  </Group>
);

const CoverLetterSettingsPanel = ({
  settings,
  isLoading,
  onChange,
}: CoverLetterSettingsPanelProps) => {
  const [savedFields, setSavedFields] = useState<Record<SettingsField, boolean>>({
    length: false,
    tone: false,
  });
  const savedTimers = useRef<Partial<Record<SettingsField, number>>>({});

  useEffect(() => {
    const timers = savedTimers.current;
    return () => {
      Object.values(timers).forEach((id) => {
        if (id !== undefined) window.clearTimeout(id);
      });
    };
  }, []);

  const flashSaved = (field: SettingsField) => {
    window.clearTimeout(savedTimers.current[field]);
    setSavedFields((current) => ({ ...current, [field]: true }));
    savedTimers.current[field] = window.setTimeout(() => {
      setSavedFields((current) => ({ ...current, [field]: false }));
    }, SAVED_FLASH_MS);
  };

  const handleLengthChange = (value: string | null) => {
    if (!value || !isCoverLetterLength(value)) return;
    void onChange({ ...settings, length: value })
      .then(() => flashSaved('length'))
      .catch(() => undefined);
  };

  const handleToneChange = (value: string | null) => {
    if (!value || !isCoverLetterTone(value)) return;
    void onChange({ ...settings, tone: value })
      .then(() => flashSaved('tone'))
      .catch(() => undefined);
  };

  return (
    <Stack gap="sm">
      <Group grow align="flex-start" preventGrowOverflow={false}>
        <Select
          label={<SavedFieldLabel label="Length" saved={savedFields.length} />}
          data={coverLetterLengthOptions}
          value={settings.length}
          onChange={handleLengthChange}
          allowDeselect={false}
          disabled={isLoading}
        />
        <Select
          label={<SavedFieldLabel label="Tone" saved={savedFields.tone} />}
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
