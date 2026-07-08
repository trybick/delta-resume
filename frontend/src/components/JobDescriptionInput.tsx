import { useMemo } from 'react'
import { Card, Group, Stack, Text, Textarea, Title } from '@mantine/core'
import { AnalyticsEvents, createDebouncedTracker } from '../lib/analytics'

export const JOB_DESCRIPTION_MAX_LENGTH = 10000

type JobDescriptionInputProps = {
  value: string
  onChange: (text: string) => void
}

const JobDescriptionInput = ({ value, onChange }: JobDescriptionInputProps) => {
  const remainingCharacters = JOB_DESCRIPTION_MAX_LENGTH - value.length
  const trackEditJobDescription = useMemo(
    () => createDebouncedTracker(AnalyticsEvents.EditJobDescription),
    [],
  )

  return (
    <Card withBorder shadow="xs" padding="lg">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Title order={4}>Job description</Title>
          <Text size="xs" c={remainingCharacters <= 0 ? 'red' : 'dimmed'}>
            {remainingCharacters.toLocaleString()} characters left
          </Text>
        </Group>
        <Textarea
          value={value}
          onChange={(event) => {
            trackEditJobDescription()
            onChange(event.currentTarget.value.slice(0, JOB_DESCRIPTION_MAX_LENGTH))
          }}
          placeholder="Paste the job description you're targeting…"
          maxLength={JOB_DESCRIPTION_MAX_LENGTH}
          autosize
          minRows={8}
          maxRows={8}
        />
      </Stack>
    </Card>
  )
}

export default JobDescriptionInput
