import { useEffect, useRef, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import { useAuth, useUser } from '@clerk/clerk-react'
import {
  IconAlertCircle,
  IconCopy,
  IconCopyCheck,
  IconDownload,
  IconInfoCircle,
  IconLock,
  IconMail,
  IconRefresh,
} from '@tabler/icons-react'
import type { CoverLetterResult, CoverLetterStatus } from '../lib/types'
import { buildCoverLetterDocx, downloadDocx } from '../lib/exportDocx'
import { SAMPLE_COVER_LETTER_RESULT } from '../lib/mockTailor'

const NAME_PLACEHOLDER = '[Your Name]'

type CoverLetterPanelProps = {
  isProPlan: boolean
  status: CoverLetterStatus
  result: CoverLetterResult | null
  errorMessage: string | null
  isExample?: boolean
  exampleResult?: CoverLetterResult
  onRetry: () => void
  onUpgradeClick: () => void
}

const applyCandidateName = (letter: string, candidateName: string): string => {
  const signatureName = candidateName.trim() || NAME_PLACEHOLDER
  return `${letter.trimEnd()}\n${signatureName}`
}

const LockedTeaser = ({
  isProPlan,
  onUpgradeClick,
}: {
  isProPlan: boolean
  onUpgradeClick: () => void
}) => (
  <Card withBorder shadow="xs" padding="lg" style={{ position: 'relative', overflow: 'hidden' }}>
    <Stack gap="md" style={{ filter: 'blur(5px)', userSelect: 'none' }} aria-hidden>
      <Group gap="sm">
        <IconMail size={20} color="var(--mantine-primary-color-filled)" />
        <Title order={4}>Cover letter</Title>
        <Badge variant="light">
          {SAMPLE_COVER_LETTER_RESULT.jobTitle} at {SAMPLE_COVER_LETTER_RESULT.companyName}
        </Badge>
      </Group>
      <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
        {SAMPLE_COVER_LETTER_RESULT.letter}
      </Text>
    </Stack>
    <Center
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: 'color-mix(in srgb, var(--mantine-color-body) 55%, transparent)',
      }}
    >
      <Stack align="center" gap="xs" p="md">
        <IconLock size={32} color="var(--mantine-primary-color-filled)" />
        <Group gap={6}>
          <Title order={5}>Cover letters are a Pro feature</Title>
          <Badge variant="gradient" gradient={{ from: 'indigo', to: 'cyan' }}>
            Pro
          </Badge>
        </Group>
        <Text size="sm" c="dimmed" ta="center" maw={340}>
          Every tailor run also writes a matching cover letter, ready to copy or download as a
          polished .docx.
        </Text>
        {!isProPlan && (
          <Button mt={4} onClick={onUpgradeClick}>
            Upgrade to Pro
          </Button>
        )}
      </Stack>
    </Center>
  </Card>
)

const ExampleCoverLetter = ({
  exampleResult,
  isProPlan,
  onUpgradeClick,
}: {
  exampleResult: CoverLetterResult
  isProPlan: boolean
  onUpgradeClick: () => void
}) => (
  <Card withBorder shadow="xs" padding="lg">
    <Stack gap="md">
      <Group gap="sm">
        <IconMail size={20} color="var(--mantine-primary-color-filled)" />
        <Title order={4}>Cover letter</Title>
        <Badge color="cyan" variant="light">
          Example
        </Badge>
        <Badge variant="light">
          {exampleResult.jobTitle} at {exampleResult.companyName}
        </Badge>
      </Group>
      <Box
        p="md"
        style={{
          borderRadius: 8,
          border: '1px solid var(--mantine-color-default-border)',
          backgroundColor: 'var(--mantine-color-default-hover)',
        }}
      >
        <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
          {exampleResult.letter}
        </Text>
      </Box>
      {!isProPlan && (
        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="sm" c="dimmed">
            On the Pro plan, every tailor run also writes a cover letter like this one.
          </Text>
          <Button size="xs" onClick={onUpgradeClick}>
            Upgrade to Pro
          </Button>
        </Group>
      )}
    </Stack>
  </Card>
)

const WritingLoader = () => (
  <Card withBorder shadow="xs" padding="lg">
    <Stack gap="md">
      <Group gap="sm">
        <IconMail size={20} color="var(--mantine-primary-color-filled)" />
        <Title order={4}>Cover letter</Title>
        <Text size="sm" c="dimmed" aria-live="polite">
          Writing your cover letter…
        </Text>
      </Group>
      <Stack gap={8}>
        <Skeleton height={10} radius="xl" width="30%" />
        <Skeleton height={10} radius="xl" width="95%" />
        <Skeleton height={10} radius="xl" width="90%" />
        <Skeleton height={10} radius="xl" width="93%" />
        <Skeleton height={10} radius="xl" width="60%" />
      </Stack>
    </Stack>
  </Card>
)

