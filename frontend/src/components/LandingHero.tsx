import { Badge, Button, Grid, Group, Stack, Text, Title } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
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
              Tailor your resume to any job in seconds
            </Title>
            <Text size="md" c="dimmed" ta="center" maw={520} lh={1.5}>
              Delta Resume rewrites your bullets to match the keywords each job post is screened for
              &mdash; and shows every change as an inline diff, so you keep only what sounds like
              you.
            </Text>
          </Stack>
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
          <Button variant="subtle" color="gray" size="sm" onClick={handleExampleClick}>
            See an example result first
          </Button>
          <Group gap={6} justify="center" wrap="nowrap">
            <Badge size="sm" variant="light" color={proAccent.badgeColor}>
              Pro
            </Badge>
            <Text size="xs" c="dimmed" ta="center">
              Tailoring your resume is free. Pro adds a matching cover letter in the same run.
            </Text>
          </Group>
        </Stack>
      </Grid.Col>
      <Grid.Col span={6} visibleFrom="md">
        <Stack gap={6} align="center">
          <DiffMockExample />
          <Text size="xs" c="dimmed" ta="center">
            Every rewrite is shown as an inline diff. Keep it or revert it with one click.
          </Text>
        </Stack>
      </Grid.Col>
    </Grid>
  );
};

export default LandingHero;
