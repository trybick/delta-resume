import { useState } from 'react'
import {
  ActionIcon,
  Card,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import {
  IconFileText,
  IconFileUpload,
  IconX,
} from '@tabler/icons-react'
import { parseResumeFile, ResumeParseError } from '../lib/parseResumeFile'

type AttachedFile = {
  name: string
  size: number
}

type ResumeInputProps = {
  resumeText: string
  attachedFile: AttachedFile | null
  onResumeTextChange: (text: string) => void
  onFileAttach: (file: AttachedFile, text: string) => void
  onClear: () => void
}

type InputMode = 'upload' | 'paste'

const ACCEPTED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ResumeInput = ({
  resumeText,
  attachedFile,
  onResumeTextChange,
  onFileAttach,
  onClear,
}: ResumeInputProps) => {
  const [mode, setMode] = useState<InputMode>('upload')
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const handleDrop = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    const attached = { name: file.name, size: file.size }
    setIsParsing(true)
    setParseError(null)
    try {
      const text = await parseResumeFile(file)
      onFileAttach(attached, text)
    } catch (error) {
      setParseError(
        error instanceof ResumeParseError
          ? error.message
          : 'Could not read this file. Try another format or paste your resume text.',
      )
    } finally {
      setIsParsing(false)
    }
  }

  return (
    <Card withBorder shadow="xs" padding="lg">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Title order={4}>Base resume</Title>
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={(value) => setMode(value as InputMode)}
            data={[
              { label: 'Upload file', value: 'upload' },
              { label: 'Paste text', value: 'paste' },
            ]}
          />
        </Group>

        {mode === 'upload' && attachedFile && (
          <Paper withBorder p="sm" radius="md" bg="indigo.0">
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <IconFileText size={22} color="var(--mantine-color-indigo-6)" />
                <div>
                  <Text size="sm" fw={600} lineClamp={1}>
                    {attachedFile.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatFileSize(attachedFile.size)}
                  </Text>
                </div>
              </Group>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={onClear}
                aria-label="Remove attached resume"
              >
                <IconX size={16} />
              </ActionIcon>
            </Group>
          </Paper>
        )}

        {mode === 'upload' && !attachedFile && (
          <Stack gap="xs">
            <Dropzone
              onDrop={handleDrop}
              accept={ACCEPTED_MIME_TYPES}
              maxFiles={1}
              multiple={false}
              loading={isParsing}
            >
              <Stack align="center" gap={6} py="md" style={{ pointerEvents: 'none' }}>
                <IconFileUpload size={32} color="var(--mantine-color-indigo-5)" />
                <Text size="sm" fw={500}>
                  {isParsing ? 'Reading your resume…' : 'Drop your resume here or click to browse'}
                </Text>
                <Text size="xs" c="dimmed">
                  .txt, .md, .pdf, or .docx
                </Text>
              </Stack>
            </Dropzone>
            {parseError && (
              <Text size="sm" c="red">
                {parseError}
              </Text>
            )}
          </Stack>
        )}

        {mode === 'paste' && (
          <Textarea
            value={resumeText}
            onChange={(event) => onResumeTextChange(event.currentTarget.value)}
            placeholder="Paste your resume text here…"
            autosize
            minRows={10}
            maxRows={18}
            styles={{ input: { fontFamily: 'ui-monospace, monospace', fontSize: 13 } }}
          />
        )}
      </Stack>
    </Card>
  )
}

export default ResumeInput
