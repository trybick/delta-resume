import { useState } from 'react'
import {
  ActionIcon,
  Badge,
  Group,
  Paper,
  SegmentedControl,
  Text,
  Tooltip,
} from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import { IconCheck, IconCopy, IconCopyCheck, IconX } from '@tabler/icons-react'
import { diffWords } from 'diff'
import type { BulletChange, ChangeDecision } from '../lib/types'

type DiffBulletProps = {
  change: BulletChange
  decision: ChangeDecision
  onDecisionChange: (id: string, decision: ChangeDecision) => void
}

type DiffView = 'diff' | 'original' | 'tailored'

const borderColorByDecision: Record<ChangeDecision, string> = {
  pending: 'var(--mantine-primary-color-filled)',
  accepted: 'var(--mantine-color-green-6)',
  rejected: 'var(--mantine-color-red-6)',
}

const DiffBullet = ({ change, decision, onDecisionChange }: DiffBulletProps) => {
  const [view, setView] = useState<DiffView>('diff')
  const clipboard = useClipboard({ timeout: 1500 })

  const handleCopyBullet = () => {
    if (view === 'original') {
      clipboard.copy(change.original)
      return
    }
    if (view === 'tailored') {
      clipboard.copy(change.tailored)
      return
    }
    clipboard.copy(decision === 'rejected' ? change.original : change.tailored)
  }

  const handleAccept = () => {
    onDecisionChange(change.id, decision === 'accepted' ? 'pending' : 'accepted')
  }

  const handleReject = () => {
    onDecisionChange(change.id, decision === 'rejected' ? 'pending' : 'rejected')
  }

  const renderContent = () => {
    if (view === 'original') {
      return <Text style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{change.original}</Text>
    }
    if (view === 'tailored') {
      return <Text style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{change.tailored}</Text>
    }
    const parts = diffWords(change.original, change.tailored)
    return (
      <Text component="div" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, lineHeight: 1.7 }}>
        {parts.map((part, index) => {
          if (part.added) {
            return (
              <span
                key={index}
                style={{
                  backgroundColor: 'rgba(64, 192, 87, 0.16)',
                  color: 'var(--mantine-color-green-3)',
                  borderRadius: 3,
                  padding: '1px 2px',
                }}
              >
                {part.value}
              </span>
            )
          }
          if (part.removed) {
            return (
              <span
                key={index}
                style={{
                  backgroundColor: 'rgba(250, 82, 82, 0.14)',
                  color: 'var(--mantine-color-red-3)',
                  textDecoration: 'line-through',
                  borderRadius: 3,
                  padding: '1px 2px',
                }}
              >
                {part.value}
              </span>
            )
          }
          return <span key={index}>{part.value}</span>
        })}
      </Text>
    )
  }

  return (
    <Paper
      withBorder
      p="sm"
      my={6}
      radius="md"
      style={{
        borderLeft: `3px solid ${borderColorByDecision[decision]}`,
        opacity: decision === 'rejected' ? 0.6 : 1,
      }}
    >
      <Group justify="space-between" mb={8} wrap="nowrap">
        <Group gap={8} wrap="nowrap">
          {change.kind === 'skill' && (
            <Badge size="sm" color="grape" variant="light">
              Skills
            </Badge>
          )}
          <SegmentedControl
            size="xs"
            value={view}
            onChange={(value) => setView(value as DiffView)}
            data={[
              { label: 'Inline diff', value: 'diff' },
              { label: 'Original', value: 'original' },
              { label: 'Tailored', value: 'tailored' },
            ]}
          />
        </Group>
        <Group gap={4} wrap="nowrap">
          <Tooltip label={clipboard.copied ? 'Copied' : 'Copy bullet'}>
            <ActionIcon
              variant="light"
              color="gray"
              onClick={handleCopyBullet}
              aria-label="Copy bullet"
            >
              {clipboard.copied ? <IconCopyCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={decision === 'accepted' ? 'Undo accept' : 'Accept change'}>
            <ActionIcon
              variant={decision === 'accepted' ? 'filled' : 'light'}
              color="green"
              onClick={handleAccept}
              aria-label="Accept change"
            >
              <IconCheck size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={decision === 'rejected' ? 'Undo reject' : 'Reject change'}>
            <ActionIcon
              variant={decision === 'rejected' ? 'filled' : 'light'}
              color="red"
              onClick={handleReject}
              aria-label="Reject change"
            >
              <IconX size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      {renderContent()}
    </Paper>
  )
}

export default DiffBullet