const CoverLetterPanel = ({
  isProPlan,
  status,
  result,
  errorMessage,
  isExample = false,
  exampleResult,
  onRetry,
  onUpgradeClick,
}: CoverLetterPanelProps) => {
  const { user } = useUser()
  const { has } = useAuth()
  const onProPlan = isProPlan || (has?.({ plan: 'pro' }) ?? false)
  const [candidateName, setCandidateName] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const hasPrefilledName = useRef(false)
  const clipboard = useClipboard({ timeout: 1500 })

  const clerkFullName = user?.fullName ?? ''

  useEffect(() => {
    if (hasPrefilledName.current || clerkFullName.length === 0) return
    hasPrefilledName.current = true
    setCandidateName((current) => (current.length === 0 ? clerkFullName : current))
  }, [clerkFullName])

  if (isExample && exampleResult) {
    return (
      <ExampleCoverLetter
        exampleResult={exampleResult}
        isProPlan={onProPlan}
        onUpgradeClick={onUpgradeClick}
      />
    )
  }

  if (!onProPlan) {
    return <LockedTeaser isProPlan={onProPlan} onUpgradeClick={onUpgradeClick} />
  }

  if (status === 'idle') {
    return (
      <Card withBorder shadow="xs" padding="lg">
        <Stack align="center" gap="xs" py="md">
          <IconMail size={32} color="var(--mantine-primary-color-filled)" />
          <Title order={5}>No cover letter yet</Title>
          <Text size="sm" c="dimmed" ta="center" maw={340}>
            Your next tailor run will also write a matching cover letter, and it will show up
            here.
          </Text>
        </Stack>
      </Card>
    )
  }

  if (status === 'loading') return <WritingLoader />

  if (status === 'error') {
    return (
      <Card withBorder shadow="xs" padding="lg">
        <Stack gap="md">
          <Group gap="sm">
            <IconMail size={20} color="var(--mantine-primary-color-filled)" />
            <Title order={4}>Cover letter</Title>
          </Group>
          <Alert color="red" icon={<IconAlertCircle size={18} />} title="Cover letter failed">
            {errorMessage ?? 'Something went wrong while writing your cover letter.'}
          </Alert>
          <Group>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={onRetry}
            >
              Try again
            </Button>
          </Group>
        </Stack>
      </Card>
    )
  }

  if (!result) return null

  const displayLetter = applyCandidateName(result.letter, candidateName)

  const handleCopy = () => {
    clipboard.copy(displayLetter)
  }

  const handleDownloadDocx = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const blob = await buildCoverLetterDocx(
        displayLetter,
        candidateName,
        result.jobTitle,
        result.companyName,
      )
      downloadDocx(blob, 'cover-letter.docx')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Card withBorder shadow="xs" padding="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="sm">
            <IconMail size={20} color="var(--mantine-primary-color-filled)" />
            <Title order={4}>Cover letter</Title>
          </Group>
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={
                clipboard.copied ? <IconCopyCheck size={16} /> : <IconCopy size={16} />
              }
              onClick={handleCopy}
            >
              {clipboard.copied ? 'Copied' : 'Copy cover letter'}
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconDownload size={16} />}
              loading={isExporting}
              onClick={handleDownloadDocx}
            >
              Download .docx
            </Button>
          </Group>
        </Group>
        <Group gap="sm" align="center" wrap="wrap">
          <Group gap={4} align="center" wrap="nowrap">
            <Text size="sm" fw={500} style={{ whiteSpace: 'nowrap' }}>
              Your name
            </Text>
            <Tooltip label="Used for the signature.">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="xs"
                aria-label="Used for the signature"
              >
                <IconInfoCircle size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <TextInput
            placeholder="e.g. Jordan Applicant"
            value={candidateName}
            onChange={(event) => setCandidateName(event.currentTarget.value)}
            maw={280}
          />
        </Group>
        <Box
          p="md"
          style={{
            borderRadius: 8,
            border: '1px solid var(--mantine-color-default-border)',
            backgroundColor: 'var(--mantine-color-default-hover)',
          }}
        >
          <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {displayLetter}
          </Text>
        </Box>
      </Stack>
    </Card>
  )
}

export default CoverLetterPanel
