import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Container,
  Grid,
  Group,
  Loader,
  Stack,
  Tabs,
  Text,
} from '@mantine/core'
import { useAuth } from '@clerk/clerk-react'
import {
  IconAlertCircle,
  IconArrowBackUp,
  IconCheck,
  IconEye,
  IconFileText,
  IconLock,
  IconMail,
  IconSparkles,
} from '@tabler/icons-react'
import AppHeader from './components/AppHeader'
import AppFooter from './components/AppFooter'
import ResumeInput from './components/ResumeInput'
import JobDescriptionInput from './components/JobDescriptionInput'
import ResultsPanel from './components/ResultsPanel'
import CoverLetterPanel from './components/CoverLetterPanel'
import PaywallModal from './components/PaywallModal'
import { useCredits } from './hooks/useCredits'
import { useSavedResumes } from './hooks/useSavedResumes'
import { useTailorRun } from './hooks/useTailorRun'
import { useCoverLetter } from './hooks/useCoverLetter'
import {
  SAMPLE_COVER_LETTER_RESULT,
  SAMPLE_MATCH_SCORE,
  SAMPLE_TAILOR_RESULT,
} from './lib/mockTailor'
import { trackEvent } from './lib/analytics'
import { registerTokenGetter } from './lib/authToken'
import { subscribeToRateLimit } from './lib/rateLimitNotice'
import { formatDefaultResumeName } from './lib/formatDefaultResumeName'
import { normalizeResumeTextForComparison } from './lib/exportDocx'
import { cleanupOriginalDocxStore, loadOriginalDocx, saveOriginalDocx } from './lib/docxStore'
import type { PaywallReason } from './components/PaywallModal'
import type { SavedResume } from './lib/types'

type AttachedFile = {
  name: string
  size: number
}

type OriginalDocx = {
  file: File
  parsedText: string
}

const PENDING_PAYWALL_KEY = 'deltaResume.pendingPaywallReason'
const PAYWALL_REASONS: PaywallReason[] = ['credits', 'savedLimit', 'upgrade', 'coverLetter']

const readPendingPaywallReason = (): PaywallReason | null => {
  const stored = sessionStorage.getItem(PENDING_PAYWALL_KEY)
  if (!stored) return null
  return PAYWALL_REASONS.includes(stored as PaywallReason) ? (stored as PaywallReason) : null
}

