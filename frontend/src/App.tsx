import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  Stack,
  Text,
} from '@mantine/core'
import { useAuth } from '@clerk/clerk-react'
import {
  IconAlertCircle,
  IconSparkles,
} from '@tabler/icons-react'
import AppHeader from './components/AppHeader'
import ResumeInput from './components/ResumeInput'
import JobDescriptionInput from './components/JobDescriptionInput'
import ResultsPanel from './components/ResultsPanel'
import PaywallModal from './components/PaywallModal'
import { useCredits } from './hooks/useCredits'
import { useSavedResumes } from './hooks/useSavedResumes'
import { useTailorRun } from './hooks/useTailorRun'
import { SAMPLE_TAILOR_RESULT } from './lib/mockTailor'
import { registerTokenGetter } from './lib/authToken'
import { formatDefaultResumeName } from './lib/formatDefaultResumeName'
import type { PaywallReason } from './components/PaywallModal'
import type { SavedResume } from './lib/types'

type AttachedFile = {
  name: string
  size: number
}

const App = () => {
  const { isSignedIn, getToken } = useAuth()
  const [resumeText, setResumeText] = useState('')
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null)
  const [showingExample, setShowingExample] = useState(false)

  const { credits, outOfCredits, creditsLabel, loadCredits } = useCredits()
  const { savedResumes, loadSavedResumes, renameResume, deleteResume } = useSavedResumes()
  const { status, result, runCount, errorMessage, clearError, runTailor } = useTailorRun({
    onSuccess: () => {
      void loadCredits()
      void loadSavedResumes()
    },
    onCreditsExhausted: () => {
      setPaywallReason('credits')
      void loadCredits()
    },
  })

  const canTailor = resumeText.trim().length > 0 && jobDescription.trim().length > 0

  useEffect(() => {
    registerTokenGetter(() => getToken())
    return () => registerTokenGetter(null)
  }, [getToken])

  useEffect(() => {
    void loadCredits()
    void loadSavedResumes()
  }, [isSignedIn, loadCredits, loadSavedResumes])

  useEffect(() => {
    if (credits !== null && credits.remaining > 0) {
      setPaywallReason((reason) => (reason === 'credits' ? null : reason))
    }
  }, [credits])

  const handleFileAttach = (file: AttachedFile, text: string) => {
    setAttachedFile(file)
    setResumeText(text)
  }

  const handleClearResume = () => {
    setAttachedFile(null)
    setResumeText('')
  }

  const handleSelectSaved = (resume: SavedResume) => {
    setAttachedFile(null)
    setResumeText(resume.resumeText)
  }

  const handleTailor = async () => {
    if (!canTailor) return
    if (outOfCredits) {
      setPaywallReason('credits')
      return
    }
    setShowingExample(false)
    await runTailor(resumeText, jobDescription, formatDefaultResumeName(new Date()))
  }

  return (
    <Box>
      <AppHeader creditsLabel={creditsLabel} outOfCredits={outOfCredits} />

      <Container size="xl" py="xl">
        <Grid gap="xl">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack gap="lg">
              <ResumeInput
                resumeText={resumeText}
                attachedFile={attachedFile}
                savedResumes={savedResumes}
                savedResumeLimit={credits?.plan === 'pro' ? 10 : 1}
                isProPlan={credits?.plan === 'pro'}
                onResumeTextChange={setResumeText}
                onFileAttach={handleFileAttach}
                onClear={handleClearResume}
                onSelectSaved={handleSelectSaved}
                onRenameSaved={renameResume}
                onDeleteSaved={deleteResume}
                onUpgradeClick={() => setPaywallReason('savedLimit')}
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
              <ResultsPanel
                key={showingExample ? 'example' : runCount}
                status={showingExample ? 'done' : status}
                result={showingExample ? SAMPLE_TAILOR_RESULT : result}
                isExample={showingExample}
                onShowExample={() => setShowingExample(true)}
                onDismissExample={() => setShowingExample(false)}
              />
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>

      <PaywallModal
        opened={paywallReason !== null}
        reason={paywallReason ?? 'credits'}
        onClose={() => setPaywallReason(null)}
        onSubscriptionChange={loadCredits}
      />
    </Box>
  )
}

export default App
