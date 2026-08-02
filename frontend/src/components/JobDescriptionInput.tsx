import { useMemo } from 'react';
import { Button, Card, Group, Stack, Text, Textarea, Title } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { AnalyticsEvents, createDebouncedTracker, trackEvent } from '../lib/analytics';

export const JOB_DESCRIPTION_MAX_LENGTH = 10000;

type JobDescriptionInputProps = {
  value: string;
  onChange: (text: string) => void;
};

const JobDescriptionInput = ({ value, onChange }: JobDescriptionInputProps) => {
  const remainingCharacters = JOB_DESCRIPTION_MAX_LENGTH - value.length;
  const hasContent = value.length > 0;
  const trackEditJobDescription = useMemo(
    () => createDebouncedTracker(AnalyticsEvents.EditJobDescription),
    [],
  );

  const handleRemove = () => {
    trackEvent(AnalyticsEvents.ClearJobDescription);
    onChange('');
  };

  return (
    <Card withBorder shadow="xs" padding="lg">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Title order={4}>2 · Job description</Title>
          {hasContent && (
            <Group gap="xs" align="center">
              <Button
                variant="subtle"
                color="gray"
                size="compact-xs"
                leftSection={<IconX size={14} />}
                onClick={handleRemove}
                aria-label="Remove job description"
              >
                Remove
              </Button>
              <Text size="xs" c={remainingCharacters <= 0 ? 'red' : 'dimmed'}>
                {remainingCharacters.toLocaleString()} characters left
              </Text>
            </Group>
          )}
        </Group>
        <Textarea
          aria-label="Job description"
          name="job-description"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            trackEditJobDescription();
            onChange(event.currentTarget.value.slice(0, JOB_DESCRIPTION_MAX_LENGTH));
          }}
          placeholder="Paste the job description you're targeting…"
          maxLength={JOB_DESCRIPTION_MAX_LENGTH}
          styles={{
            input: {
              height: '9.35rem',
            },
          }}
        />
      </Stack>
    </Card>
  );
};

export default JobDescriptionInput;
