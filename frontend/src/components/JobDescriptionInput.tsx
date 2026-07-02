import { Card, Group, Stack, Text, Textarea, Title } from '@mantine/core'

type JobDescriptionInputProps = {
  value: string
  onChange: (text: string) => void
}

const JobDescriptionInput = ({ value, onChange }: JobDescriptionInputProps) => {
  return (
    <Card withBorder shadow="xs" padding="lg">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Title order={4}>Job description</Title>
          <Text size="xs" c="dimmed">
            {value.length.toLocaleString()} characters
          </Text>
        </Group>
        <Textarea
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="Paste the job description you're targeting…"
          autosize
          minRows={8}
          maxRows={14}
        />
      </Stack>
    </Card>
  )
}

export default JobDescriptionInput
