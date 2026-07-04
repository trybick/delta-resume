import {
  useCallback,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
} from 'react'
import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  Grid,
  Group,
  Stack,
  Text,
  Title,
  Tooltip,
  type ButtonProps,
} from '@mantine/core'
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
} from '@clerk/clerk-react'
import {
  IconAlertCircle,
  IconCoins,
  IconSparkles,
} from '@tabler/icons-react'
import DeltaLogo from './components/DeltaLogo'
import ThemeSwitcher from './components/ThemeSwitcher'
import { useAppTheme } from './lib/themeContext'
import ResumeInput from './components/ResumeInput'
import JobDescriptionInput from './components/JobDescriptionInput'
import ResultsPanel from './components/ResultsPanel'
import PaywallModal from './components/PaywallModal'
import {
  ApiError,
  CreditsExhaustedError,
  deleteSavedResume,
  getCredits,
  getSavedResumes,
  postTailor,
  renameSavedResume,
} from './lib/api'
import { SAMPLE_TAILOR_RESULT } from './lib/mockTailor'
import { registerTokenGetter } from './lib/authToken'
import type { PaywallReason } from './components/PaywallModal'
import type { CreditStatus, SavedResume, TailorResult, TailorStatus } from './lib/types'

type AttachedFile = {
  name: string
  size: number
}

type ClerkAuthButtonProps = ButtonProps &
  ComponentPropsWithoutRef<'button'> & {
    component?: string
    clerk?: unknown
  }

const ClerkAuthButton = ({ component: _component, clerk: _clerk, ...props }: ClerkAuthButtonProps) => (
  <Button {...props} />
)

const formatDefaultResumeName = (date: Date): string => {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const year = String(date.getFullYear()).slice(-2)
  const rawHours = date.getHours()
  const suffix = rawHours >= 12 ? 'pm' : 'am'
  const hours = rawHours % 12 || 12
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `Resume ${month}/${day}/${year} ${hours}:${minutes} ${suffix}`
}

const App = () => {
  const { isSignedIn, getToken } = useAuth()
  const { appTheme } = useAppTheme()
  const [resumeText, setResumeText] = useState('')
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [status, setStatus] = useState<TailorStatus>('idle')
  const [result, setResult] = useState<TailorResult | null>(null)
  const [runCount, setRunCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [credits, setCredits] = useState<CreditStatus | null>(null)
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null)
  const [showingExample, setShowingExample] = useState(false)
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([])

  const canTailor = resumeText.trim().length > 0 && jobDescription.trim().length > 0
  const outOfCredits = credits !== null && credits.remaining <= 0

  useEffect(() => {
    registerTokenGetter(() => getToken())
    return () => registerTokenGetter(null)
  }, [getToken])

  const loadCredits = useCallback(async () => {
    try {
      const creditStatus = await getCredits()
      setCredits(creditStatus)
      if (creditStatus.remaining > 0) {
        setPaywallReason((reason) => (reason === 'credits' ? null : reason))
      }
    } catch {
      setCredits(null)
    }
  }, [])

  const loadSavedResumes = useCallback(async () => {
    try {
      const resumes = await getSavedResumes()
      setSavedResumes(resumes)
    } catch {
      setSavedResumes([])
    }
  }, [])

  useEffect(() => {
    void loadCredits()
    void loadSavedResumes()
  }, [isSignedIn, loadCredits, loadSavedResumes])

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

  const handleRenameSaved = async (resumeId: string, name: string) => {
    setSavedResumes((resumes) =>
      resumes.map((resume) => (resume.id === resumeId ? { ...resume, name } : resume)),
    )
    try {
      await renameSavedResume(resumeId, name)
    } catch {
      void loadSavedResumes()
    }
  }

  const handleDeleteSaved = async (resumeId: string) => {
    setSavedResumes((resumes) => resumes.filter((resume) => resume.id !== resumeId))
    try {
      await deleteSavedResume(resumeId)
    } catch {
      void loadSavedResumes()
    }
  }

  const handleTailor = async () => {
    if (!canTailor) return
    if (outOfCredits) {
      setPaywallReason('credits')
      return
    }
    setShowingExample(false)
    setStatus('loading')
    setErrorMessage(null)
    try {
      const tailorResult = await postTailor(
        resumeText,
        jobDescription,
        formatDefaultResumeName(new Date()),
      )
      setResult(tailorResult)
      setRunCount((count) => count + 1)
      setStatus('done')
      void loadCredits()
      void loadSavedResumes()
    } catch (error) {
      if (error instanceof CreditsExhaustedError) {
        setPaywallReason('credits')
        void loadCredits()
      } else {
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : 'Could not reach the server. Is the backend running?',
        )
      }
      setStatus(result ? 'done' : 'idle')
    }
  }

  const creditsLabel =
    credits === null
      ? null
      : credits.plan === 'pro'
        ? `${credits.remaining} credits`
        : `${credits.remaining} free ${credits.remaining === 1 ? 'credit' : 'credits'} left`

  return (
    <Box>
      <Box
        component="header"
        py="md"
        px="xl"
        bg="dark.7"
        style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}
      >
        <Group justify="space-between">
          <Group gap="sm">
            <DeltaLogo size={40} />
            <div>
              <Title order={3} style={{ letterSpacing: '-0.02em' }}>
                <Text
                  span
                  inherit
                  variant="gradient"
                  gradient={{ ...appTheme.gradient, deg: 45 }}
                >
                  Delta
                </Text>{' '}
                <Text span inherit fw={400} c="gray.3">
                  Resume
                </Text>
              </Title>
              <Text size="xs" c="dimmed">
                Optimize your resume bullets for any job description
              </Text>
            </div>
          </Group>
          <Group gap="sm">
            <ThemeSwitcher />
            {creditsLabel && (
              <Tooltip label="One credit is used per tailor run">
                <Badge
                  size="lg"
                  variant="light"
                  color={outOfCredits ? 'red' : undefined}
                  leftSection={<IconCoins size={14} />}
                >
                  {creditsLabel}
                </Badge>
              </Tooltip>
            )}
            <SignedOut>
              <SignInButton mode="modal">
                <ClerkAuthButton variant="outline">
                  Sign in
                </ClerkAuthButton>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </Group>
        </Group>
      </Box>

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
                onRenameSaved={handleRenameSaved}
                onDeleteSaved={handleDeleteSaved}
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
                  onClose={() => setErrorMessage(null)}
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
