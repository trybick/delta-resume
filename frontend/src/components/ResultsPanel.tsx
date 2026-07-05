import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Center,
  Group,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import { useClipboard } from '@mantine/hooks'
import {
  IconArrowBackUp,
  IconArrowsVertical,
  IconCircleCheck,
  IconCopy,
  IconCopyCheck,
  IconDownload,
  IconEye,
  IconSparkles,
  IconTargetArrow,
} from '@tabler/icons-react'
import type { BulletChange, ChangeDecision, TailorResult, TailorStatus } from '../lib/types'
import { buildTemplateDocx, downloadDocx, patchOriginalDocx } from '../lib/exportDocx'
import { extractKeywords, scoreResume } from '../lib/matchScore'
import DiffBullet from './DiffBullet'
import TailoringLoader from './TailoringLoader'

type OriginalDocx = {
  file: File
  parsedText: string
}

type ExampleMatchScore = {
  before: number
  after: number
}

type ResultsPanelProps = {
  status: TailorStatus
  result: TailorResult | null
  isExample?: boolean
  jobDescription?: string
  exampleMatchScore?: ExampleMatchScore
  originalDocx?: OriginalDocx | null
  onShowExample?: () => void
  onDismissExample?: () => void
}

const buildDecisionMap = (result: TailorResult | null): Record<string, ChangeDecision> => {
  if (!result) return {}
  return Object.fromEntries(result.changes.map((change) => [change.id, 'pending']))
}

const CONTEXT_LINES_PER_SIDE = 2
const MIN_HIDDEN_LINES = 3

type ContextSplit = {
  leading: string[]
  hidden: string[]
  trailing: string[]
}

const isBlankLine = (line: string) => line.trim() === ''

type TrimmedSegment = {
  lines: string[]
  offset: number
}

const trimBlankEdges = (lines: string[]): TrimmedSegment => {
  let start = 0
  while (start < lines.length && isBlankLine(lines[start])) {
    start += 1
  }
  let end = lines.length
  while (end > start && isBlankLine(lines[end - 1])) {
    end -= 1
  }
  return { lines: lines.slice(start, end), offset: start }
}

const splitContextLines = (lines: string[], collapsed: boolean): ContextSplit => {
  const expandedSplit: ContextSplit = { leading: lines, hidden: [], trailing: [] }
  if (!collapsed || lines.length < CONTEXT_LINES_PER_SIDE * 2 + MIN_HIDDEN_LINES) {
    return expandedSplit
  }
  let leadingEnd = CONTEXT_LINES_PER_SIDE
  while (leadingEnd > 0 && isBlankLine(lines[leadingEnd - 1])) {
    leadingEnd -= 1
  }
  let trailingStart = lines.length - CONTEXT_LINES_PER_SIDE
  while (trailingStart < lines.length && isBlankLine(lines[trailingStart])) {
    trailingStart += 1
  }
  const hidden = lines.slice(leadingEnd, trailingStart)
  if (hidden.length < MIN_HIDDEN_LINES) return expandedSplit
  return {
    leading: lines.slice(0, leadingEnd),
    hidden,
    trailing: lines.slice(trailingStart),
  }
}

type ResumeSegment =
  | { kind: 'change'; change: BulletChange }
  | { kind: 'context'; startIndex: number; lines: string[] }

const buildSegments = (
  lines: string[],
  changesByLine: Map<number, BulletChange>,
): ResumeSegment[] => {
  const segments: ResumeSegment[] = []
  lines.forEach((line, lineIndex) => {
    const change = changesByLine.get(lineIndex)
    if (change) {
      segments.push({ kind: 'change', change })
      return
    }
    const previousSegment = segments[segments.length - 1]
    if (previousSegment && previousSegment.kind === 'context') {
      previousSegment.lines.push(line)
      return
    }
    segments.push({ kind: 'context', startIndex: lineIndex, lines: [line] })
  })
  return segments
}

const ContextLine = ({ line }: { line: string }) => (
  <Text
    c="dimmed"
    style={{
      fontFamily: 'ui-monospace, monospace',
      fontSize: 13,
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
    }}
  >
    {line.trim() === '' ? '\u00A0' : line}
  </Text>
)

type CollapsedContextProps = {
  hiddenCount: number
  onExpand: () => void
}

