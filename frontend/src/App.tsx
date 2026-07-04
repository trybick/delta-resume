import { useCallback, useEffect, useState, type ComponentProps } from 'react'
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
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
} from '@clerk/clerk-react'
import {
  IconAlertCircle,
  IconBrandGoogleFilled,
  IconCoins,
  IconSparkles,
} from '@tabler/icons-react'
import ResumeInput from './components/ResumeInput'
import JobDescriptionInput from './components/JobDescriptionInput'
import ResultsPanel from './components/ResultsPanel'
import PaywallModal from './components/PaywallModal'
import { ApiError, CreditsExhaustedError, getCredits, postTailor } from './lib/api'
import { registerTokenGetter } from './lib/authToken'
import type { CreditStatus, TailorResult, TailorStatus } from './lib/types'

type AttachedFile = {
  name: string
  size: number
}

type ClerkAuthButtonProps = ComponentProps<typeof Button> & {
  component?: string
  clerk?: unknown
}

const ClerkAuthButton = ({ component: _component, clerk: _clerk, ...props }: ClerkAuthButtonProps) => (
  <Button {...props} />
)

const App = () => {
  const { isSignedIn, getToken } = useAuth()
  const [resumeText, setResumeText] = useState('')
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [status, setStatus] = useState<TailorStatus>('idle')
  const [result, setResult] = useState<TailorResult | null>(null)
  const [runCount, setRunCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [credits, setCredits] = useState<CreditStatus | null>(null)
  const [paywallOpened, setPaywallOpened] = useState(false)

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
        setPaywallOpened(false)
      }
    } catch {
      setCredits(null)
    }
  }, [])

  useEffect(() => {
    void loadCredits()
  }, [isSignedIn, loadCredits])

  const handleFileAttach = (file: AttachedFile, text: string) => {
    setAttachedFile(file)
    setResumeText(text)
  }

  const handleClearResume = () => {
    setAttachedFile(null)
    setResumeText('')
  }

  const handleTailor = async () => {
    if (!canTailor) return
    if (outOfCredits) {
      setPaywallOpened(true)
      return
    }
    setStatus('loading')
    setErrorMessage(null)
    try {
      const tailorResult = await postTailor(resumeText, jobDescription)
      setResult(tailorResult)
      setRunCount((count) => count + 1)
      setStatus('done')
      void loadCredits()
    } catch (error) {
      if (error instanceof CreditsExhaustedError) {
        setPaywallOpened(true)
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
            <ThemeIcon variant="light" size="lg" radius="md">
              <IconSparkles size={20} />
            </ThemeIcon>
            <div>
              <Title order={3}>Delta Resume</Title>
              <Text size="xs" c="dimmed">
                Optimize your resume bullets for any job description
              </Text>
            </div>
          </Group>
          <Group gap="sm">
            {creditsLabel && (
              <Tooltip label="One credit is used per tailor run">
                <Badge
                  size="lg"
                  variant="light"
                  color={outOfCredits ? 'red' : 'cyan'}
                  leftSection={<IconCoins size={14} />}
                >
                  {creditsLabel}
                </Badge>
              </Tooltip>
            )}
            <SignedOut>
              <Group gap="xs">
                <SignInButton mode="modal">
                  <ClerkAuthButton
                    variant="white"
                    color="dark"
                    leftSection={<IconBrandGoogleFilled size={16} />}
                  >
                    Continue with Google
                  </ClerkAuthButton>
                </SignInButton>
                <SignInButton mode="modal">
                  <ClerkAuthButton variant="subtle" color="gray">
                    Sign in
                  </ClerkAuthButton>
                </SignInButton>
                <SignUpButton mode="modal">
                  <ClerkAuthButton variant="outline" color="cyan">
                    Sign up
                  </ClerkAuthButton>
                </SignUpButton>
              </Group>
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
                onResumeTextChange={setResumeText}
                onFileAttach={handleFileAttach}
                onClear={handleClearResume}
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
              <ResultsPanel key={runCount} status={status} result={result} />
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>

      <PaywallModal
        opened={paywallOpened}
        onClose={() => setPaywallOpened(false)}
        onSubscriptionChange={loadCredits}
      />
    </Box>
  )
}

export default App
