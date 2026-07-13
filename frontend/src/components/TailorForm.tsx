import { Anchor, Button, Stack, Text } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import ResumeInput from './ResumeInput';
import JobDescriptionInput from './JobDescriptionInput';
import type { AttachedFile } from '../hooks/useResumeDocument';
import type { CreditStatus, SavedResume, TailorStatus } from '../lib/types';

type TailorFormProps = {
  resumeText: string;
  attachedFile: AttachedFile | null;
  savedResumes: SavedResume[];
  isLoadingSavedResumes: boolean;
  isProPlan: boolean;
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  onResumeTextChange: (text: string) => void;
  onFileAttach: (file: AttachedFile, text: string, sourceFile: File) => void;
  onClearResume: () => void;
  onSelectSaved: (resume: SavedResume) => void;
  onRenameSaved: (id: string, name: string) => void;
  onDeleteSaved: (id: string) => void;
  onUpgradeClick: () => void;
  canTailor: boolean;
  status: TailorStatus;
  outOfCredits: boolean;
  credits: CreditStatus | null;
  creditsError: boolean;
  inputsUnchangedSinceLastRun: boolean;
  onTailor: () => void;
  onRetryCredits: () => void;
};

const TailorForm = ({
  resumeText,
  attachedFile,
  savedResumes,
  isLoadingSavedResumes,
  isProPlan,
  jobDescription,
  onJobDescriptionChange,
  onResumeTextChange,
  onFileAttach,
  onClearResume,
  onSelectSaved,
  onRenameSaved,
  onDeleteSaved,
  onUpgradeClick,
  canTailor,
  status,
  outOfCredits,
  credits,
  creditsError,
  inputsUnchangedSinceLastRun,
  onTailor,
  onRetryCredits
}: TailorFormProps) => (
  <Stack gap="lg">
    <ResumeInput
      resumeText={resumeText}
      attachedFile={attachedFile}
      savedResumes={savedResumes}
      isLoadingSavedResumes={isLoadingSavedResumes}
      savedResumeLimit={isProPlan ? 10 : 1}
      isProPlan={isProPlan}
      onResumeTextChange={onResumeTextChange}
      onFileAttach={onFileAttach}
      onClear={onClearResume}
      onSelectSaved={onSelectSaved}
      onRenameSaved={onRenameSaved}
      onDeleteSaved={onDeleteSaved}
      onUpgradeClick={onUpgradeClick}
    />
    <JobDescriptionInput value={jobDescription} onChange={onJobDescriptionChange} />
    <Stack gap="xs">
      <Button
        size="md"
        leftSection={<IconSparkles size={18} />}
        disabled={!canTailor}
        loading={status === 'loading'}
        onClick={() => {
          trackEvent(
            outOfCredits ? AnalyticsEvents.GetMoreCredits : AnalyticsEvents.TailorResumeClick
          );
          onTailor();
        }}
      >
        {outOfCredits ? 'Get more credits' : 'Tailor Resume'}
      </Button>
      {creditsError && credits === null && (
        <Text size="xs" c="dimmed" ta="center">
          Couldn&apos;t load your credits.{' '}
          <Anchor component="button" type="button" size="xs" onClick={onRetryCredits}>
            Retry
          </Anchor>
        </Text>
      )}
      {inputsUnchangedSinceLastRun && !outOfCredits && credits !== null && (
        <Text size="xs" c="dimmed" ta="center">
          Edit your resume or job description to tailor again.
        </Text>
      )}
      {outOfCredits && (
        <Text size="xs" c="dimmed" ta="center">
          {credits?.isAuthenticated
            ? 'You are out of credits. Subscribe to Pro to keep tailoring.'
            : 'You have used your 3 free credits. Sign up to continue.'}
        </Text>
      )}
    </Stack>
  </Stack>
);

export default TailorForm;
