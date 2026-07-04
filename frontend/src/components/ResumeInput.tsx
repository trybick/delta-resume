import { useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import {
  IconCheck,
  IconFileText,
  IconFileUpload,
  IconPencil,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { parseResumeFile, ResumeParseError } from '../lib/parseResumeFile'
import type { SavedResume } from '../lib/types'

type AttachedFile = {
  name: string
  size: number
}

type ResumeInputProps = {
  resumeText: string
  attachedFile: AttachedFile | null
  savedResumes: SavedResume[]
  savedResumeLimit: number
  isProPlan: boolean
  onResumeTextChange: (text: string) => void
  onFileAttach: (file: AttachedFile, text: string) => void
  onClear: () => void
  onSelectSaved: (resume: SavedResume) => void
  onRenameSaved: (resumeId: string, name: string) => void
  onDeleteSaved: (resumeId: string) => void
  onUpgradeClick: () => void
}

type InputMode = 'upload' | 'paste' | 'saved'

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

const formatLastUsed = (isoDate: string): string => {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const ResumeInput = ({
  resumeText,
  attachedFile,
  savedResumes,
  savedResumeLimit,
  isProPlan,
  onResumeTextChange,
  onFileAttach,
  onClear,
  onSelectSaved,
  onRenameSaved,
  onDeleteSaved,
  onUpgradeClick,
}: ResumeInputProps) => {
  const [mode, setMode] = useState<InputMode>('upload')
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const atSavedLimit = !isProPlan && savedResumes.length >= savedResumeLimit

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

  const handleStartRename = (resume: SavedResume) => {
    setEditingId(resume.id)
    setEditingName(resume.name)
  }

  const handleCancelRename = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleConfirmRename = () => {
    if (!editingId) return
    const trimmedName = editingName.trim()
    if (trimmedName.length > 0) {
      onRenameSaved(editingId, trimmedName)
    }
    handleCancelRename()
  }

  const handleRenameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleConfirmRename()
    if (event.key === 'Escape') handleCancelRename()
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
              { label: 'Saved', value: 'saved' },
            ]}
          />
        </Group>

        {mode === 'upload' && attachedFile && (
          <Paper withBorder p="sm" radius="md" bg="dark.5">
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <IconFileText size={22} color="var(--mantine-primary-color-filled)" />
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
                <IconFileUpload size={32} color="var(--mantine-primary-color-filled)" />
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

        {mode === 'saved' && savedResumes.length === 0 && (
          <Paper withBorder p="lg" radius="md">
            <Stack align="center" gap={4}>
              <IconFileText size={28} color="var(--mantine-primary-color-filled)" />
              <Text size="sm" fw={500} ta="center">
                No saved resumes yet
              </Text>
              <Text size="xs" c="dimmed" ta="center">
                Your resumes are saved here automatically after you tailor.
              </Text>
            </Stack>
          </Paper>
        )}

        {mode === 'saved' && savedResumes.length > 0 && (
          <Stack gap="xs">
            {savedResumes.map((resume) => {
              const isSelected = resume.resumeText === resumeText
              const isEditing = editingId === resume.id
              return (
                <Paper
                  key={resume.id}
                  withBorder
                  p="sm"
                  radius="md"
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected
                      ? 'var(--mantine-primary-color-filled)'
                      : undefined,
                  }}
                  onClick={() => {
                    if (!isEditing) onSelectSaved(resume)
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <TextInput
                          size="xs"
                          value={editingName}
                          onChange={(event) => setEditingName(event.currentTarget.value)}
                          onKeyDown={handleRenameKeyDown}
                          onClick={(event) => event.stopPropagation()}
                          autoFocus
                          rightSection={
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              onClick={(event) => {
                                event.stopPropagation()
                                handleConfirmRename()
                              }}
                              aria-label="Save name"
                            >
                              <IconCheck size={14} />
                            </ActionIcon>
                          }
                        />
                      ) : (
                        <Group gap={6} wrap="nowrap">
                          <Text size="sm" fw={600} lineClamp={1}>
                            {resume.name}
                          </Text>
                          {isSelected && (
                            <Badge size="xs" variant="light">
                              Selected
                            </Badge>
                          )}
                        </Group>
                      )}
                      <Text size="xs" c="dimmed">
                        Last used {formatLastUsed(resume.lastUsedAt)}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {resume.resumeText}
                      </Text>
                    </Stack>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleStartRename(resume)
                        }}
                        aria-label="Rename saved resume"
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={(event) => {
                          event.stopPropagation()
                          onDeleteSaved(resume.id)
                        }}
                        aria-label="Delete saved resume"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Paper>
              )
            })}
            {atSavedLimit && (
              <Stack gap="xs" align="center">
                <Text size="xs" c="dimmed" ta="center">
                  You can save {savedResumeLimit === 1 ? 'one resume' : `${savedResumeLimit} resumes`}.
                </Text>
                <Button
                  size="compact-xs"
                  variant="light"
                  w="fit-content"
                  onClick={onUpgradeClick}
                >
                  Upgrade to save more
                </Button>
              </Stack>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  )
}

export default ResumeInput
