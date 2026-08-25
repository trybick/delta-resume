import { Alert, Badge, Button, Center, Group, Loader, Stack, Tabs } from '@mantine/core';
import { IconAlertCircle, IconCheck, IconEye, IconFileText, IconMail } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
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
  const isNarrowMobile = useMediaQuery('(max-width: 36em)');
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
        <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
          <Badge
            size="lg"
            variant="light"
            color="cyan"
            leftSection={<IconEye size={14} />}
            styles={{ label: { textTransform: 'none', fontWeight: 600 } }}
          >
            Example preview
          </Badge>
          <Button
            size="xs"
            variant="light"
            color="cyan"
            style={{ flexShrink: 0 }}
            onClick={() => {
              trackEvent(AnalyticsEvents.DismissExample);
              onDismissExample();
            }}
          >
            Exit preview
          </Button>
        </Group>
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
            leftSection={isNarrowMobile ? undefined : <IconFileText size={16} />}
            rightSection={resumeTabIndicator && <Center h={16}>{resumeTabIndicator}</Center>}
          >
            Resume changes
          </Tabs.Tab>
          <Tabs.Tab
            value="coverLetter"
            leftSection={isNarrowMobile ? undefined : <IconMail size={16} />}
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
