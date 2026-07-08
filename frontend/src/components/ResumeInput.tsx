import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core'
import { Dropzone, type FileRejection } from '@mantine/dropzone'
import {
  IconCheck,
  IconFileText,
  IconFileUpload,
  IconPencil,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import {
  AnalyticsEvents,
  createDebouncedTracker,
  trackEvent,
} from '../lib/analytics'
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
  isLoadingSavedResumes: boolean
  savedResumeLimit: number
  isProPlan: boolean
  onResumeTextChange: (text: string) => void
  onFileAttach: (file: AttachedFile, text: string, sourceFile: File) => void
  onClear: () => void
  onSelectSaved: (resume: SavedResume) => void
  onRenameSaved: (resumeId: string, name: string) => void
  onDeleteSaved: (resumeId: string) => void
  onUpgradeClick: () => void
}

type InputMode = 'upload' | 'paste' | 'saved'

export const RESUME_TEXT_MAX_LENGTH = 15000

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

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
  savedResumes,
  isLoadingSavedResumes,
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
  const trackPasteResumeText = useMemo(
    () => createDebouncedTracker(AnalyticsEvents.PasteResumeText),
    [],
  )

  const atSavedLimit = !isProPlan && savedResumes.length >= savedResumeLimit

  const handleDrop = async (files: File[]) => {
    const file = files[0]
    if (!file) return
    trackEvent(AnalyticsEvents.DropzoneDrop, {
      file_type: file.type || 'unknown',
      file_size: file.size,
    })
    const attached = { name: file.name, size: file.size }
    setIsParsing(true)
    setParseError(null)
    try {
      const text = await parseResumeFile(file)
      trackEvent(AnalyticsEvents.FileParseSuccess, {
        file_type: file.type || 'unknown',
      })
      onFileAttach(attached, text, file)
    } catch (error) {
      trackEvent(AnalyticsEvents.FileParseFailure, {
        file_type: file.type || 'unknown',
      })
      setParseError(
        error instanceof ResumeParseError
          ? error.message
          : 'Could not read this file. Try another format or paste your resume text.',
      )
    } finally {
      setIsParsing(false)
    }
  }

  const handleDropReject = (rejections: FileRejection[]) => {
    const isTooLarge = rejections.some((rejection) =>
      rejection.errors.some((error) => error.code === 'file-too-large'),
    )
    trackEvent(AnalyticsEvents.DropzoneReject, {
      reason: isTooLarge ? 'too_large' : 'bad_type',
    })
    setParseError(
      isTooLarge
        ? 'That file is too large. The maximum size is 5 MB.'
        : 'That file type is not supported. Use .txt, .md, .pdf, or .docx.',
    )
  }

  const handleStartRename = (resume: SavedResume) => {
    trackEvent(AnalyticsEvents.RenameSavedResume)
    setEditingId(resume.id)
    setEditingName(resume.name)
  }

  const handleCancelRename = () => {
    trackEvent(AnalyticsEvents.CancelRenameResume)
    setEditingId(null)
    setEditingName('')
  }

  const handleConfirmRename = () => {
    if (!editingId) return
    const trimmedName = editingName.trim()
    if (trimmedName.length > 0) {
      trackEvent(AnalyticsEvents.ConfirmRenameResume)
      onRenameSaved(editingId, trimmedName)
    }
    setEditingId(null)
    setEditingName('')
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
            onChange={(value) => {
              const nextMode = value as InputMode
              trackEvent(AnalyticsEvents.ResumeModeSwitch, { mode: nextMode })
              setMode(nextMode)
            }}
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
                onClick={() => {
                  trackEvent(AnalyticsEvents.RemoveAttachedResume)
                  onClear()
                }}
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
              onReject={handleDropReject}
              onFileDialogOpen={() => trackEvent(AnalyticsEvents.DropzoneBrowse)}
              accept={ACCEPTED_MIME_TYPES}
              maxSize={MAX_FILE_SIZE_BYTES}
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
                  .txt, .md, .pdf, or .docx — up to 5 MB
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
          <Stack gap={4}>
            <Textarea
              value={resumeText}
              onChange={(event) => {
                trackPasteResumeText()
                onResumeTextChange(event.currentTarget.value.slice(0, RESUME_TEXT_MAX_LENGTH))
              }}
              placeholder="Paste your resume text here…"
              maxLength={RESUME_TEXT_MAX_LENGTH}
              autosize
              minRows={10}
              maxRows={10}
              styles={{ input: { fontFamily: 'ui-monospace, monospace', fontSize: 'var(--mantine-font-size-xs)' } }}
            />
            <Text
              size="xs"
              c={RESUME_TEXT_MAX_LENGTH - resumeText.length <= 0 ? 'red' : 'dimmed'}
              ta="right"
            >
              {(RESUME_TEXT_MAX_LENGTH - resumeText.length).toLocaleString()} characters left
            </Text>
          </Stack>
        )}

        {mode === 'saved' && isLoadingSavedResumes && (
          <Paper withBorder p="lg" radius="md">
            <Stack align="center" gap={4}>
              <Loader size="sm" />
            </Stack>
          </Paper>
        )}

        {mode === 'saved' && !isLoadingSavedResumes && savedResumes.length === 0 && (
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

        {mode === 'saved' && !isLoadingSavedResumes && savedResumes.length > 0 && (
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
                    if (!isEditing) {
                      trackEvent(AnalyticsEvents.SelectSavedResume)
                      onSelectSaved(resume)
                    }
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
                          trackEvent(AnalyticsEvents.DeleteSavedResume)
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
                  onClick={() => {
                    trackEvent(AnalyticsEvents.UpgradeToSaveMore)
                    onUpgradeClick()
                  }}
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
