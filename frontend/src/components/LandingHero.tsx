import { Box, Button, Grid, Group, Stack, Text, Title, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconEye } from '@tabler/icons-react';
import HeroProductMock from './HeroProductMock';
import LandingCtaButton from './LandingCtaButton';
import LandingTrustRow from './LandingTrustRow';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { appTheme } from '../lib/theme';

type LandingHeroProps = {
  onStartClick: () => void;
  onExampleClick: () => void;
};

const LandingHero = ({ onStartClick, onExampleClick }: LandingHeroProps) => {
  const theme = useMantineTheme();
  const isDesktop = useMediaQuery(`(min-width: ${theme.breakpoints.md})`, false, {
    getInitialValueInEffect: false,
  });

  const handleExampleClick = () => {
    trackEvent(AnalyticsEvents.LandingCta, { placement: 'hero_example' });
    onExampleClick();
  };

  return (
    <Grid gap={{ base: 'xl', md: 48 }} align="center" py={{ base: 'md', md: 'xl' }}>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Stack gap="lg" w="100%" align={isDesktop ? 'flex-start' : 'center'}>
          <Stack gap="md" align={isDesktop ? 'flex-start' : 'center'}>
            <Text
              size="xs"
              fw={700}
              tt="uppercase"
              c="cyan.4"
              ta={isDesktop ? 'left' : 'center'}
              style={{ letterSpacing: '0.08em' }}
            >
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
              See every change the AI makes to your resume.{' '}
              <Text span inherit variant="gradient" gradient={{ ...appTheme.gradient, deg: 45 }}>
                Approve each one.
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
              Paste a job post. Get word-level rewrites, a matching cover letter, and your resume
              back in your original Word formatting.
            </Text>
          </Stack>

          <Stack
            gap="sm"
            w="100%"
            maw={isDesktop ? 540 : 420}
            align={isDesktop ? 'flex-start' : 'center'}
          >
            <Group
              gap="sm"
              wrap="wrap"
              align="flex-start"
              justify={isDesktop ? 'flex-start' : 'center'}
              w="100%"
            >
              <Stack gap="sm" align="center" style={{ flex: '1 1 auto' }}>
                <LandingCtaButton placement="hero" onStartClick={onStartClick} fullWidth />
                <LandingTrustRow />
              </Stack>
              <Button
                size="lg"
                variant="default"
                leftSection={<IconEye size={18} />}
                styles={{ label: { whiteSpace: 'nowrap' } }}
                style={{ flex: '1 1 auto' }}
                onClick={handleExampleClick}
              >
                See an example
              </Button>
            </Group>
          </Stack>
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
