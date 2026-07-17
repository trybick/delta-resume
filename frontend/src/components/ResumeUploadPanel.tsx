import { useState } from 'react';
import {
  ActionIcon,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import { Dropzone, type FileRejection } from '@mantine/dropzone';
import { IconFileText, IconFileUpload, IconX } from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { parseResumeFile, ResumeParseError } from '../lib/parseResumeFile';
import type { AttachedFile } from '../lib/types';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ACCEPTED_MIME_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

type ResumeUploadPanelProps = {
  resumeText: string;
  attachedFile: AttachedFile | null;
  isSignedIn: boolean;
  onFileAttach: (file: AttachedFile, text: string, sourceFile: File) => void;
  onClear: () => void;
};

const ResumeUploadPanel = ({
  resumeText,
  attachedFile,
  isSignedIn,
  onFileAttach,
  onClear,
}: ResumeUploadPanelProps) => {
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleDrop = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    trackEvent(AnalyticsEvents.DropzoneDrop, {
      file_type: file.type || 'unknown',
      file_size: file.size,
    });
    const attached = { name: file.name, size: file.size };
    setIsParsing(true);
    setParseError(null);
    try {
      const text = await parseResumeFile(file);
      trackEvent(AnalyticsEvents.FileParseSuccess, {
        file_type: file.type || 'unknown',
      });
      onFileAttach(attached, text, file);
    } catch (error) {
      trackEvent(AnalyticsEvents.FileParseFailure, {
        file_type: file.type || 'unknown',
      });
      setParseError(
        error instanceof ResumeParseError
          ? error.message
          : 'Could not read this file. Try another format or paste your resume text.',
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleDropReject = (rejections: FileRejection[]) => {
    const isTooLarge = rejections.some((rejection) =>
      rejection.errors.some((error) => error.code === 'file-too-large'),
    );
    trackEvent(AnalyticsEvents.DropzoneReject, {
      reason: isTooLarge ? 'too_large' : 'bad_type',
    });
    setParseError(
      isTooLarge
        ? 'That file is too large. The maximum size is 5 MB.'
        : 'That file type is not supported. Use .docx, .pdf, .md, or .txt.',
    );
  };

  if (attachedFile) {
    return (
      <Stack gap="xs" h="100%" style={{ minHeight: 0 }}>
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
                trackEvent(AnalyticsEvents.RemoveAttachedResume);
                onClear();
              }}
              aria-label="Remove attached resume"
            >
              <IconX size={16} />
            </ActionIcon>
          </Group>
        </Paper>
        <Paper
          withBorder
          p="sm"
          radius="md"
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          <Text size="xs" c="dimmed" fw={600} mb={4}>
            Extracted text
          </Text>
          <ScrollArea type="auto" offsetScrollbars style={{ flex: 1, minHeight: 0 }}>
            <Text
              size="xs"
              c="dimmed"
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {resumeText}
            </Text>
          </ScrollArea>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack gap="xs" h="100%">
      <Dropzone
        onDrop={handleDrop}
        onReject={handleDropReject}
        onFileDialogOpen={() => trackEvent(AnalyticsEvents.DropzoneBrowse)}
        accept={ACCEPTED_MIME_TYPES}
        maxSize={MAX_FILE_SIZE_BYTES}
        maxFiles={1}
        multiple={false}
        loading={isParsing}
        style={{ flex: 1, display: 'flex' }}
        styles={{
          inner: {
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        }}
      >
        <Stack align="center" gap={6} style={{ pointerEvents: 'none' }}>
          <IconFileUpload size={32} color="var(--mantine-primary-color-filled)" />
          <Text size="sm" fw={500}>
            {isParsing ? 'Reading your resume…' : 'Drop your resume here or click to browse'}
          </Text>
          <Text size="xs" c="dimmed">
            .docx, .pdf, .md, or .txt — up to 5 MB
          </Text>
          <Text size="xs" c="teal.4" ta="center">
            .docx works best — we keep your original formatting on export
          </Text>
          {parseError && (
            <Text size="sm" c="red" ta="center">
              {parseError}
            </Text>
          )}
        </Stack>
      </Dropzone>
      <Text size="xs" c="dimmed" ta="center">
        {isSignedIn
          ? 'Saved to your account after each run — delete anytime.'
          : 'Your resume is never stored.'}
      </Text>
    </Stack>
  );
};

export default ResumeUploadPanel;
