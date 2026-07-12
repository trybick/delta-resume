import {
  ActionIcon,
  Box,
  Group,
  Paper,
  Text,
  Tooltip,
} from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import { IconArrowBackUp, IconCopy, IconCopyCheck, IconRefresh } from '@tabler/icons-react'
import { diffWords } from 'diff'
import { AnalyticsEvents, trackEvent } from '../lib/analytics'
import type { BulletChange, ChangeDecision } from '../lib/types'

type DiffBulletProps = {
  change: BulletChange
  decision: ChangeDecision
  onDecisionChange: (id: string, decision: ChangeDecision) => void
}

const borderColorByDecision: Record<ChangeDecision, string> = {
  accepted: 'var(--mantine-color-green-6)',
  reverted: 'var(--mantine-color-gray-6)',
}

const DiffBullet = ({ change, decision, onDecisionChange }: DiffBulletProps) => {
  const clipboard = useClipboard({ timeout: 1500 })

  const handleCopyBullet = () => {
    trackEvent(AnalyticsEvents.CopyBullet, { kind: change.kind })
    try {
      clipboard.copy(decision === 'reverted' ? change.original : change.tailored)
      trackEvent(AnalyticsEvents.CopySuccess, { source: 'bullet' })
    } catch {
      trackEvent(AnalyticsEvents.CopyFailure, { source: 'bullet' })
    }
  }

  const handleToggleRevert = () => {
    const nextDecision = decision === 'reverted' ? 'accepted' : 'reverted'
    trackEvent(
      nextDecision === 'reverted'
        ? AnalyticsEvents.RevertChange
        : AnalyticsEvents.ReapplyChange,
      { kind: change.kind },
    )
    onDecisionChange(change.id, nextDecision)
  }

  const renderContent = () => {
    const parts = diffWords(change.original, change.tailored)
    return (
      <Text component="div" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 'var(--mantine-font-size-xs)', lineHeight: 1.5 }}>
        {parts.map((part, index) => {
          if (part.added) {
            return (
              <span
                key={index}
                style={{
                  backgroundColor: 'rgba(64, 192, 87, 0.16)',
                  color: 'var(--mantine-color-green-3)',
                  borderRadius: 3,
                  padding: '0 2px',
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
                  padding: '0 2px',
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
        opacity: decision === 'reverted' ? 0.6 : 1,
      }}
    >
      <Group align="center" wrap="nowrap" gap="sm">
        <Box style={{ flex: 1, minWidth: 0 }}>
          {renderContent()}
        </Box>
        <Group gap={4} wrap="nowrap">
          <Tooltip label={decision === 'reverted' ? 'Re-apply change' : 'Revert to original'}>
            <ActionIcon
              variant={decision === 'reverted' ? 'filled' : 'light'}
              color={decision === 'reverted' ? 'green' : 'red'}
              onClick={handleToggleRevert}
              aria-label={decision === 'reverted' ? 'Re-apply change' : 'Revert to original'}
            >
              {decision === 'reverted' ? <IconRefresh size={16} /> : <IconArrowBackUp size={16} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={clipboard.copied ? 'Copied' : 'Copy entire bullet'}>
            <ActionIcon
              variant="light"
              color="gray"
              onClick={handleCopyBullet}
              aria-label="Copy entire bullet"
            >
              {clipboard.copied ? <IconCopyCheck size={16} /> : <IconCopy size={16} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Paper>
  )
}

export default DiffBullet
