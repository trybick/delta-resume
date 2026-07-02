import { useState } from 'react'
import {
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
import { IconSparkles } from '@tabler/icons-react'
import ResumeInput from './components/ResumeInput'
import JobDescriptionInput from './components/JobDescriptionInput'
import ResultsPanel from './components/ResultsPanel'
import { tailorResume } from './lib/mockTailor'
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
    const tailorResult = await tailorResume(resumeText, jobDescription)
    setResult(tailorResult)
    setRunCount((count) => count + 1)
    setStatus('done')
  }

  return (
    <Box>
      <Box
        component="header"
        py="md"
        px="xl"
        bg="white"
        style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
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
            <ResultsPanel key={runCount} status={status} result={result} />
          </Grid.Col>
        </Grid>
      </Container>
    </Box>
  )
}

export default App
