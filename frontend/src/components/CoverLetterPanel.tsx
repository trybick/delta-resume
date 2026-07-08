import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Menu,
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
  IconChevronDown,
  IconCopy,
  IconCopyCheck,
  IconDownload,
  IconFileDescription,
  IconFileTypePdf,
  IconInfoCircle,
  IconLock,
  IconMail,
  IconRefresh
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import {
  AnalyticsEvents,
  createDebouncedTracker,
  trackEvent,
} from '../lib/analytics'
import type { CoverLetterResult, CoverLetterStatus } from '../lib/types'
import { buildCoverLetterDocx, downloadDocx } from '../lib/exportDocx'
import { convertDocxToPdf, downloadPdf } from '../lib/exportPdf'
import { formatCoverLetterText, formatCoverLetterSignature, prependCoverLetterDate } from '../lib/formatCoverLetter'
import { SAMPLE_COVER_LETTER_RESULT } from '../lib/mockTailor'

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
      </Group>
      <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
        {prependCoverLetterDate(SAMPLE_COVER_LETTER_RESULT.letter)}
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
          <Button
            mt={4}
            onClick={() => {
              trackEvent(AnalyticsEvents.CoverLetterUpgradeTeaser)
              onUpgradeClick()
            }}
          >
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
          {prependCoverLetterDate(exampleResult.letter)}
        </Text>
      </Box>
      {!isProPlan && (
        <Group justify="space-between" align="center" wrap="wrap">
          <Text size="sm" c="dimmed">
            On the Pro plan, every tailor run also writes a cover letter like this one.
          </Text>
          <Button
            size="xs"
            onClick={() => {
              trackEvent(AnalyticsEvents.CoverLetterUpgradeExample)
              onUpgradeClick()
            }}
          >
            Upgrade to Pro
          </Button>
        </Group>
      )}
    </Stack>
  </Card>
)

const writingStageMessages: string[] = [
  'Reading the job description…',
  'Picking out your strongest matching experience…',
  'Drafting an opening that hooks the reader…',
  'Writing the body paragraphs…',
  'Wrapping up with a confident closing…',
]

const writingMessageIntervalMs = 2600

const SkeletonParagraph = ({ widths }: { widths: string[] }) => (
  <Stack gap={8}>
    {widths.map((width, index) => (
      <Skeleton key={index} height={10} radius="xl" width={width} />
    ))}
  </Stack>
)

const WritingLoader = () => {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % writingStageMessages.length)
    }, writingMessageIntervalMs)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <Card withBorder shadow="xs" padding="xl" style={{ position: 'relative', overflow: 'hidden' }}>
      <Box className="tailoring-loader-topbar" />
      <Stack gap="lg" mt="xs">
        <Group gap="sm" align="center">
          <Box className="tailoring-loader-sparkle" style={{ display: 'flex' }}>
            <IconMail size={24} color="var(--mantine-primary-color-filled)" />
          </Box>
          <Text
            key={messageIndex}
            size="sm"
            c="dimmed"
            className="tailoring-loader-message"
            aria-live="polite"
          >
            {writingStageMessages[messageIndex]}
          </Text>
        </Group>
        <Stack gap="lg">
          <Skeleton height={10} radius="xl" width="28%" />
          <SkeletonParagraph widths={['96%', '91%', '94%', '55%']} />
          <SkeletonParagraph widths={['93%', '97%', '88%', '95%', '42%']} />
          <SkeletonParagraph widths={['90%', '68%']} />
          <Stack gap={8}>
            <Skeleton height={10} radius="xl" width="18%" />
            <Skeleton height={10} radius="xl" width="24%" />
          </Stack>
        </Stack>
      </Stack>
    </Card>
  )
}

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
  const trackEditCandidateName = useMemo(
    () => createDebouncedTracker(AnalyticsEvents.EditCandidateName),
    [],
  )

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
              onClick={() => {
                trackEvent(AnalyticsEvents.CoverLetterRetry)
                onRetry()
              }}
            >
              Try again
            </Button>
          </Group>
        </Stack>
      </Card>
    )
  }

  if (!result) return null

  const displayLetter = formatCoverLetterText(result.letter, candidateName)

  const handleCopy = () => {
    trackEvent(AnalyticsEvents.CoverLetterCopy)
    try {
      clipboard.copy(displayLetter)
      trackEvent(AnalyticsEvents.CopySuccess, { source: 'cover_letter' })
    } catch {
      trackEvent(AnalyticsEvents.CopyFailure, { source: 'cover_letter' })
    }
  }

  const buildCoverLetterBlob = (): Promise<Blob> =>
    buildCoverLetterDocx(
      formatCoverLetterSignature(result.letter, candidateName),
      candidateName,
      result.jobTitle,
      result.companyName,
    )

  const handleExport = async (format: 'docx' | 'pdf') => {
    if (isExporting) return
    trackEvent(AnalyticsEvents.CoverLetterExport, { format })
    setIsExporting(true)
    try {
      const docxBlob = await buildCoverLetterBlob()
      if (format === 'docx') {
        downloadDocx(docxBlob, 'cover-letter.docx')
        trackEvent(AnalyticsEvents.ExportSuccess, {
          source: 'cover_letter',
          format,
        })
        return
      }
      try {
        const pdfBlob = await convertDocxToPdf(docxBlob)
        downloadPdf(pdfBlob, 'cover-letter.pdf')
        trackEvent(AnalyticsEvents.ExportSuccess, {
          source: 'cover_letter',
          format,
        })
      } catch {
        trackEvent(AnalyticsEvents.ExportFailure, {
          source: 'cover_letter',
          format,
        })
        notifications.show({
          color: 'red',
          title: 'PDF export failed',
          message: 'Could not generate a PDF. Try downloading the .docx instead.',
        })
      }
    } catch {
      trackEvent(AnalyticsEvents.ExportFailure, {
        source: 'cover_letter',
        format,
      })
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
            <Menu
              position="bottom-end"
              withinPortal
              onOpen={() => trackEvent(AnalyticsEvents.CoverLetterExportMenuOpen)}
            >
              <Menu.Target>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<IconDownload size={16} />}
                  rightSection={<IconChevronDown size={14} />}
                  loading={isExporting}
                >
                  Export
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={
                    clipboard.copied ? <IconCopyCheck size={16} /> : <IconCopy size={16} />
                  }
                  onClick={handleCopy}
                >
                  {clipboard.copied ? 'Copied' : 'Copy to clipboard'}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconFileDescription size={16} />}
                  onClick={() => handleExport('docx')}
                >
                  Word (.docx)
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFileTypePdf size={16} />}
                  onClick={() => handleExport('pdf')}
                >
                  PDF (.pdf)
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
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
                onClick={() => trackEvent(AnalyticsEvents.SignatureInfoClick)}
              >
                <IconInfoCircle size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
          <TextInput
            placeholder="e.g. Jordan Applicant"
            value={candidateName}
            onChange={(event) => {
              trackEditCandidateName()
              setCandidateName(event.currentTarget.value)
            }}
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
