import { useEffect, useState } from 'react';
import { Box, Card, Group, Skeleton, Stack, Text } from '@mantine/core';
import { IconMail } from '@tabler/icons-react';

const writingStageMessages: string[] = [
  'Reading the job description…',
  'Picking out your strongest matching experience…',
  'Drafting an opening that hooks the reader…',
  'Writing the body paragraphs…',
  'Wrapping up with a confident closing…',
];

const writingMessageIntervalMs = 2600;

type SkeletonParagraphProps = {
  widths: string[];
};

const SkeletonParagraph = ({ widths }: SkeletonParagraphProps) => (
  <Stack gap={8}>
    {widths.map((width, index) => (
      <Skeleton key={index} height={10} radius="xl" width={width} />
    ))}
  </Stack>
);

const WritingLoader = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % writingStageMessages.length);
    }, writingMessageIntervalMs);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <Card withBorder shadow="xs" padding="xl" style={{ position: 'relative', overflow: 'hidden' }}>
      <Box className="tailoring-loader-topbar" />
      <Stack gap="lg" mt="xs">
        <Group gap="sm" align="center">
          <Box className="tailoring-loader-sparkle" style={{ display: 'flex' }}>
            <IconMail size={24} color="var(--mantine-primary-color-filled)" />
          </Box>
          <Text
            key={messageIndex}
            size="sm"
            c="dimmed"
            className="tailoring-loader-message"
            aria-live="polite"
          >
            {writingStageMessages[messageIndex]}
          </Text>
        </Group>
        <Stack gap="lg">
          <Skeleton height={10} radius="xl" width="28%" />
          <SkeletonParagraph widths={['96%', '91%', '94%', '55%']} />
          <SkeletonParagraph widths={['93%', '97%', '88%', '95%', '42%']} />
          <SkeletonParagraph widths={['90%', '68%']} />
          <Stack gap={8}>
            <Skeleton height={10} radius="xl" width="18%" />
            <Skeleton height={10} radius="xl" width="24%" />
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
};

export default WritingLoader;
