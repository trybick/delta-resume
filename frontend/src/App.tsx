import { useEffect, useState } from 'react';
import { Alert, Box, Container, Grid } from '@mantine/core';
import { useAuth } from '@clerk/clerk-react';
import { IconAlertCircle } from '@tabler/icons-react';
import AppHeader from './components/AppHeader';
import AppFooter from './components/AppFooter';
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
import { subscribeToRateLimit } from './lib/rateLimitNotice';
import { formatDefaultResumeName } from './lib/formatDefaultResumeName';

const App = () => {
  const { isSignedIn, getToken } = useAuth();
  const [jobDescription, setJobDescription] = useState('');
  const [lastSuccessfulInputs, setLastSuccessfulInputs] = useState<{
    resumeText: string;
    jobDescription: string;
  } | null>(null);
  const [showingExample, setShowingExample] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('resume');
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);

  const { credits, outOfCredits, creditsLabel, isLoadingCredits, creditsError, loadCredits } =
    useCredits();
  const {
    savedResumes,
    isLoadingSavedResumes,
    hasLoadedSavedResumes,
    loadSavedResumes,
    renameResume,
    deleteResume,
  } = useSavedResumes();

  const {
    resumeText,
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
      void loadCredits();
      void loadSavedResumes();
    },
    onCreditsExhausted: () => {
      openPaywall('credits');
      void loadCredits();
    },
  });

  const {
    status: coverLetterStatus,
    result: coverLetterResult,
    errorMessage: coverLetterError,
    runCoverLetter,
    retryCoverLetter,
  } = useCoverLetter();

  const isProPlan = credits?.plan === 'pro';
  const planLoaded = credits !== null;

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
    void loadCredits();
    void loadSavedResumes();
  }, [isSignedIn, loadCredits, loadSavedResumes]);

  const handleShowExample = () => {
    setShowingExample(true);
  };

  const handleDismissExample = () => {
    setShowingExample(false);
    setActiveTab('resume');
  };

  const handleTailor = async () => {
    if (!canTailor) return;
    if (outOfCredits) {
      openPaywall('credits');
      return;
    }
    setShowingExample(false);
    setActiveTab('resume');
    if (isProPlan) {
      void runCoverLetter(resumeText, jobDescription);
    }
    const succeeded = await runTailor(
      resumeText,
      jobDescription,
      formatDefaultResumeName(new Date()),
    );
    if (succeeded) {
      setLastSuccessfulInputs({
        resumeText: resumeText.trim(),
        jobDescription: jobDescription.trim(),
      });
      persistOriginalDocx();
    }
  };

  return (
    <Box mih="100vh" style={{ display: 'flex', flexDirection: 'column' }}>
      <AppHeader
        creditsLabel={creditsLabel}
        outOfCredits={outOfCredits}
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
            onClose={() => setRateLimitMessage(null)}
            mb="lg"
          >
            {rateLimitMessage}
          </Alert>
        )}
        <Grid gap="xl">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <TailorForm
              resumeText={resumeText}
              attachedFile={attachedFile}
              savedResumes={savedResumes}
              isLoadingSavedResumes={isLoadingSavedResumes}
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
              onTailor={handleTailor}
              onRetryCredits={() => void loadCredits()}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }}>
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
              coverLetterStatus={coverLetterStatus}
              coverLetterResult={coverLetterResult}
              coverLetterError={coverLetterError}
              onRetryCoverLetter={retryCoverLetter}
              onUpgradeClick={() => openPaywall('coverLetter')}
              onGapsUpgradeClick={() => openPaywall('gaps')}
            />
          </Grid.Col>
        </Grid>
      </Container>

      <AppFooter />

      <PaywallModal
        opened={paywallReason !== null}
        reason={paywallReason ?? 'credits'}
        onClose={closePaywall}
        onSubscriptionChange={loadCredits}
      />
    </Box>
  );
};

export default App;
