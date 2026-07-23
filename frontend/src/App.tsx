import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Container, Grid, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useAuth } from '@clerk/clerk-react';
import { useSubscription } from '@clerk/clerk-react/experimental';
import { IconAlertCircle } from '@tabler/icons-react';
import AppHeader from './components/AppHeader';
import AppFooter from './components/AppFooter';
import LandingStrip from './components/LandingStrip';
import TailorForm from './components/TailorForm';
import TailorResultsSection from './components/TailorResultsSection';
import PaywallModal from './components/PaywallModal';
import { useCredits } from './hooks/useCredits';
import { useSavedResumes } from './hooks/useSavedResumes';
import { useTailorRun } from './hooks/useTailorRun';
import { useCoverLetter } from './hooks/useCoverLetter';
import { useResumeDocument } from './hooks/useResumeDocument';
import { usePaywall } from './hooks/usePaywall';
import { AnalyticsEvents, trackEvent } from './lib/analytics';
import { registerTokenGetter } from './lib/authToken';
import { isProPlan as checkIsProPlan } from './lib/constants';
import { subscribeToRateLimit } from './lib/rateLimitNotice';
import { formatDefaultResumeName } from './lib/formatDefaultResumeName';

const getNextMonthlyResetAt = (periodStart: Date, now: Date = new Date()): Date => {
  const anchorDay = periodStart.getUTCDate();
  let resetYear = now.getUTCFullYear();
  let resetMonth = now.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(resetYear, resetMonth + 1, 0)).getUTCDate();
  let resetAt = new Date(
    Date.UTC(
      resetYear,
      resetMonth,
      Math.min(anchorDay, daysInMonth),
      periodStart.getUTCHours(),
      periodStart.getUTCMinutes(),
      periodStart.getUTCSeconds(),
    ),
  );

  if (resetAt > now) return resetAt;

  resetMonth += 1;

  if (resetMonth === 12) {
    resetYear += 1;
    resetMonth = 0;
  }

  const daysInNextMonth = new Date(Date.UTC(resetYear, resetMonth + 1, 0)).getUTCDate();
  resetAt = new Date(
    Date.UTC(
      resetYear,
      resetMonth,
      Math.min(anchorDay, daysInNextMonth),
      periodStart.getUTCHours(),
      periodStart.getUTCMinutes(),
      periodStart.getUTCSeconds(),
    ),
  );

  return resetAt;
};

