import { Alert, Badge, Button, Center, Group, Loader, Stack, Tabs, Text } from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowBackUp,
  IconCheck,
  IconEye,
  IconFileText,
  IconLock,
  IconMail,
} from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { proAccent } from '../lib/proAccent';
import ResultsPanel from './ResultsPanel';
import CoverLetterPanel from './CoverLetterPanel';
import type { OriginalDocx } from '../hooks/useResumeDocument';
import { SAMPLE_COVER_LETTER_RESULT, SAMPLE_TAILOR_RESULT } from '../lib/mockTailor';
import type {
  CoverLetterResult,
  CoverLetterStatus,
  CreditStatus,
  TailorResult,
  TailorStatus,
} from '../lib/types';

type TailorResultsSectionProps = {
  errorMessage: string | null;
  onClearError: () => void;
  showingExample: boolean;
  onDismissExample: () => void;
  activeTab: string | null;
  onActiveTabChange: (tab: string | null) => void;
  status: TailorStatus;
  result: TailorResult | null;
  runCount: number;
  originalDocx: OriginalDocx | null;
  onShowExample: () => void;
  planLoaded: boolean;
  isProPlan: boolean;
  isGuest: boolean;
  lowCredits: boolean;
  credits: CreditStatus | null;
  coverLetterStatus: CoverLetterStatus;
  coverLetterResult: CoverLetterResult | null;
  coverLetterError: string | null;
  onRetryCoverLetter: () => void;
  onUpgradeClick: () => void;
  onGapsUpgradeClick: () => void;
  onNudgeClick: () => void;
};

const TailorResultsSection = ({
  errorMessage,
  onClearError,
  showingExample,
  onDismissExample,
  activeTab,
  onActiveTabChange,
  status,
  result,
  runCount,
  originalDocx,
  onShowExample,
  planLoaded,
  isProPlan,
  isGuest,
  lowCredits,
  credits,
  coverLetterStatus,
  coverLetterResult,
  coverLetterError,
  onRetryCoverLetter,
  onUpgradeClick,
  onGapsUpgradeClick,
  onNudgeClick,
}: TailorResultsSectionProps) => {
  const resumeTabIndicator = showingExample ? null : status === 'loading' ? (
    <Loader size={12} />
  ) : status === 'done' ? (
    <IconCheck size={14} color="var(--mantine-color-green-filled)" />
  ) : null;

  const coverLetterTabIndicator = !planLoaded ? null : !isProPlan ? (
    <Badge
      size="xs"
      variant="gradient"
      gradient={{ ...proAccent.gradient, deg: 45 }}
      h={16}
    >
      Pro
    </Badge>
  ) : showingExample ? null : coverLetterStatus === 'loading' ? (
    <Loader size={12} />
  ) : coverLetterStatus === 'done' ? (
    <IconCheck size={14} color="var(--mantine-color-green-filled)" />
  ) : coverLetterStatus === 'error' ? (
    <Badge size="xs" variant="light" color="red" h={16}>
      Failed
    </Badge>
  ) : null;

  return (
    <Stack gap="md">
      {errorMessage && (
        <Alert
          color="red"
          icon={<IconAlertCircle size={18} />}
          title="Tailoring failed"
          withCloseButton
          onClose={() => {
            trackEvent(AnalyticsEvents.DismissTailorError);
            onClearError();
          }}
        >
          {errorMessage}
        </Alert>
      )}
      {showingExample && (
        <Group
          justify="space-between"
          align="center"
          wrap="nowrap"
          gap="sm"
          p="sm"
          style={{
            borderRadius: 8,
            backgroundColor: 'var(--mantine-color-cyan-light)',
          }}
        >
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <IconEye size={16} color="var(--mantine-color-cyan-4)" style={{ flexShrink: 0 }} />
            <Text size="sm">
              This is an example. Explore the resume changes and cover letter, then run your own
              tailor.
            </Text>
          </Group>
          <Button
            size="xs"
            variant="subtle"
            color="cyan"
            leftSection={<IconArrowBackUp size={14} />}
            style={{ flexShrink: 0 }}
            onClick={() => {
              trackEvent(AnalyticsEvents.DismissExample);
              onDismissExample();
            }}
          >
            Back
          </Button>
        </Group>
      )}
      <Tabs
        value={activeTab}
        onChange={(tab) => {
          if (tab === 'resume') {
            trackEvent(AnalyticsEvents.ResultsTabResume);
          } else if (tab === 'coverLetter') {
            trackEvent(AnalyticsEvents.ResultsTabCoverLetter);
          }
          onActiveTabChange(tab);
        }}
      >
        <Tabs.List>
          <Tabs.Tab
            value="resume"
            leftSection={<IconFileText size={16} />}
            rightSection={resumeTabIndicator && <Center h={16}>{resumeTabIndicator}</Center>}
          >
            Resume changes
          </Tabs.Tab>
          <Tabs.Tab
            value="coverLetter"
            leftSection={planLoaded && !isProPlan ? <IconLock size={16} /> : <IconMail size={16} />}
            rightSection={
              coverLetterTabIndicator && <Center h={16}>{coverLetterTabIndicator}</Center>
            }
          >
            Cover letter
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="resume" pt="md">
          <ResultsPanel
            key={showingExample ? 'example' : runCount}
            status={showingExample ? 'done' : status}
            result={showingExample ? SAMPLE_TAILOR_RESULT : result}
            isExample={showingExample}
            isProPlan={isProPlan}
            isGuest={isGuest}
            lowCredits={lowCredits}
            credits={credits}
            originalDocx={showingExample ? null : originalDocx}
            onShowExample={status === 'idle' ? onShowExample : undefined}
            onUpgradeClick={onGapsUpgradeClick}
            onNudgeClick={onNudgeClick}
          />
        </Tabs.Panel>
        <Tabs.Panel value="coverLetter" pt="md">
          <CoverLetterPanel
            isProPlan={isProPlan}
            status={coverLetterStatus}
            result={coverLetterResult}
            errorMessage={coverLetterError}
            isExample={showingExample}
            exampleResult={SAMPLE_COVER_LETTER_RESULT}
            onRetry={onRetryCoverLetter}
            onUpgradeClick={onUpgradeClick}
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
};

export default TailorResultsSection;
