import { useState } from 'react';
import { Box, Card, Group, SegmentedControl, Stack, Title } from '@mantine/core';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import type { AttachedFile, SavedResume } from '../lib/types';
import ResumePastePanel from './ResumePastePanel';
import ResumeUploadPanel from './ResumeUploadPanel';
import SavedResumeList from './SavedResumeList';

type ResumeInputProps = {
  resumeText: string;
  pasteFieldText: string;
  attachedFile: AttachedFile | null;
  savedResumes: SavedResume[];
  isLoadingSavedResumes: boolean;
  isSignedIn: boolean;
  savedResumeLimit: number;
  isProPlan: boolean;
  onResumeTextChange: (text: string) => void;
  onFileAttach: (file: AttachedFile, text: string, sourceFile: File) => void;
  onClear: () => void;
  onSelectSaved: (resume: SavedResume) => void;
  onRenameSaved: (resumeId: string, name: string) => void;
  onDeleteSaved: (resumeId: string) => void;
  onUpgradeClick: () => void;
};

type InputMode = 'upload' | 'paste' | 'saved';

const TAB_PANEL_HEIGHT = '11rem';

const ResumeInput = ({
  resumeText,
  pasteFieldText,
  attachedFile,
  savedResumes,
  isLoadingSavedResumes,
  isSignedIn,
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
  const [mode, setMode] = useState<InputMode>('upload');
  const atSavedLimit = !isProPlan && savedResumes.length >= savedResumeLimit;

  return (
    <Card withBorder shadow="xs" padding="lg">
      <Stack gap="sm">
        <Group justify="space-between" align="center">
          <Title order={4}>1 · Base resume</Title>
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={(value) => {
              const nextMode = value as InputMode;
              trackEvent(AnalyticsEvents.ResumeModeSwitch, { mode: nextMode });
              setMode(nextMode);
            }}
            data={[
              { label: 'Upload file', value: 'upload' },
              { label: 'Paste text', value: 'paste' },
              {
                label: savedResumes.length > 0 ? `Saved (${savedResumes.length})` : 'Saved',
                value: 'saved',
              },
            ]}
          />
        </Group>

        <Box h={TAB_PANEL_HEIGHT} style={{ minHeight: TAB_PANEL_HEIGHT }}>
          {mode === 'upload' && (
            <ResumeUploadPanel
              attachedFile={attachedFile}
              onFileAttach={onFileAttach}
              onClear={onClear}
            />
          )}
          {mode === 'paste' && (
            <ResumePastePanel
              pasteFieldText={pasteFieldText}
              onResumeTextChange={onResumeTextChange}
            />
          )}
          {mode === 'saved' && (
            <SavedResumeList
              resumeText={resumeText}
              savedResumes={savedResumes}
              isLoadingSavedResumes={isLoadingSavedResumes}
              isSignedIn={isSignedIn}
              savedResumeLimit={savedResumeLimit}
              atSavedLimit={atSavedLimit}
              onSelectSaved={onSelectSaved}
              onRenameSaved={onRenameSaved}
              onDeleteSaved={onDeleteSaved}
              onUpgradeClick={onUpgradeClick}
            />
          )}
        </Box>
      </Stack>
    </Card>
  );
};

export default ResumeInput;
