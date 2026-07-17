import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Popover,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { SignInButton } from '@clerk/clerk-react';
import { IconCheck, IconFileText, IconLogin2, IconPencil, IconTrash } from '@tabler/icons-react';
import ClerkAuthButton from './ClerkAuthButton';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import type { SavedResume } from '../lib/types';

type SavedResumeListProps = {
  resumeText: string;
  savedResumes: SavedResume[];
  isLoadingSavedResumes: boolean;
  isSignedIn: boolean;
  savedResumeLimit: number;
  atSavedLimit: boolean;
  onSelectSaved: (resume: SavedResume) => void;
  onRenameSaved: (resumeId: string, name: string) => void;
  onDeleteSaved: (resumeId: string) => void;
  onUpgradeClick: () => void;
};

const SavedResumeList = ({
  resumeText,
  savedResumes,
  isLoadingSavedResumes,
  isSignedIn,
  savedResumeLimit,
  atSavedLimit,
  onSelectSaved,
  onRenameSaved,
  onDeleteSaved,
  onUpgradeClick,
}: SavedResumeListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleStartRename = (resume: SavedResume) => {
    trackEvent(AnalyticsEvents.RenameSavedResume);
    setConfirmDeleteId(null);
    setEditingId(resume.id);
    setEditingName(resume.name);
  };

  const handleCancelRename = () => {
    trackEvent(AnalyticsEvents.CancelRenameResume);
    setEditingId(null);
    setEditingName('');
  };

  const handleConfirmRename = () => {
    if (!editingId) return;
    const trimmedName = editingName.trim();
    if (trimmedName.length > 0) {
      trackEvent(AnalyticsEvents.ConfirmRenameResume);
      onRenameSaved(editingId, trimmedName);
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleRenameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') handleConfirmRename();
    if (event.key === 'Escape') handleCancelRename();
  };

  const handleOpenDeleteConfirm = (resumeId: string) => {
    setEditingId(null);
    setEditingName('');
    setConfirmDeleteId(resumeId);
  };

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
  };

  const handleConfirmDelete = (resumeId: string) => {
    trackEvent(AnalyticsEvents.DeleteSavedResume);
    onDeleteSaved(resumeId);
    setConfirmDeleteId(null);
  };

  if (!isSignedIn) {
    return (
      <Paper withBorder p="lg" radius="md" h="100%">
        <Stack align="center" justify="center" gap="xs" h="100%">
          <IconFileText size={28} color="var(--mantine-primary-color-filled)" />
          <Text size="sm" fw={500} ta="center">
            Sign in to save resumes to your account
          </Text>
          <Text size="xs" c="dimmed" ta="center">
            Resumes are saved automatically after each tailor run.
          </Text>
          <SignInButton mode="modal">
            <ClerkAuthButton
              size="compact-xs"
              variant="light"
              leftSection={<IconLogin2 size={14} />}
              onClick={() => trackEvent(AnalyticsEvents.SignIn)}
            >
              Sign in
            </ClerkAuthButton>
          </SignInButton>
        </Stack>
      </Paper>
    );
  }

  if (isLoadingSavedResumes) {
    return (
      <Paper withBorder p="lg" radius="md" h="100%">
        <Stack align="center" justify="center" gap={4} h="100%">
          <Loader size="sm" />
        </Stack>
      </Paper>
    );
  }

  if (savedResumes.length === 0) {
    return (
      <Paper withBorder p="lg" radius="md" h="100%">
        <Stack align="center" justify="center" gap={4} h="100%">
          <IconFileText size={28} color="var(--mantine-primary-color-filled)" />
          <Text size="sm" fw={500} ta="center">
            No saved resumes yet
          </Text>
          <Text size="xs" c="dimmed" ta="center">
            Your resumes are saved here automatically after you tailor.
          </Text>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack gap="xs" h="100%" style={{ minHeight: 0 }}>
      <ScrollArea type="auto" offsetScrollbars style={{ flex: 1, minHeight: 0 }}>
        <Stack gap="xs">
          {savedResumes.map((resume) => {
            const isSelected = resume.resumeText === resumeText;
            const isEditing = editingId === resume.id;
            return (
              <Paper
                key={resume.id}
                withBorder
                p="sm"
                radius="md"
                className="saved-resume-card"
                style={{
                  cursor: 'pointer',
                  borderColor: isSelected ? 'var(--mantine-primary-color-filled)' : undefined,
                }}
                onClick={() => {
                  if (!isEditing) {
                    trackEvent(AnalyticsEvents.SelectSavedResume);
                    onSelectSaved(resume);
                  }
                }}
              >
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <TextInput
                        size="xs"
                        aria-label="Rename saved resume"
                        name="resume-name"
                        autoComplete="off"
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
                              event.stopPropagation();
                              handleConfirmRename();
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
                        event.stopPropagation();
                        handleStartRename(resume);
                      }}
                      aria-label="Rename saved resume"
                    >
                      <IconPencil size={16} />
                    </ActionIcon>
                    <Popover
                      opened={confirmDeleteId === resume.id}
                      onChange={(opened) => {
                        if (!opened) handleCancelDelete();
                      }}
                      position="bottom-end"
                      withArrow
                      withinPortal
                    >
                      <Popover.Target>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (confirmDeleteId === resume.id) {
                              handleCancelDelete();
                              return;
                            }
                            handleOpenDeleteConfirm(resume.id);
                          }}
                          aria-label="Delete saved resume"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Popover.Target>
                      <Popover.Dropdown onClick={(event) => event.stopPropagation()}>
                        <Stack gap="xs">
                          <Text size="sm">Delete this saved resume?</Text>
                          <Group gap="xs" justify="flex-end">
                            <Button size="xs" variant="default" onClick={handleCancelDelete}>
                              Cancel
                            </Button>
                            <Button
                              size="xs"
                              color="red.7"
                              onClick={() => handleConfirmDelete(resume.id)}
                            >
                              Delete
                            </Button>
                          </Group>
                        </Stack>
                      </Popover.Dropdown>
                    </Popover>
                  </Group>
                </Group>
              </Paper>
            );
          })}
        </Stack>
      </ScrollArea>
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
              trackEvent(AnalyticsEvents.UpgradeToSaveMore);
              onUpgradeClick();
            }}
          >
            Upgrade to save more
          </Button>
        </Stack>
      )}
    </Stack>
  );
};

export default SavedResumeList;
