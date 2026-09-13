import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Container, Grid, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useAuth } from '@clerk/clerk-react';
import { useSubscription } from '@clerk/clerk-react/experimental';
import { IconAlertCircle } from '@tabler/icons-react';
import AppHeader from './components/AppHeader';
import AppFooter from './components/AppFooter';
import ApplicationsList from './components/ApplicationsList';
import LandingStrip from './components/LandingStrip';
import LandingHero from './components/LandingHero';
import WhyNotChatGpt from './components/WhyNotChatGpt';
import TailorForm from './components/TailorForm';
import TailorResultsSection from './components/TailorResultsSection';
import PaywallModal from './components/PaywallModal';
import { useCredits } from './hooks/useCredits';
import { useSavedResumes } from './hooks/useSavedResumes';
import { useTailorRun } from './hooks/useTailorRun';
import { useTailorRuns } from './hooks/useTailorRuns';
import { useCoverLetter } from './hooks/useCoverLetter';
import { useResumeDocument } from './hooks/useResumeDocument';
import { usePaywall } from './hooks/usePaywall';
import { AnalyticsEvents, trackEvent } from './lib/analytics';
import { claimTailorRun, getTailorRun, patchTailorRunDecisions } from './lib/api';
import { registerTokenGetter } from './lib/authToken';
import { isProPlan as checkIsProPlan } from './lib/constants';
import { heroCopyForVariant, resolveHeroVariant } from './lib/heroVariants';
import { clearPendingRun, readPendingRun, writePendingRun } from './lib/pendingRunStash';
import { subscribeToRateLimit } from './lib/rateLimitNotice';
import { buildDecisionMap } from './lib/runDecisions';
import { formatDefaultResumeName } from './lib/formatDefaultResumeName';
import type { AddedBullet, ChangeDecision, PaywallReason } from './lib/types';

const HAS_USED_TOOL_STORAGE_KEY = 'delta-resume:has-used-tool';
const SIGNUP_BANNER_DISMISS_KEY = 'deltaResume.signupBannerDismissed';
const TOOL_PATH = '/app';
const APPLICATIONS_PATH = '/applications';

type AppView = 'landing' | 'tool' | 'applications';

const pathToView = (pathname: string): AppView => {
  if (pathname === APPLICATIONS_PATH) return 'applications';
  if (pathname === TOOL_PATH) return 'tool';
  return 'landing';
};