const App = () => {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { data: subscription } = useSubscription({
    for: 'user',
    enabled: isSignedIn === true,
  });
  const theme = useMantineTheme();
  const isStackedLayout = useMediaQuery(`(max-width: ${theme.breakpoints.md})`);
  const [jobDescription, setJobDescription] = useState('');
  const [lastSuccessfulInputs, setLastSuccessfulInputs] = useState<{
    resumeText: string;
    jobDescription: string;
  } | null>(null);
  const [showingExample, setShowingExample] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('resume');
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const tailorActionInFlightRef = useRef(false);
  const resultsSectionRef = useRef<HTMLDivElement>(null);

  const { credits, outOfCredits, creditsLabel, isLoadingCredits, creditsError, loadCredits } =
    useCredits();
  const {
    savedResumes,
    isLoadingSavedResumes,
    hasLoadedSavedResumes,
    loadSavedResumes,
    renameResume,
    deleteResume,
  } = useSavedResumes(isSignedIn === true);

  const {
    resumeText,
    pasteFieldText,
    attachedFile,
    originalDocx,
    handleResumeTextChange,
    handleFileAttach,
    handleClearResume,
    handleSelectSaved,
    persistOriginalDocx,
  } = useResumeDocument({ savedResumes, hasLoadedSavedResumes, isLoadingSavedResumes });

  const { paywallReason, openPaywall, closePaywall } = usePaywall({
    isSignedIn,
    hasCreditsRemaining: credits !== null && credits.remaining > 0,
  });

  const { status, result, runCount, errorMessage, clearError, runTailor } = useTailorRun({
    onSuccess: () => {
      trackEvent(AnalyticsEvents.TailorResume);
      void loadSavedResumes();
    },
    onCreditsExhausted: () => {
      openPaywall('credits');
    },
    onRequestFinished: () => void loadCredits(),
  });

  const {
    status: coverLetterStatus,
    result: coverLetterResult,
    errorMessage: coverLetterError,
    runCoverLetter,
    retryCoverLetter,
  } = useCoverLetter();

  const isGuest = isSignedIn === false;
  const isProPlan = checkIsProPlan(credits);
  const proSubscriptionItem = subscription?.subscriptionItems.find(
    (item) =>
      item.plan.slug === 'pro' && (item.status === 'active' || item.status === 'past_due'),
  );
  const proCreditsResetsAt =
    proSubscriptionItem === undefined
      ? null
      : proSubscriptionItem.planPeriod === 'month' && proSubscriptionItem.periodEnd !== null
        ? proSubscriptionItem.periodEnd.toISOString()
        : getNextMonthlyResetAt(proSubscriptionItem.periodStart).toISOString();
  const freeCreditTotal = credits !== null && credits.plan !== 'pro' ? credits.total : null;
  const freeTrialLabel = !isGuest
    ? null
    : credits === null
      ? 'Free to try · no account needed'
      : credits.remaining > 0
        ? `${credits.remaining} free ${credits.remaining === 1 ? 'credit' : 'credits'} · no account needed`
        : null;
  const planLoaded = credits !== null;
  const lowCredits =
    credits !== null &&
    credits.remaining > 0 &&
    (isProPlan ? credits.remaining <= 10 : credits.remaining <= 1);

  const inputsUnchangedSinceLastRun =
    lastSuccessfulInputs !== null &&
    lastSuccessfulInputs.resumeText === resumeText.trim() &&
    lastSuccessfulInputs.jobDescription === jobDescription.trim();

  const canTailor =
    credits !== null &&
    resumeText.trim().length > 0 &&
    jobDescription.trim().length > 0 &&
    !inputsUnchangedSinceLastRun;

  useEffect(() => {
    registerTokenGetter(() => getToken());
    return () => registerTokenGetter(null);
  }, [getToken]);

  useEffect(() => subscribeToRateLimit(setRateLimitMessage), []);

  useEffect(() => {
    if (!isLoaded) return;
    void loadCredits();
    void loadSavedResumes();
  }, [isLoaded, isSignedIn, loadCredits, loadSavedResumes]);

  useEffect(() => {
    if (status !== 'done' || !isStackedLayout) return;
    resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [status, isStackedLayout]);

  const handleShowExample = () => {
    setShowingExample(true);
  };

  const handleDismissExample = () => {
    setShowingExample(false);
    setActiveTab('resume');
  };

  const handleTailor = async () => {
    if (tailorActionInFlightRef.current) return;
    if (outOfCredits) {
      openPaywall('credits');
      return;
    }
    if (!canTailor) return;
    tailorActionInFlightRef.current = true;
    try {
      setShowingExample(false);
      setActiveTab('resume');
      if (isProPlan) {
        void runCoverLetter(resumeText, jobDescription);
      }
      const succeeded = await runTailor(
        resumeText,
        jobDescription,
        formatDefaultResumeName(
          new Date(),
          attachedFile?.name,
          savedResumes.map((resume) => resume.name),
        ),
      );
      if (succeeded) {
        setLastSuccessfulInputs({
          resumeText: resumeText.trim(),
          jobDescription: jobDescription.trim(),
        });
        persistOriginalDocx();
      }
    } finally {
      tailorActionInFlightRef.current = false;
    }
  };

  return (
    <Box mih="100vh" style={{ display: 'flex', flexDirection: 'column' }}>
      <AppHeader
        creditsLabel={creditsLabel}
        creditsRemaining={credits === null ? null : credits.remaining}
        creditsResetsAt={proCreditsResetsAt}
        outOfCredits={outOfCredits}
        lowCredits={lowCredits}
        isProPlan={isProPlan}
        planLoaded={planLoaded}
        isLoadingCredits={isLoadingCredits}
        creditsError={creditsError}
        onUpgradeClick={() => openPaywall('upgrade')}
        onRetryCredits={() => void loadCredits()}
      />

      <Container size="xl" py="xl" w="100%" style={{ flexGrow: 1 }}>
        {rateLimitMessage && (
          <Alert
            color="orange"
            icon={<IconAlertCircle size={18} />}
            title="Rate limited"
            withCloseButton
            onClose={() => {
              trackEvent(AnalyticsEvents.DismissRateLimit);
              setRateLimitMessage(null);
            }}
            mb="lg"
          >
            {rateLimitMessage}
          </Alert>
        )}
        <Grid gap="xl">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <TailorForm
              resumeText={resumeText}
              pasteFieldText={pasteFieldText}
              attachedFile={attachedFile}
              savedResumes={savedResumes}
              isLoadingSavedResumes={isLoadingSavedResumes}
              isSignedIn={isSignedIn === true}
              isProPlan={isProPlan}
              jobDescription={jobDescription}
              onJobDescriptionChange={setJobDescription}
              onResumeTextChange={handleResumeTextChange}
              onFileAttach={handleFileAttach}
              onClearResume={handleClearResume}
              onSelectSaved={handleSelectSaved}
              onRenameSaved={renameResume}
              onDeleteSaved={deleteResume}
              onUpgradeClick={() => openPaywall('savedLimit')}
              canTailor={canTailor}
              status={status}
              outOfCredits={outOfCredits}
              credits={credits}
              creditsError={creditsError}
              inputsUnchangedSinceLastRun={inputsUnchangedSinceLastRun}
              freeTrialLabel={freeTrialLabel}
              onTailor={handleTailor}
              onRetryCredits={() => void loadCredits()}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }} ref={resultsSectionRef}>
            <TailorResultsSection
              errorMessage={errorMessage}
              onClearError={clearError}
              showingExample={showingExample}
              onDismissExample={handleDismissExample}
              activeTab={activeTab}
              onActiveTabChange={setActiveTab}
              status={status}
              result={result}
              runCount={runCount}
              originalDocx={originalDocx}
              onShowExample={handleShowExample}
              planLoaded={planLoaded}
              isProPlan={isProPlan}
              isGuest={isGuest}
              lowCredits={lowCredits}
              credits={credits}
              coverLetterStatus={coverLetterStatus}
              coverLetterResult={coverLetterResult}
              coverLetterError={coverLetterError}
              onRetryCoverLetter={retryCoverLetter}
              onUpgradeClick={() => openPaywall('coverLetter')}
              onGapsUpgradeClick={() => openPaywall('gaps')}
              onNudgeClick={() => openPaywall(isGuest ? 'signUp' : 'upgrade')}
            />
          </Grid.Col>
        </Grid>
      </Container>

      <LandingStrip
        collapsible={status !== 'idle' || runCount > 0}
        freeCreditTotal={freeCreditTotal}
        onUpgradeClick={() => openPaywall('upgrade')}
      />

      <AppFooter />

      <PaywallModal
        opened={paywallReason !== null}
        reason={paywallReason ?? 'credits'}
        freeCreditTotal={freeCreditTotal}
        onClose={closePaywall}
        onSubscriptionChange={loadCredits}
      />
    </Box>
  );
};

export default App;
