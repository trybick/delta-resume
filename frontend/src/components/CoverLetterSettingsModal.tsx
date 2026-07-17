import { useEffect, useState } from 'react';
import { Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { getSettings, putSettings } from '../lib/api';
import {
  coverLetterLengthOptions,
  coverLetterToneOptions,
  defaultUserSettings,
} from '../lib/types';
import type { CoverLetterLength, CoverLetterTone } from '../lib/types';

type CoverLetterSettingsModalProps = {
  opened: boolean;
  onClose: () => void;
};

const CoverLetterSettingsModal = ({ opened, onClose }: CoverLetterSettingsModalProps) => {
  const [length, setLength] = useState<CoverLetterLength>(defaultUserSettings.coverLetter.length);
  const [tone, setTone] = useState<CoverLetterTone>(defaultUserSettings.coverLetter.tone);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    setIsLoading(true);
    getSettings()
      .then((settings) => {
        if (cancelled) return;
        setLength(settings.coverLetter.length);
        setTone(settings.coverLetter.tone);
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await putSettings({ coverLetter: { length, tone } });
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
    <Modal opened={opened} onClose={onClose} title="Cover letter settings" centered>
      <Stack gap="md">
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
        <Group gap={6} align="center" wrap="nowrap">
          <IconInfoCircle size={16} color="var(--mantine-color-dimmed)" />
          <Text size="sm" c="dimmed">
            Settings will apply to your next cover letter.
          </Text>
        </Group>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSaving} disabled={isLoading}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default CoverLetterSettingsModal;