const App = () => {
  const { isSignedIn, getToken } = useAuth()
  const [resumeText, setResumeText] = useState('')
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null)
  const [originalDocx, setOriginalDocx] = useState<OriginalDocx | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [lastRunJobDescription, setLastRunJobDescription] = useState('')
  const [lastSuccessfulInputs, setLastSuccessfulInputs] = useState<{
    resumeText: string
    jobDescription: string
  } | null>(null)
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null)

  const openPaywall = (reason: PaywallReason) => {
    setPaywallReason(reason)
    if (!isSignedIn) {
      sessionStorage.setItem(PENDING_PAYWALL_KEY, reason)
    }
  }

  const handlePaywallClose = () => {
    setPaywallReason(null)
    sessionStorage.removeItem(PENDING_PAYWALL_KEY)
  }
  const [showingExample, setShowingExample] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>('resume')
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null)

  const pendingDocxRestoreRef = useRef<string | null>(null)

  const { credits, outOfCredits, creditsLabel, loadCredits } = useCredits()
  const {
    savedResumes,
    isLoadingSavedResumes,
    hasLoadedSavedResumes,
    loadSavedResumes,
    renameResume,
    deleteResume,
  } = useSavedResumes()
  const { status, result, runCount, errorMessage, clearError, runTailor } = useTailorRun({
    onSuccess: () => {
      trackEvent('tailor_resume')
      void loadCredits()
      void loadSavedResumes()
    },
    onCreditsExhausted: () => {
      openPaywall('credits')
      void loadCredits()
    },
  })

  const {
    status: coverLetterStatus,
    result: coverLetterResult,
    errorMessage: coverLetterError,
    runCoverLetter,
    retryCoverLetter,
  } = useCoverLetter()

  const isProPlan = credits?.plan === 'pro'
  const planLoaded = credits !== null

  const inputsUnchangedSinceLastRun =
    lastSuccessfulInputs !== null &&
    lastSuccessfulInputs.resumeText === resumeText.trim() &&
    lastSuccessfulInputs.jobDescription === jobDescription.trim()

  const canTailor =
    resumeText.trim().length > 0 &&
    jobDescription.trim().length > 0 &&
    !inputsUnchangedSinceLastRun

  useEffect(() => {
    registerTokenGetter(() => getToken())
    return () => registerTokenGetter(null)
  }, [getToken])

  useEffect(() => subscribeToRateLimit(setRateLimitMessage), [])

  useEffect(() => {
    void loadCredits()
    void loadSavedResumes()
  }, [isSignedIn, loadCredits, loadSavedResumes])

  useEffect(() => {
    if (!isSignedIn) return
    const pendingReason = readPendingPaywallReason()
    if (!pendingReason) return
    sessionStorage.removeItem(PENDING_PAYWALL_KEY)
    setPaywallReason(pendingReason)
  }, [isSignedIn])

  useEffect(() => {
    if (credits !== null && credits.remaining > 0) {
      setPaywallReason((reason) => (reason === 'credits' ? null : reason))
    }
  }, [credits])

  useEffect(() => {
    if (!hasLoadedSavedResumes || isLoadingSavedResumes) return
    const keepTexts = savedResumes.map((resume) => resume.resumeText)
    if (originalDocx) keepTexts.push(originalDocx.parsedText)
    void cleanupOriginalDocxStore(keepTexts)
  }, [hasLoadedSavedResumes, isLoadingSavedResumes, savedResumes, originalDocx])

  const handleResumeTextChange = (text: string) => {
    pendingDocxRestoreRef.current = null
    setResumeText(text)
  }

  const handleFileAttach = (file: AttachedFile, text: string, sourceFile: File) => {
    pendingDocxRestoreRef.current = null
    setAttachedFile(file)
    setResumeText(text)
    const isDocx = sourceFile.name.toLowerCase().endsWith('.docx')
    setOriginalDocx(isDocx ? { file: sourceFile, parsedText: text } : null)
    if (isDocx) {
      void saveOriginalDocx(text, sourceFile)
    }
  }

  const handleClearResume = () => {
    pendingDocxRestoreRef.current = null
    setAttachedFile(null)
    setOriginalDocx(null)
    setResumeText('')
  }

  const restoreSavedDocx = async (savedResumeText: string) => {
    const file = await loadOriginalDocx(savedResumeText)
    if (!file || pendingDocxRestoreRef.current !== savedResumeText) return
    pendingDocxRestoreRef.current = null
    setAttachedFile({ name: file.name, size: file.size })
    setOriginalDocx({ file, parsedText: savedResumeText })
  }

  const handleSelectSaved = (resume: SavedResume) => {
    const matchesAttachedDocx =
      originalDocx !== null &&
      normalizeResumeTextForComparison(originalDocx.parsedText) ===
        normalizeResumeTextForComparison(resume.resumeText)

    setResumeText(resume.resumeText)
    if (matchesAttachedDocx) {
      pendingDocxRestoreRef.current = null
      return
    }
    setAttachedFile(null)
    setOriginalDocx(null)
    pendingDocxRestoreRef.current = resume.resumeText
    void restoreSavedDocx(resume.resumeText)
  }

  const handleShowExample = () => {
    setShowingExample(true)
  }

  const handleDismissExample = () => {
    setShowingExample(false)
    setActiveTab('resume')
  }

  const handleTailor = async () => {
    if (!canTailor) return
    if (outOfCredits) {
      openPaywall('credits')
      return
    }
    setShowingExample(false)
    setActiveTab('resume')
    setLastRunJobDescription(jobDescription)
    if (isProPlan) {
      void runCoverLetter(resumeText, jobDescription)
    }
    const succeeded = await runTailor(resumeText, jobDescription, formatDefaultResumeName(new Date()))
    if (succeeded) {
      setLastSuccessfulInputs({
        resumeText: resumeText.trim(),
        jobDescription: jobDescription.trim(),
      })
      if (originalDocx) {
        void saveOriginalDocx(originalDocx.parsedText, originalDocx.file)
      }
    }
  }

  const resumeTabIndicator = showingExample ? null : status === 'loading' ? (
    <Loader size={12} />
  ) : status === 'done' ? (
    <IconCheck size={14} color="var(--mantine-color-green-filled)" />
  ) : null

  const coverLetterTabIndicator = !planLoaded ? null : !isProPlan ? (
    <Badge size="xs" variant="light" h={16}>
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
  ) : null

  return (
    <Box mih="100vh" style={{ display: 'flex', flexDirection: 'column' }}>
      <AppHeader
        creditsLabel={creditsLabel}
        outOfCredits={outOfCredits}
        isProPlan={isProPlan}
        planLoaded={planLoaded}
        onUpgradeClick={() => openPaywall('upgrade')}
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
            <Stack gap="lg">
              <ResumeInput
                resumeText={resumeText}
                attachedFile={attachedFile}
                savedResumes={savedResumes}
                isLoadingSavedResumes={isLoadingSavedResumes}
                savedResumeLimit={isProPlan ? 10 : 1}
                isProPlan={isProPlan}
                onResumeTextChange={handleResumeTextChange}
                onFileAttach={handleFileAttach}
                onClear={handleClearResume}
                onSelectSaved={handleSelectSaved}
                onRenameSaved={renameResume}
                onDeleteSaved={deleteResume}
                onUpgradeClick={() => openPaywall('savedLimit')}
              />
              <JobDescriptionInput
                value={jobDescription}
                onChange={setJobDescription}
              />
              <Stack gap="xs">
                <Button
                  size="md"
                  leftSection={<IconSparkles size={18} />}
                  disabled={!canTailor}
                  loading={status === 'loading'}
                  onClick={handleTailor}
                >
                  {outOfCredits ? 'Get more credits' : 'Tailor Resume'}
                </Button>
                {inputsUnchangedSinceLastRun && !outOfCredits && (
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
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack gap="md">
              {errorMessage && (
                <Alert
                  color="red"
                  icon={<IconAlertCircle size={18} />}
                  title="Tailoring failed"
                  withCloseButton
                  onClose={clearError}
                >
                  {errorMessage}
                </Alert>
              )}
              {showingExample && (
                <Group
                  justify="space-between"
                  align="center"
                  wrap="wrap"
                  p="sm"
                  style={{
                    borderRadius: 8,
                    backgroundColor: 'var(--mantine-color-cyan-light)',
                  }}
                >
                  <Group gap="xs">
                    <IconEye size={16} color="var(--mantine-color-cyan-4)" />
                    <Text size="sm">
                      This is an example. Explore the resume changes and cover letter, then run
                      your own tailor.
                    </Text>
                  </Group>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="cyan"
                    leftSection={<IconArrowBackUp size={14} />}
                    onClick={handleDismissExample}
                  >
                    Back
                  </Button>
                </Group>
              )}
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab
                    value="resume"
                    leftSection={<IconFileText size={16} />}
                    rightSection={
                      resumeTabIndicator && <Center h={16}>{resumeTabIndicator}</Center>
                    }
                  >
                    Resume changes
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="coverLetter"
                    leftSection={
                      planLoaded && !isProPlan ? <IconLock size={16} /> : <IconMail size={16} />
                    }
                    rightSection={
                      coverLetterTabIndicator && (
                        <Center h={16}>{coverLetterTabIndicator}</Center>
                      )
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
                    jobDescription={showingExample ? '' : lastRunJobDescription}
                    exampleMatchScore={showingExample ? SAMPLE_MATCH_SCORE : undefined}
                    originalDocx={showingExample ? null : originalDocx}
                    onShowExample={status === 'idle' ? handleShowExample : undefined}
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
                    onRetry={retryCoverLetter}
                    onUpgradeClick={() => openPaywall('coverLetter')}
                  />
                </Tabs.Panel>
              </Tabs>
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>

      <AppFooter />

      <PaywallModal
        opened={paywallReason !== null}
        reason={paywallReason ?? 'credits'}
        onClose={handlePaywallClose}
        onSubscriptionChange={loadCredits}
      />
    </Box>
  )
}

export default App
