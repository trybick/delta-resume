import { Badge, Button, Grid, Stack, Text, Title } from '@mantine/core';
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
              Tailor your resume and cover letter{' '}
              <Badge
                component="span"
                size="lg"
                variant="gradient"
                gradient={{ ...proAccent.gradient, deg: 45 }}
                style={{ verticalAlign: 'middle' }}
              >
                Pro
              </Badge>{' '}
              to any job in seconds
            </Title>
            <Text size="md" c="dimmed" ta="center" maw={480} lh={1.5}>
              AI rewrites your bullets to match the role, then shows every change as an inline diff.
              Keep what sounds like you and revert the rest, one click at a time.
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
          <Text size="xs" c="dimmed" ta="center" maw={420}>
            Tailoring your resume is free. Pro adds a matching cover letter in the same run.
          </Text>
        </Stack>
      </Grid.Col>
      <Grid.Col span={6} visibleFrom="md">
        <Stack gap={6} align="center">
          <DiffMockExample />
          <Text size="xs" c="dimmed" ta="center">
            Every suggestion shows up as a diff like this — applied only if you keep it.
          </Text>
        </Stack>
      </Grid.Col>
    </Grid>
  );
};

export default LandingHero;
