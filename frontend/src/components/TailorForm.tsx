import { Anchor, Badge, Button, Loader, Stack, Text, Tooltip } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { appTheme } from '../lib/theme';
import ResumeInput from './ResumeInput';
import JobDescriptionInput from './JobDescriptionInput';
import { getSavedResumeLimit } from '../lib/constants';
import type { AttachedFile, CreditStatus, SavedResume, TailorStatus } from '../lib/types';

type TailorFormProps = {
  resumeText: string;
  pasteFieldText: string;
  attachedFile: AttachedFile | null;
  savedResumes: SavedResume[];
  isLoadingSavedResumes: boolean;
  isSignedIn: boolean;
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
  freeTrialLabel: string | null;
  onTailor: () => void;
  onRetryCredits: () => void;
};

const TailorForm = ({
  resumeText,
  pasteFieldText,
  attachedFile,
  savedResumes,
  isLoadingSavedResumes,
  isSignedIn,
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
  freeTrialLabel,
  onTailor,
  onRetryCredits,
}: TailorFormProps) => {
  const isTailoring = status === 'loading';
  const hasResume = resumeText.trim().length > 0;
  const hasJobDescription = jobDescription.trim().length > 0;

  const disabledReason =
    isTailoring || outOfCredits
      ? null
      : !hasResume && !hasJobDescription
        ? 'Add your resume and paste a job description to get started'
        : !hasResume
          ? 'Add your base resume first'
          : !hasJobDescription
            ? 'Paste the job description first'
            : null;

  const isButtonInert = !outOfCredits && (!canTailor || isTailoring);

  const handleTailorAction = () => {
    trackEvent(outOfCredits ? AnalyticsEvents.GetMoreCredits : AnalyticsEvents.TailorResumeClick);
    onTailor();
  };

  return (
    <Stack gap="lg">
      <ResumeInput
        resumeText={resumeText}
        pasteFieldText={pasteFieldText}
        attachedFile={attachedFile}
        savedResumes={savedResumes}
        isLoadingSavedResumes={isLoadingSavedResumes}
        isSignedIn={isSignedIn}
        savedResumeLimit={getSavedResumeLimit(isProPlan)}
        isProPlan={isProPlan}
        onResumeTextChange={onResumeTextChange}
        onFileAttach={onFileAttach}
        onClear={onClearResume}
        onSelectSaved={onSelectSaved}
        onRenameSaved={onRenameSaved}
        onDeleteSaved={onDeleteSaved}
        onUpgradeClick={onUpgradeClick}
      />
      <JobDescriptionInput
        value={jobDescription}
        onChange={onJobDescriptionChange}
      />
      <Stack gap="xs">
        {freeTrialLabel && !outOfCredits && (
          <Badge size="md" variant="light" color="teal" style={{ alignSelf: 'center' }}>
            {freeTrialLabel}
          </Badge>
        )}
        <Tooltip label={disabledReason} disabled={disabledReason === null} withArrow>
          <Button
            size="lg"
            fullWidth
            variant="gradient"
            gradient={{ ...appTheme.gradient, deg: 45 }}
            leftSection={
              isTailoring ? <Loader size={18} color="currentColor" /> : <IconSparkles size={18} />
            }
            disabled={isButtonInert}
            onClick={(event) => {
              if (isButtonInert) {
                event.preventDefault();
                return;
              }
              handleTailorAction();
            }}
          >
            {isTailoring ? 'Tailoring…' : outOfCredits ? 'Get more credits' : 'Tailor Resume'}
          </Button>
        </Tooltip>
        {creditsError && credits === null && (
          <Text size="xs" c="dimmed" ta="center">
            Couldn&apos;t load your credits.{' '}
            <Anchor
              component="button"
              type="button"
              size="xs"
              onClick={() => {
                trackEvent(AnalyticsEvents.RetryCredits, { source: 'tailor_form' });
                onRetryCredits();
              }}
            >
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
              : credits !== null
                ? `You have used your ${credits.total} free ${credits.total === 1 ? 'credit' : 'credits'}. Sign up to upgrade and continue.`
                : 'You have used your free credits. Sign up to upgrade and continue.'}
          </Text>
        )}
        {credits !== null &&
          credits.isAuthenticated &&
          !outOfCredits &&
          !inputsUnchangedSinceLastRun && (
            <Text size="xs" c="dimmed" ta="center">
              {`Uses 1 credit · ${credits.remaining} remaining`}
            </Text>
          )}
      </Stack>
    </Stack>
  );
};

export default TailorForm;
