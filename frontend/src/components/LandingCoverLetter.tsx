import { Badge, Box, Button, Card, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconEye, IconMail } from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { prependCoverLetterDate } from '../lib/formatCoverLetter';
import { SAMPLE_COVER_LETTER_RESULT } from '../lib/mockTailor';
import { proAccent } from '../lib/proAccent';

type LandingCoverLetterProps = {
  onExampleClick?: () => void;
};

const LandingCoverLetter = ({ onExampleClick }: LandingCoverLetterProps) => {
  const handleExampleClick = () => {
    trackEvent(AnalyticsEvents.LandingCta, { placement: 'cover_letter_example' });
    onExampleClick?.();
  };

  return (
    <Stack gap="xl" align="center">
      <Stack gap="sm" align="center">
        <Group gap="sm" justify="center">
          <Title order={2} ta="center">
            One run, two documents
          </Title>
          <Badge size="lg" variant="gradient" gradient={{ ...proAccent.gradient, deg: 45 }}>
            Pro
          </Badge>
        </Group>
        <Text size="sm" c="dimmed" ta="center" maw={520}>
          On Pro, the same run that tailors your resume also writes a matching cover letter, in your
          choice of length and tone. This is the letter from our example run.
        </Text>
      </Stack>
      <Card withBorder padding="lg" radius="md" maw={720} w="100%">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon size={36} radius="md" variant="light" color="orange">
                <IconMail size={19} />
              </ThemeIcon>
              <Box>
                <Text fw={600} size="sm" lh={1.3}>
                  Cover letter — {SAMPLE_COVER_LETTER_RESULT.jobTitle} at{' '}
                  {SAMPLE_COVER_LETTER_RESULT.companyName}
                </Text>
                <Text size="xs" c="dimmed" lh={1.4}>
                  Written in the same run as the tailored resume
                </Text>
              </Box>
            </Group>
            <Badge variant="gradient" gradient={{ ...proAccent.gradient, deg: 45 }}>
              Pro
            </Badge>
          </Group>
          <Box
            p="md"
            style={{
              borderRadius: 8,
              border: '1px solid var(--mantine-color-default-border)',
              backgroundColor: 'var(--mantine-color-default-hover)',
            }}
          >
            <Text size="sm" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {prependCoverLetterDate(SAMPLE_COVER_LETTER_RESULT.letter)}
            </Text>
          </Box>
        </Stack>
      </Card>
      <Stack gap="sm" align="center">
        <Text size="xs" c="dimmed" ta="center" maw={480}>
          Ready to copy, or export as a polished .docx or .pdf — alongside your tailored resume.
        </Text>
        {onExampleClick && (
          <Button variant="light" leftSection={<IconEye size={16} />} onClick={handleExampleClick}>
            See the full example
          </Button>
        )}
      </Stack>
    </Stack>
  );
};

export default LandingCoverLetter;