const readSignupBannerDismissed = (): boolean => {
  try {
    return sessionStorage.getItem(SIGNUP_BANNER_DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
};

const readHasUsedTool = (): boolean => {
  try {
    return localStorage.getItem(HAS_USED_TOOL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const markToolUsed = () => {
  try {
    localStorage.setItem(HAS_USED_TOOL_STORAGE_KEY, 'true');
  } catch {
    return;
  }
};

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
  const isStackedLayout = useMediaQuery(`(max-width: ${theme.breakpoints.md})`, false, {
    getInitialValueInEffect: false,
  });
  const [jobDescription, setJobDescription] = useState('');
  const [lastSuccessfulInputs, setLastSuccessfulInputs] = useState<{
    resumeText: string;
    jobDescription: string;
  } | null>(null);
  const [showingExample, setShowingExample] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('resume');
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);
  const [hasUsedTool, setHasUsedTool] = useState(readHasUsedTool);
  const [view, setView] = useState<AppView>(() => {
    const fromPath = pathToView(window.location.pathname);
    if (fromPath !== 'landing') return fromPath;
    return readHasUsedTool() ? 'tool' : 'landing';
  });
  const [heroVariant] = useState(() => resolveHeroVariant(window.location.search));
  const [decisions, setDecisions] = useState<Record<string, ChangeDecision>>({});
  const [addedBullets, setAddedBullets] = useState<AddedBullet[]>([]);
  const [signupBannerDismissed, setSignupBannerDismissed] = useState(readSignupBannerDismissed);
  const tailorActionInFlightRef = useRef(false);
  const resultsSectionRef = useRef<HTMLDivElement>(null);
  const restoredPendingRunRef = useRef(false);
  const claimedPendingRunRef = useRef(false);

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
  const { runs, hiddenOlderCount, isLoadingRuns, loadRuns, deleteRun } = useTailorRuns(
    isSignedIn === true,
  );

  const {
    resumeText,
    pasteFieldText,
    resumeDocument,
    resumeLayout,
    attachedFile,
    originalDocx,
    handleResumeTextChange,
    handleFileAttach,
    handleClearResume,
    handleSelectSaved,
    persistOriginalDocx,
    hydrateFromRun,
  } = useResumeDocument({ savedResumes, hasLoadedSavedResumes, isLoadingSavedResumes });

  const {
    paywallReason,
    openPaywall: openPaywallRaw,
    closePaywall,
  } = usePaywall({
    isSignedIn,
    hasCreditsRemaining: credits !== null && credits.remaining > 0,
  });

  const runCountRef = useRef(0);
  const {
    status,
    result,
    runCount,
    errorMessage,
    clearError,
    runTailor,
    hydrate: hydrateTailor,
  } = useTailorRun({
    onSuccess: () => {
      trackEvent(AnalyticsEvents.TailorResume);
      markToolUsed();
      setHasUsedTool(true);
      void loadSavedResumes();
      void loadRuns();
    },
    onCreditsExhausted: () => {
      if (isSignedIn === false) {
        trackEvent(AnalyticsEvents.CreditsExhausted, {
          plan: 'guest',
          first_click: runCountRef.current === 0,
        });
      }
      openPaywallRaw('credits');
    },
    onRequestFinished: () => void loadCredits(),
  });
  runCountRef.current = runCount;

  const {
    status: coverLetterStatus,
    result: coverLetterResult,
    errorMessage: coverLetterError,
    runCoverLetter,
    retryCoverLetter,
    hydrate: hydrateCoverLetter,
  } = useCoverLetter();

  const isGuest = isSignedIn === false;
  const isProPlan = checkIsProPlan(credits);
  const proSubscriptionItem = subscription?.subscriptionItems.find(
    (item) => item.plan.slug === 'pro' && (item.status === 'active' || item.status === 'past_due'),
  );
  const proCreditsResetsAt =
    proSubscriptionItem === undefined
      ? null
      : proSubscriptionItem.planPeriod === 'month' && proSubscriptionItem.periodEnd !== null
        ? proSubscriptionItem.periodEnd.toISOString()
        : getNextMonthlyResetAt(proSubscriptionItem.periodStart).toISOString();
  const freeAccountTotal = credits?.freeAccountTotal ?? 4;
  const freeCreditTotal = credits !== null && credits.plan !== 'pro' ? freeAccountTotal : null;
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

  const showLanding = view === 'landing';
  const showApplications = view === 'applications';
  const showUpgradeCta = !showLanding && hasUsedTool;

  useEffect(() => {
    registerTokenGetter(() => getToken());
    return () => registerTokenGetter(null);
  }, [getToken]);

  useEffect(() => subscribeToRateLimit(setRateLimitMessage), []);

  useEffect(() => {
    if (!isLoaded) return;
    void loadCredits();
    void loadSavedResumes();
    void loadRuns();
  }, [isLoaded, isSignedIn, loadCredits, loadSavedResumes, loadRuns]);

  useEffect(() => {
    if (status !== 'done' || !isStackedLayout) return;
    resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [status, isStackedLayout]);

  useEffect(() => {
    if (!showLanding) return;
    trackEvent(AnalyticsEvents.LandingView, { variant: heroVariant });
  }, [heroVariant, showLanding]);

  useEffect(() => {
    const handlePopState = () => {
      const nextView = pathToView(window.location.pathname);
      setView(nextView);
      if (nextView !== 'tool') {
        setShowingExample(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (nextView: AppView, path: string) => {
    setView(nextView);
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReviewStateChange = useCallback(
    (nextDecisions: Record<string, ChangeDecision>, nextAddedBullets: AddedBullet[]) => {
      setDecisions(nextDecisions);
      setAddedBullets(nextAddedBullets);
    },
    [],
  );

  useEffect(() => {
    if (isSignedIn !== true || status !== 'done' || !result?.runId) return;
    const runId = result.runId;
    const timeout = window.setTimeout(() => {
      patchTailorRunDecisions(runId, decisions, addedBullets).catch(() => undefined);
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [addedBullets, decisions, isSignedIn, result?.runId, status]);

  const stashCurrentRun = useCallback(() => {
    if (status !== 'done' || !result) return;
    const stashedResumeText = resumeText.trim() || result.resumeText;
    writePendingRun({
      runId: result.runId ?? crypto.randomUUID(),
      resumeName: formatDefaultResumeName(new Date(), attachedFile?.name),
      resumeText: stashedResumeText,
      jobDescription: jobDescription.trim(),
      result,
      coverLetterResult,
      decisions,
      addedBullets,
    });
  }, [
    addedBullets,
    attachedFile,
    coverLetterResult,
    decisions,
    jobDescription,
    result,
    resumeText,
    status,
  ]);

  const openPaywall = useCallback(
    (reason: PaywallReason) => {
      if (isSignedIn !== true && status === 'done' && result) {
        stashCurrentRun();
      }
      openPaywallRaw(reason);
    },
    [isSignedIn, openPaywallRaw, result, stashCurrentRun, status],
  );

  const applyRunDetail = useCallback(
    (
      resume: string,
      job: string,
      nextResult: typeof result,
      nextCoverLetter: typeof coverLetterResult,
      nextDecisions: Record<string, ChangeDecision>,
      nextAddedBullets: AddedBullet[],
      countAsRun: boolean,
    ) => {
      if (!nextResult) return;
      hydrateFromRun(resume);
      setJobDescription(job);
      hydrateTailor(nextResult, { countAsRun });
      hydrateCoverLetter(nextCoverLetter);
      setDecisions(nextDecisions);
      setAddedBullets(nextAddedBullets);
      setLastSuccessfulInputs({
        resumeText: resume.trim(),
        jobDescription: job.trim(),
      });
      setShowingExample(false);
      setActiveTab('resume');
    },
    [hydrateCoverLetter, hydrateFromRun, hydrateTailor],
  );

  useEffect(() => {
    const stash = readPendingRun();
    if (!stash || restoredPendingRunRef.current) return;
    restoredPendingRunRef.current = true;
    applyRunDetail(
      stash.resumeText,
      stash.jobDescription,
      stash.result,
      stash.coverLetterResult,
      stash.decisions,
      stash.addedBullets,
      true,
    );
    navigateTo('tool', TOOL_PATH);
  }, [applyRunDetail]);

  useEffect(() => {
    if (!isLoaded || isSignedIn !== true || claimedPendingRunRef.current) return;
    const stash = readPendingRun();
    if (!stash) return;
    claimedPendingRunRef.current = true;
    void claimTailorRun({
      runId: stash.runId,
      resumeName: stash.resumeName,
      resumeText: stash.resumeText,
      jobDescription: stash.jobDescription,
      result: stash.result,
      coverLetter: stash.coverLetterResult,
      decisions: stash.decisions,
      addedBullets: stash.addedBullets,
    })
      .then(() => {
        trackEvent(AnalyticsEvents.RunClaimed);
        clearPendingRun();
        void loadRuns();
      })
      .catch(() => {
        claimedPendingRunRef.current = false;
      });
  }, [isLoaded, isSignedIn, loadRuns]);

  const handleShowExample = () => {
    setShowingExample(true);
  };

  const handleDismissExample = () => {
    setShowingExample(false);
    setActiveTab('resume');
  };

  const handleRevealTool = () => {
    setShowingExample(false);
    navigateTo('tool', TOOL_PATH);
  };

  const handleShowExampleFromLanding = () => {
    handleRevealTool();
    setShowingExample(true);
    if (isStackedLayout) {
      requestAnimationFrame(() => {
        resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const handleGoHome = () => {
    setShowingExample(false);
    navigateTo('landing', '/');
  };

  const handleApplicationsClick = () => {
    if (isSignedIn !== true) {
      openPaywall('signUp');
      return;
    }
    navigateTo('applications', APPLICATIONS_PATH);
  };

  const handleSignupBannerClick = () => {
    trackEvent(AnalyticsEvents.SignupBannerClick);
    openPaywall('signUp');
  };

  const handleSignupBannerDismiss = () => {
    trackEvent(AnalyticsEvents.SignupBannerDismiss);
    setSignupBannerDismissed(true);
    try {
      sessionStorage.setItem(SIGNUP_BANNER_DISMISS_KEY, 'true');
    } catch {
      return;
    }
  };

  const handleReopenRun = async (runId: string) => {
    const detail = await getTailorRun(runId).catch(() => null);
    if (!detail) return;
    applyRunDetail(
      detail.result.resumeText,
      detail.jobDescription,
      { ...detail.result, runId: detail.id },
      detail.coverLetter,
      Object.keys(detail.decisions.decisions).length > 0
        ? detail.decisions.decisions
        : buildDecisionMap(detail.result),
      detail.decisions.addedBullets,
      false,
    );
    navigateTo('tool', TOOL_PATH);
  };

  const handleTailor = async () => {
    if (tailorActionInFlightRef.current) return;
    if (outOfCredits) {
      openPaywall(isGuest ? 'signUp' : 'credits');
      return;
    }
    if (!canTailor) return;
    tailorActionInFlightRef.current = true;
    try {
      setShowingExample(false);
      setActiveTab('resume');
      const runId = crypto.randomUUID();
      clearPendingRun();
      setDecisions({});
      setAddedBullets([]);
      void runCoverLetter(resumeText, jobDescription, runId);
      const succeeded = await runTailor(
        resumeText,
        jobDescription,
        formatDefaultResumeName(
          new Date(),
          attachedFile?.name,
          savedResumes.map((resume) => resume.name),
        ),
        result?.document ?? resumeDocument,
        resumeLayout,
        runId,
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

  const showSignupBanner =
    isGuest && status === 'done' && runCount === 1 && !signupBannerDismissed && !showingExample;

  useEffect(() => {
    if (showSignupBanner) {
      trackEvent(AnalyticsEvents.SignupBannerShown);
    }
  }, [showSignupBanner]);

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
        showUpgradeCta={showUpgradeCta}
        showCreditsBadge={!showLanding}
        onUpgradeClick={() => openPaywall('upgrade')}
        onRetryCredits={() => void loadCredits()}
        onHomeClick={handleGoHome}
        onApplicationsClick={handleApplicationsClick}
        onSignInClick={stashCurrentRun}
        applicationsCount={isSignedIn === true ? runs.length + hiddenOlderCount : null}
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
        {showLanding ? (
          <>
            <LandingHero
              copy={heroCopyForVariant(heroVariant)}
              variant={heroVariant}
              onStartClick={handleRevealTool}
              onExampleClick={handleShowExampleFromLanding}
            />
            <WhyNotChatGpt />
          </>
        ) : showApplications ? (
          <ApplicationsList
            runs={runs}
            hiddenOlderCount={hiddenOlderCount}
            isLoading={isLoadingRuns}
            isProPlan={isProPlan}
            onReopen={(runId) => void handleReopenRun(runId)}
            onDelete={(runId) => void deleteRun(runId)}
            onNewApplication={handleRevealTool}
            onUpgradeClick={() => openPaywall('upgrade')}
            onKeepFormattingGate={() => openPaywall('keepFormatting')}
          />
        ) : (
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
                isProPlan={isProPlan}
                isGuest={isGuest}
                showSignupBanner={showSignupBanner}
                freeAccountTotal={freeAccountTotal}
                onSignupBannerClick={handleSignupBannerClick}
                onSignupBannerDismiss={handleSignupBannerDismiss}
                initialDecisions={decisions}
                initialAddedBullets={addedBullets}
                coverLetterStatus={coverLetterStatus}
                coverLetterResult={coverLetterResult}
                coverLetterError={coverLetterError}
                onRetryCoverLetter={retryCoverLetter}
                onUpgradeClick={() => openPaywall('coverLetter')}
                onGapsUpgradeClick={() => openPaywall('gaps')}
                onExportGate={() => openPaywall('export')}
                onKeepFormattingGate={() => openPaywall('keepFormatting')}
                onReviewStateChange={handleReviewStateChange}
              />
            </Grid.Col>
          </Grid>
        )}
      </Container>

      <LandingStrip
        collapsible={!showLanding && (status !== 'idle' || runCount > 0 || showApplications)}
        freeCreditTotal={freeCreditTotal}
        showUpgradeButton={showUpgradeCta}
        onUpgradeClick={() => openPaywall('upgrade')}
        onStartClick={showLanding ? handleRevealTool : undefined}
        heroVariant={heroVariant}
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
