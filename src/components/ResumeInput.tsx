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
import { SAMPLE_RESUME } from '../lib/mockTailor'

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

const TEXT_EXTENSIONS = ['txt', 'md']
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

  const handleDrop = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    const attached = { name: file.name, size: file.size }
    if (TEXT_EXTENSIONS.includes(extension)) {
      const text = await file.text()
      onFileAttach(attached, text)
      return
    }
    onFileAttach(attached, SAMPLE_RESUME)
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
          <Dropzone
            onDrop={handleDrop}
            accept={ACCEPTED_MIME_TYPES}
            maxFiles={1}
            multiple={false}
          >
            <Stack align="center" gap={6} py="md" style={{ pointerEvents: 'none' }}>
              <IconFileUpload size={32} color="var(--mantine-color-indigo-5)" />
              <Text size="sm" fw={500}>
                Drop your resume here or click to browse
              </Text>
              <Text size="xs" c="dimmed">
                .txt, .md, .pdf, or .docx
              </Text>
            </Stack>
          </Dropzone>
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
