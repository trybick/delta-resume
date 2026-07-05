import { useEffect, useState } from 'react'
import { Box, Card, Group, Paper, Skeleton, Stack, Text } from '@mantine/core'
import { IconSparkles } from '@tabler/icons-react'

const stageMessages: string[] = [
  'Reading your resume…',
  'Extracting key requirements from the job description…',
  'Matching your experience to the role…',
  'Rewriting bullets for impact…',
  'Polishing the final suggestions…',
]

const messageIntervalMs = 2600

type SkeletonLineProps = {
  width: string
}

const SkeletonLine = ({ width }: SkeletonLineProps) => (
  <Skeleton height={10} radius="xl" width={width} />
)

const SkeletonDiffCard = () => (
  <Paper
    withBorder
    p="sm"
    radius="md"
    style={{ borderLeft: '3px solid var(--mantine-primary-color-filled)' }}
  >
    <Group justify="space-between" mb={12} wrap="nowrap">
      <Skeleton height={22} width={180} radius="sm" />
      <Group gap={6} wrap="nowrap">
        <Skeleton height={22} width={22} radius="sm" />
        <Skeleton height={22} width={22} radius="sm" />
      </Group>
    </Group>
    <Stack gap={8}>
      <SkeletonLine width="95%" />
      <SkeletonLine width="82%" />
    </Stack>
  </Paper>
)

const TailoringLoader = () => {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % stageMessages.length)
    }, messageIntervalMs)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <Card
      withBorder
      shadow="xs"
      padding="xl"
      h="100%"
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <Box className="tailoring-loader-topbar" />
      <Stack gap="lg" mt="xs">
        <Group gap="sm" align="center">
          <Box className="tailoring-loader-sparkle" style={{ display: 'flex' }}>
            <IconSparkles size={24} color="var(--mantine-primary-color-filled)" />
          </Box>
          <Text
            key={messageIndex}
            size="sm"
            c="dimmed"
            className="tailoring-loader-message"
            aria-live="polite"
          >
            {stageMessages[messageIndex]}
          </Text>
        </Group>
        <Stack gap="sm">
          <SkeletonLine width="40%" />
          <SkeletonDiffCard />
          <SkeletonLine width="55%" />
          <SkeletonDiffCard />
          <SkeletonLine width="35%" />
          <SkeletonLine width="70%" />
          <SkeletonDiffCard />
        </Stack>
      </Stack>
    </Card>
  )
}

export default TailoringLoader
