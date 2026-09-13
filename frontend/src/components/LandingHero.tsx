import { Box, Button, Grid, Group, Stack, Text, Title, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconCheck,
  IconEye,
  IconFileTypeDocx,
  IconGitCompare,
  IconMail,
  IconSparkles,
} from '@tabler/icons-react';
import HeroProductMock from './HeroProductMock';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import type { HeroCopy } from '../lib/heroVariants';
import { appTheme } from '../lib/theme';

type LandingHeroProps = {
  copy: HeroCopy;
  variant: string;
  onStartClick: () => void;
  onExampleClick: () => void;
};

type TrustPoint = {
  icon: typeof IconCheck;
  label: string;
};

const TRUST_POINTS: TrustPoint[] = [
  { icon: IconGitCompare, label: 'Word-level diffs' },
  { icon: IconMail, label: 'Matching cover letter' },
  { icon: IconFileTypeDocx, label: 'Keeps your Word formatting' },
];

const LandingHero = ({ copy, variant, onStartClick, onExampleClick }: LandingHeroProps) => {
  const theme = useMantineTheme();
  const isDesktop = useMediaQuery(`(min-width: ${theme.breakpoints.md})`, false, {
    getInitialValueInEffect: false,
  });

  const handleStartClick = () => {
    trackEvent(AnalyticsEvents.LandingCta, { placement: 'hero', variant });
    onStartClick();
  };

  const handleExampleClick = () => {
    trackEvent(AnalyticsEvents.LandingCta, { placement: 'hero_example', variant });
    onExampleClick();
  };

  return (
    <Grid gap={{ base: 'xl', md: 48 }} align="center" py={{ base: 'md', md: 'xl' }}>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Stack gap="xl" align={isDesktop ? 'flex-start' : 'center'}>
          <Stack gap="md" align={isDesktop ? 'flex-start' : 'center'}>
            <Text size="xs" fw={700} tt="uppercase" c="cyan.4" style={{ letterSpacing: '0.08em' }}>
              AI resume tailoring you can audit
            </Text>
            <Title
              order={1}
              ta={isDesktop ? 'left' : 'center'}
              fw={800}
              fz={{ base: '2rem', sm: '2.375rem', md: '2.75rem' }}
              style={{
                lineHeight: 1.12,
                letterSpacing: '-0.025em',
                textWrap: 'balance',
              }}
            >
              {copy.headlineLead}{' '}
              <Text span inherit variant="gradient" gradient={{ ...appTheme.gradient, deg: 45 }}>
                {copy.headlineEmphasis}
              </Text>
            </Title>
            <Text
              size="lg"
              c="dimmed"
              ta={isDesktop ? 'left' : 'center'}
              maw={520}
              lh={1.55}
              style={{ textWrap: 'pretty' }}
            >
              {copy.subhead}
            </Text>
          </Stack>

          <Stack gap="sm" w="100%" maw={isDesktop ? 440 : 420}>
            <Button
              size="lg"
              fullWidth
              className="tailor-button"
              leftSection={<IconSparkles size={18} />}
              styles={{ label: { whiteSpace: 'nowrap' } }}
              onClick={handleStartClick}
            >
              Tailor my resume for free
            </Button>
            <Group gap="xs" justify={isDesktop ? 'space-between' : 'center'} wrap="wrap">
              <Text size="xs" c="dimmed">
                One free run. No sign-up, no card required.
              </Text>
              <Button
                variant="subtle"
                color="gray"
                size="compact-sm"
                leftSection={<IconEye size={14} />}
                onClick={handleExampleClick}
              >
                See an example first
              </Button>
            </Group>
          </Stack>

          <Group gap="md" justify={isDesktop ? 'flex-start' : 'center'} wrap="wrap">
            {TRUST_POINTS.map((point) => {
              const PointIcon = point.icon;
              return (
                <Group key={point.label} gap={6} wrap="nowrap">
                  <PointIcon size={15} color="var(--mantine-color-teal-4)" stroke={2} />
                  <Text size="sm" c="gray.3" fw={500}>
                    {point.label}
                  </Text>
                </Group>
              );
            })}
          </Group>
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Box style={{ display: 'flex', justifyContent: 'center' }}>
          <HeroProductMock />
        </Box>
        <Text size="xs" c="dimmed" ta="center" mt="sm">
          Every rewrite is a diff. Revert anything with one click. Watch the coverage bar fill as
          you go.
        </Text>
      </Grid.Col>
    </Grid>
  );
};

export default LandingHero;
