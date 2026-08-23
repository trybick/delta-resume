import { Badge, Button, Grid, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconFileText, IconMail, IconSparkles } from '@tabler/icons-react';
import CoverLetterMockExample from './CoverLetterMockExample';
import DiffMockExample from './DiffMockExample';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { proAccent } from '../lib/proAccent';
import { appTheme, spaceGroteskStack } from '../lib/theme';

type LandingHeroProps = {
  freeTrialLabel: string | null;
  onStartClick: () => void;
  onExampleClick: () => void;
};

const LandingHero = ({ freeTrialLabel, onStartClick, onExampleClick }: LandingHeroProps) => {
  const handleStartClick = () => {
    trackEvent(AnalyticsEvents.LandingCta, { placement: 'hero' });
    onStartClick();
  };

  const handleExampleClick = () => {
    trackEvent(AnalyticsEvents.LandingCta, { placement: 'hero_example' });
    onExampleClick();
  };

  return (
    <Grid gap="xl" align="center" py={{ base: 'md', md: 'xl' }}>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Stack gap="lg" align="center">
          <Stack gap="sm" align="center">
            <Title
              order={1}
              ta="center"
              fz={{ base: '1.75rem', md: '2.375rem' }}
              style={{ fontFamily: spaceGroteskStack, lineHeight: 1.2 }}
            >
              Tailor your resume and cover letter to any job in seconds
            </Title>
            <Text size="md" c="dimmed" ta="center" maw={480} lh={1.5}>
              Paste a job post. Your bullets are rewritten the way recruiters read them, and you
              approve every change as an inline diff.
            </Text>
          </Stack>
          <Group gap="md" justify="center">
            <Group gap={6} wrap="nowrap">
              <ThemeIcon size={22} radius="xl" variant="light" color="teal">
                <IconFileText size={13} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                Tailored resume
              </Text>
            </Group>
            <Group gap={6} wrap="nowrap">
              <ThemeIcon size={22} radius="xl" variant="light" color="orange">
                <IconMail size={13} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                Matching cover letter
              </Text>
              <Badge size="sm" variant="gradient" gradient={{ ...proAccent.gradient, deg: 45 }}>
                Pro
              </Badge>
            </Group>
          </Group>
          {freeTrialLabel && (
            <Badge size="lg" variant="light" color="teal">
              {freeTrialLabel}
            </Badge>
          )}
          <Button
            size="lg"
            fullWidth
            maw={420}
            variant="gradient"
            gradient={{ ...appTheme.gradient, deg: 45 }}
            leftSection={<IconSparkles size={18} />}
            onClick={handleStartClick}
          >
            Tailor my resume for free
          </Button>
          <Text size="xs" c="dimmed" ta="center">
            No card required. Your resume is never used to train AI.
          </Text>
          <Button variant="subtle" color="gray" size="sm" onClick={handleExampleClick}>
            See an example result first
          </Button>
        </Stack>
      </Grid.Col>
      <Grid.Col span={6} visibleFrom="md">
        <Stack gap="md" align="center">
          <Stack gap={6} align="center" w="100%">
            <DiffMockExample />
            <Text size="xs" c="dimmed" ta="center">
              Every rewrite is shown as an inline diff. Keep it or revert it with one click.
            </Text>
          </Stack>
          <CoverLetterMockExample />
        </Stack>
      </Grid.Col>
    </Grid>
  );
};

export default LandingHero;
