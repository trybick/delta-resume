import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconSparkles } from '@tabler/icons-react'
import ResumeInput from './components/ResumeInput'
import JobDescriptionInput from './components/JobDescriptionInput'
import ResultsPanel from './components/ResultsPanel'
import { ApiError, postTailor } from './lib/api'
import type { TailorResult, TailorStatus } from './lib/types'

type AttachedFile = {
  name: string
  size: number
}

const App = () => {
  const [resumeText, setResumeText] = useState('')
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [status, setStatus] = useState<TailorStatus>('idle')
  const [result, setResult] = useState<TailorResult | null>(null)
  const [runCount, setRunCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const canTailor = resumeText.trim().length > 0 && jobDescription.trim().length > 0

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
    setStatus('loading')
    setErrorMessage(null)
    try {
      const tailorResult = await postTailor(resumeText, jobDescription)
      setResult(tailorResult)
      setRunCount((count) => count + 1)
      setStatus('done')
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'Could not reach the server. Is the backend running?',
      )
      setStatus(result ? 'done' : 'idle')
    }
  }

  return (
    <Box>
      <Box
        component="header"
        py="md"
        px="xl"
        bg="dark.7"
        style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}
      >
        <Group gap="sm">
          <ThemeIcon variant="light" size="lg" radius="md">
            <IconSparkles size={20} />
          </ThemeIcon>
          <div>
            <Title order={3}>Resume Tailor</Title>
            <Text size="xs" c="dimmed">
              Optimize your resume bullets for any job description
            </Text>
          </div>
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
              <Button
                size="md"
                leftSection={<IconSparkles size={18} />}
                disabled={!canTailor}
                loading={status === 'loading'}
                onClick={handleTailor}
              >
                Tailor Resume
              </Button>
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
    </Box>
  )
}

export default App
