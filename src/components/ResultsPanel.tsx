import { useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import { IconCopy, IconCopyCheck, IconSparkles } from '@tabler/icons-react'
import type { BulletChange, ChangeDecision, TailorResult, TailorStatus } from '../lib/types'
import DiffBullet from './DiffBullet'

type ResultsPanelProps = {
  status: TailorStatus
  result: TailorResult | null
}

const buildDecisionMap = (result: TailorResult | null): Record<string, ChangeDecision> => {
  if (!result) return {}
  return Object.fromEntries(result.changes.map((change) => [change.id, 'pending']))
}

const ResultsPanel = ({ status, result }: ResultsPanelProps) => {
  const [decisions, setDecisions] = useState<Record<string, ChangeDecision>>(() =>
    buildDecisionMap(result),
  )
  const clipboard = useClipboard({ timeout: 1500 })

  const changesByLine = useMemo(() => {
    if (!result) return new Map<number, BulletChange>()
    return new Map(result.changes.map((change) => [change.lineIndex, change]))
  }, [result])

  const handleDecisionChange = (id: string, decision: ChangeDecision) => {
    setDecisions((current) => ({ ...current, [id]: decision }))
  }

  const handleCopy = () => {
    if (!result) return
    const lines = result.resumeText.split('\n').map((line, lineIndex) => {
      const change = changesByLine.get(lineIndex)
      if (!change) return line
      return decisions[change.id] === 'rejected' ? change.original : change.tailored
    })
    clipboard.copy(lines.join('\n'))
  }

  if (status === 'idle') {
    return (
      <Card withBorder shadow="xs" padding="xl" h="100%">
        <Center h="100%" mih={360}>
          <Stack align="center" gap="xs">
            <IconSparkles size={40} color="var(--mantine-color-indigo-4)" />
            <Title order={4}>Your tailored resume will appear here</Title>
            <Text size="sm" c="dimmed" ta="center" maw={360}>
              Attach your base resume, paste a job description, and click
              &ldquo;Tailor Resume&rdquo; to see suggested bullet changes.
            </Text>
          </Stack>
        </Center>
      </Card>
    )
  }

  if (status === 'loading') {
    return (
      <Card withBorder shadow="xs" padding="xl" h="100%">
        <Center h="100%" mih={360}>
          <Stack align="center" gap="sm">
            <Loader size="md" />
            <Text size="sm" c="dimmed">
              Analyzing your resume against the job description…
            </Text>
          </Stack>
        </Center>
      </Card>
    )
  }

  if (!result) return null

  const decisionValues = result.changes.map((change) => decisions[change.id] ?? 'pending')
  const acceptedCount = decisionValues.filter((d) => d === 'accepted').length
  const rejectedCount = decisionValues.filter((d) => d === 'rejected').length
  const lines = result.resumeText.split('\n')

  return (
    <Card withBorder shadow="xs" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="sm">
            <Title order={4}>
              {result.changes.length} bullet{result.changes.length === 1 ? '' : 's'} updated
            </Title>
            <Badge color="green" variant="light">
              {acceptedCount} accepted
            </Badge>
            <Badge color="red" variant="light">
              {rejectedCount} rejected
            </Badge>
          </Group>
          <Button
            size="xs"
            variant="light"
            leftSection={
              clipboard.copied ? <IconCopyCheck size={16} /> : <IconCopy size={16} />
            }
            onClick={handleCopy}
          >
            {clipboard.copied ? 'Copied' : 'Copy tailored resume'}
          </Button>
        </Group>

        <div>
          {lines.map((line, lineIndex) => {
            const change = changesByLine.get(lineIndex)
            if (change) {
              return (
                <DiffBullet
                  key={change.id}
                  change={change}
                  decision={decisions[change.id] ?? 'pending'}
                  onDecisionChange={handleDecisionChange}
                />
              )
            }
            return (
              <Text
                key={lineIndex}
                c="dimmed"
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  minHeight: line.trim() === '' ? 20 : undefined,
                }}
              >
                {line}
              </Text>
            )
          })}
        </div>
      </Stack>
    </Card>
  )
}

export default ResultsPanel