const CollapsedContext = ({ hiddenCount, onExpand }: CollapsedContextProps) => (
  <UnstyledButton
    onClick={onExpand}
    my={6}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      padding: '4px 10px',
      borderRadius: 6,
      border: '1px dashed var(--mantine-color-default-border)',
      backgroundColor: 'var(--mantine-color-default-hover)',
    }}
  >
    <IconArrowsVertical size={14} color="var(--mantine-primary-color-filled)" />
    <Text size="xs" c="dimmed">
      Show {hiddenCount} hidden line{hiddenCount === 1 ? '' : 's'} from original
    </Text>
  </UnstyledButton>
)

const ResultsPanel = ({
  status,
  result,
  isExample = false,
  jobDescription = '',
  exampleMatchScore,
  originalDocx = null,
  onShowExample,
  onDismissExample,
}: ResultsPanelProps) => {
  const [decisions, setDecisions] = useState<Record<string, ChangeDecision>>(() =>
    buildDecisionMap(result),
  )
  const [expandedSegments, setExpandedSegments] = useState<Set<number>>(new Set())
  const [isExporting, setIsExporting] = useState(false)
  const clipboard = useClipboard({ timeout: 1500 })

  useEffect(() => {
    setExpandedSegments(new Set())
  }, [result])

  const handleExpandSegment = (startIndex: number) => {
    setExpandedSegments((current) => new Set(current).add(startIndex))
  }

  const changesByLine = useMemo(() => {
    if (!result) return new Map<number, BulletChange>()
    return new Map(result.changes.map((change) => [change.lineIndex, change]))
  }, [result])

  const handleDecisionChange = (id: string, decision: ChangeDecision) => {
    setDecisions((current) => ({ ...current, [id]: decision }))
  }

  const buildMergedText = (): string => {
    if (!result) return ''
    const lines = result.resumeText.split('\n').map((line, lineIndex) => {
      const change = changesByLine.get(lineIndex)
      if (!change) return line
      return decisions[change.id] === 'rejected' ? change.original : change.tailored
    })
    return lines.join('\n')
  }

  const handleCopy = () => {
    if (!result) return
    clipboard.copy(buildMergedText())
  }

  const handleDownloadDocx = async () => {
    if (!result || isExporting) return
    setIsExporting(true)
    try {
      const canPatchOriginal =
        originalDocx !== null && originalDocx.parsedText === result.resumeText
      let blob: Blob | null = null
      if (canPatchOriginal) {
        const replacements = result.changes
          .filter((change) => decisions[change.id] !== 'rejected')
          .map((change) => ({ original: change.original, tailored: change.tailored }))
        try {
          blob = await patchOriginalDocx(originalDocx.file, replacements)
        } catch {
          blob = null
        }
      }
      if (!blob) {
        blob = await buildTemplateDocx(buildMergedText())
      }
      downloadDocx(blob, 'tailored-resume.docx')
    } finally {
      setIsExporting(false)
    }
  }

  const matchKeywords = useMemo(() => extractKeywords(jobDescription), [jobDescription])
  const computedMatchScoreBefore = useMemo(
    () => (result ? scoreResume(result.resumeText, matchKeywords) : 0),
    [result, matchKeywords],
  )
  const computedMatchScoreAfter = useMemo(() => {
    if (!result) return 0
    const mergedLines = result.resumeText.split('\n').map((line, lineIndex) => {
      const change = changesByLine.get(lineIndex)
      if (!change) return line
      return decisions[change.id] === 'rejected' ? change.original : change.tailored
    })
    return scoreResume(mergedLines.join('\n'), matchKeywords)
  }, [result, changesByLine, decisions, matchKeywords])
  const matchScoreBefore = exampleMatchScore?.before ?? computedMatchScoreBefore
  const matchScoreAfter = exampleMatchScore?.after ?? computedMatchScoreAfter
  const showMatchScore =
    exampleMatchScore !== undefined ||
    (matchKeywords.length > 0 && jobDescription.trim().length > 0)

  if (status === 'idle') {
    return (
      <Card withBorder shadow="xs" padding="xl" h="100%">
        <Center h="100%" mih={360}>
          <Stack align="center" gap="xs">
            <IconSparkles size={40} color="var(--mantine-primary-color-filled)" />
            <Title order={4}>Your tailored resume will appear here</Title>
            <Text size="sm" c="dimmed" ta="center" maw={360}>
              Attach your base resume, paste a job description, and click
              &ldquo;Tailor Resume&rdquo; to see suggested bullet changes.
            </Text>
            {onShowExample && (
              <Button
                mt="xs"
                variant="light"
                leftSection={<IconEye size={16} />}
                onClick={onShowExample}
              >
                Preview an example
              </Button>
            )}
          </Stack>
        </Center>
      </Card>
    )
  }

  if (status === 'loading') {
    return <TailoringLoader />
  }

  if (!result) return null

  const decisionValues = result.changes.map((change) => decisions[change.id] ?? 'pending')
  const acceptedCount = decisionValues.filter((d) => d === 'accepted').length
  const rejectedCount = decisionValues.filter((d) => d === 'rejected').length
  const bulletChangeCount = result.changes.filter((change) => change.kind === 'bullet').length
  const skillChangeCount = result.changes.filter((change) => change.kind === 'skill').length
  const lines = result.resumeText.split('\n')
  const segments = buildSegments(lines, changesByLine)

  return (
    <Card withBorder shadow="xs" padding="lg">
      <Stack gap="md">
        {isExample && (
          <Group
            justify="space-between"
            align="center"
            wrap="wrap"
            p="sm"
            style={{
              borderRadius: 8,
              backgroundColor: 'var(--mantine-color-cyan-light)',
            }}
          >
            <Group gap="xs">
              <IconEye size={16} color="var(--mantine-color-cyan-4)" />
              <Text size="sm">
                This is an example. Try accepting or rejecting a change, then run your own tailor.
              </Text>
            </Group>
            {onDismissExample && (
              <Button
                size="xs"
                variant="subtle"
                color="cyan"
                leftSection={<IconArrowBackUp size={14} />}
                onClick={onDismissExample}
              >
                Back
              </Button>
            )}
          </Group>
        )}
        <Group justify="space-between" align="center" wrap="wrap">
          <Group gap="sm">
            <Title order={4}>
              {bulletChangeCount} bullet{bulletChangeCount === 1 ? '' : 's'}
              {skillChangeCount > 0
                ? `, ${skillChangeCount} skill${skillChangeCount === 1 ? '' : 's'}`
                : ''}{' '}
              updated
            </Title>
            {isExample && (
              <Badge color="cyan" variant="light">
                Example
              </Badge>
            )}
            <Badge color="green" variant="light">
              {acceptedCount} accepted
            </Badge>
            <Badge color="red" variant="light">
              {rejectedCount} rejected
            </Badge>
            {skillChangeCount === 0 && (
              <Tooltip label="Your skills section already matches this job description well, so no skill changes were suggested.">
                <Badge
                  color="teal"
                  variant="light"
                  leftSection={<IconCircleCheck size={12} />}
                >
                  Skills all set
                </Badge>
              </Tooltip>
            )}
            {showMatchScore && (
              <Tooltip label="How much of the job description's keywords your resume covers. The second number reflects the changes you currently have accepted or pending.">
                <Badge
                  color={matchScoreAfter > matchScoreBefore ? 'green' : 'gray'}
                  variant="light"
                  leftSection={<IconTargetArrow size={12} />}
                >
                  Match {matchScoreBefore}% {'\u2192'} {matchScoreAfter}%
                </Badge>
              </Tooltip>
            )}
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
              {clipboard.copied ? 'Copied' : 'Copy tailored resume'}
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

        <div>
          {segments.map((segment) => {
            if (segment.kind === 'change') {
              return (
                <DiffBullet
                  key={segment.change.id}
                  change={segment.change}
                  decision={decisions[segment.change.id] ?? 'pending'}
                  onDecisionChange={handleDecisionChange}
                />
              )
            }
            const trimmed = trimBlankEdges(segment.lines)
            if (trimmed.lines.length === 0) return null
            const keyBase = segment.startIndex + trimmed.offset
            const { leading, hidden, trailing } = splitContextLines(
              trimmed.lines,
              !expandedSegments.has(segment.startIndex),
            )
            return (
              <div key={segment.startIndex}>
                {leading.map((line, offset) => (
                  <ContextLine key={keyBase + offset} line={line} />
                ))}
                {hidden.length > 0 && (
                  <CollapsedContext
                    hiddenCount={hidden.length}
                    onExpand={() => handleExpandSegment(segment.startIndex)}
                  />
                )}
                {trailing.map((line, offset) => (
                  <ContextLine
                    key={keyBase + leading.length + hidden.length + offset}
                    line={line}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </Stack>
    </Card>
  )
}

export default ResultsPanel
