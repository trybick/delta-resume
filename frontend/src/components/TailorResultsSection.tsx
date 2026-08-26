import { Alert, Badge, Box, Button, Center, Loader, Stack, Tabs } from '@mantine/core';
import { IconAlertCircle, IconCheck, IconEyeOff, IconFileText, IconMail } from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { appTheme } from '../lib/theme';
import ResultsPanel from './ResultsPanel';
import CoverLetterPanel from './CoverLetterPanel';
import type { OriginalDocx } from '../lib/types';
import { SAMPLE_COVER_LETTER_RESULT, SAMPLE_TAILOR_RESULT } from '../lib/mockTailor';
import type {
  CoverLetterResult,
  CoverLetterStatus,
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
  isProPlan: boolean;
  isGuest: boolean;
  coverLetterStatus: CoverLetterStatus;
  coverLetterResult: CoverLetterResult | null;
  coverLetterError: string | null;
  onRetryCoverLetter: () => void;
  onUpgradeClick: () => void;
  onGapsUpgradeClick: () => void;
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
  isProPlan,
  isGuest,
  coverLetterStatus,
  coverLetterResult,
  coverLetterError,
  onRetryCoverLetter,
  onUpgradeClick,
  onGapsUpgradeClick,
}: TailorResultsSectionProps) => {
  const resumeTabIndicator = showingExample ? null : status === 'loading' ? (
    <Loader size={12} />
  ) : status === 'done' ? (
    <IconCheck size={14} color="var(--mantine-color-green-filled)" />
  ) : null;

  const coverLetterTabIndicator = showingExample ? null : coverLetterStatus === 'loading' ? (
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
        <Button
          size="md"
          variant="gradient"
          gradient={{ ...appTheme.gradient, deg: 45 }}
          leftSection={<IconEyeOff size={18} />}
          w={{ base: '100%', sm: 'auto' }}
          mx="auto"
          styles={{ label: { whiteSpace: 'nowrap' } }}
          onClick={() => {
            trackEvent(AnalyticsEvents.DismissExample);
            onDismissExample();
          }}
        >
          <Box component="span" hiddenFrom="sm">
            Tap to exit preview mode
          </Box>
          <Box component="span" visibleFrom="sm">
            Exit preview mode
          </Box>
        </Button>
      )}
      <Tabs
        className="results-tabs"
        value={activeTab}
        keepMountedMode="display-none"
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
            leftSection={<IconMail size={16} />}
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
            exportMenuKey={activeTab}
            isProPlan={isProPlan}
            isGuest={isGuest}
            originalDocx={showingExample ? null : originalDocx}
            companyName={showingExample ? undefined : coverLetterResult?.companyName}
            onShowExample={status === 'idle' ? onShowExample : undefined}
            onUpgradeClick={onGapsUpgradeClick}
          />
        </Tabs.Panel>
        <Tabs.Panel value="coverLetter" pt="md">
          <CoverLetterPanel
            isProPlan={isProPlan}
            status={coverLetterStatus}
            result={coverLetterResult}
            errorMessage={coverLetterError}
            isExample={showingExample}
            exportMenuKey={activeTab}
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
