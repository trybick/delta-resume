import { useEffect, useState } from 'react';
import { Button, Group, Select, Stack, Text } from '@mantine/core';
import { IconInfoCircle, IconSettings } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { getSettings, putSettings } from '../lib/api';
import {
  coverLetterLengthOptions,
  coverLetterToneOptions,
  defaultUserSettings,
} from '../lib/types';
import type { CoverLetterLength, CoverLetterTone } from '../lib/types';

type CoverLetterSettingsPanelProps = {
  opened: boolean;
  onClose: () => void;
};

const CoverLetterSettingsPanel = ({ opened, onClose }: CoverLetterSettingsPanelProps) => {
  const [length, setLength] = useState<CoverLetterLength>(defaultUserSettings.coverLetter.length);
  const [tone, setTone] = useState<CoverLetterTone>(defaultUserSettings.coverLetter.tone);
  const [savedLength, setSavedLength] = useState<CoverLetterLength>(
    defaultUserSettings.coverLetter.length,
  );
  const [savedTone, setSavedTone] = useState<CoverLetterTone>(defaultUserSettings.coverLetter.tone);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = length !== savedLength || tone !== savedTone;

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    setIsLoading(true);
    getSettings()
      .then((settings) => {
        if (cancelled) return;
        setLength(settings.coverLetter.length);
        setTone(settings.coverLetter.tone);
        setSavedLength(settings.coverLetter.length);
        setSavedTone(settings.coverLetter.tone);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [opened]);

  const handleLengthChange = (value: string | null) => {
    if (!value) return;
    setLength(value as CoverLetterLength);
  };

  const handleToneChange = (value: string | null) => {
    if (!value) return;
    setTone(value as CoverLetterTone);
  };

  const handleCancel = () => {
    trackEvent(AnalyticsEvents.CoverLetterSettingsCancel);
    onClose();
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      await putSettings({ coverLetter: { length, tone } });
      setSavedLength(length);
      setSavedTone(tone);
      trackEvent(AnalyticsEvents.CoverLetterSettingsSave, { length, tone });
      notifications.show({
        title: 'Settings saved',
        message: 'They will apply to your next cover letter.',
      });
      onClose();
    } catch {
      notifications.show({
        color: 'red',
        title: 'Could not save settings',
        message: 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack gap="sm">
      <Group gap={6} align="center" wrap="nowrap">
        <IconSettings size={16} color="var(--mantine-primary-color-filled)" />
        <Text size="sm" fw={600}>
          Cover letter settings
        </Text>
      </Group>
      <Group grow align="flex-start" preventGrowOverflow={false}>
        <Select
          label="Length"
          data={coverLetterLengthOptions}
          value={length}
          onChange={handleLengthChange}
          allowDeselect={false}
          disabled={isLoading}
        />
        <Select
          label="Tone"
          data={coverLetterToneOptions}
          value={tone}
          onChange={handleToneChange}
          allowDeselect={false}
          disabled={isLoading}
        />
      </Group>
      <Group gap={6} align="center" wrap="nowrap">
        <IconInfoCircle size={16} color="var(--mantine-color-dimmed)" />
        <Text size="sm" c="dimmed">
          Settings will apply to your next cover letter.
        </Text>
      </Group>
      <Group justify="flex-end">
        <Button variant="default" size="xs" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          size="xs"
          onClick={handleSave}
          loading={isSaving}
          disabled={isLoading || !hasChanges}
        >
          Save
        </Button>
      </Group>
    </Stack>
  );
};

export default CoverLetterSettingsPanel;
