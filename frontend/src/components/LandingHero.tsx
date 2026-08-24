import {
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconEye, IconFileText, IconMail, IconSparkles } from '@tabler/icons-react';
import CoverLetterMockExample from './CoverLetterMockExample';
import DiffMockExample from './DiffMockExample';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { proAccent } from '../lib/proAccent';
import { appTheme } from '../lib/theme';

type LandingHeroProps = {
  freeCreditsRemaining: number | null;
  onStartClick: () => void;
  onExampleClick: () => void;
};

const LandingHero = ({ freeCreditsRemaining, onStartClick, onExampleClick }: LandingHeroProps) => {
  const theme = useMantineTheme();
  const isDesktopHeading = useMediaQuery(`(min-width: ${theme.breakpoints.md})`, false, {
    getInitialValueInEffect: false,
  });

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
              fw={800}
              maw={{ base: '100%', md: 520 }}
              fz={{ base: '1.75rem', md: '2.375rem' }}
              style={{
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                textWrap: isDesktopHeading ? 'balance' : 'wrap',
              }}
            >
              Tailor your{' '}
              <Text span inherit variant="gradient" gradient={{ ...appTheme.gradient, deg: 45 }}>
                resume
              </Text>{' '}
              and{' '}
              <Text
                span
                inherit
                variant="gradient"
                gradient={{ ...appTheme.gradient, deg: 45 }}
                style={{ whiteSpace: 'nowrap' }}
              >
                cover letter
              </Text>{' '}
              to any job in seconds
            </Title>
            <Text
              size="md"
              c="dimmed"
              ta="center"
              maw={480}
              lh={1.5}
              style={{ textWrap: 'balance' }}
            >
              Paste a job post. Your bullets are rewritten to hit the skills and keywords it asks
              for.
            </Text>
          </Stack>
          <Group gap="md" justify="center" visibleFrom="sm">
            <Group gap={6} wrap="nowrap">
              <ThemeIcon size={22} radius="xl" variant="light" color="teal">
                <IconFileText size={13} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                Tailored resume
              </Text>
            </Group>
            <Group gap={6} wrap="nowrap">
              <ThemeIcon size={22} radius="xl" variant="light" color="teal">
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
          <Button
            size="lg"
            fullWidth
            maw={420}
            leftSection={<IconSparkles size={18} />}
            styles={{ label: { whiteSpace: 'nowrap' } }}
            onClick={handleStartClick}
          >
            Tailor my resume for free
            {freeCreditsRemaining !== null && (
              <Box component="span" visibleFrom="sm">
                {` · ${freeCreditsRemaining} ${freeCreditsRemaining === 1 ? 'credit' : 'credits'}`}
              </Box>
            )}
          </Button>
          <Text size="xs" c="dimmed" ta="center">
            No sign-up, no card. Your resume is never used to train AI.
          </Text>
          <Button
            variant="default"
            size="md"
            leftSection={<IconEye size={16} />}
            onClick={handleExampleClick}
          >
            See an example result first
          </Button>
        </Stack>
      </Grid.Col>
      <Grid.Col span={6} visibleFrom="md">
        <Stack gap="xl" align="center">
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
