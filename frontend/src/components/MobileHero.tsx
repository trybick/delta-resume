import { Badge, Button, Stack, Text, Title } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { appTheme, spaceGroteskStack } from '../lib/theme';

type MobileHeroProps = {
  freeTrialLabel: string | null;
  onStartClick: () => void;
};

const MobileHero = ({ freeTrialLabel, onStartClick }: MobileHeroProps) => {
  const handleStartClick = () => {
    trackEvent(AnalyticsEvents.MobileLandingCta, { placement: 'hero' });
    onStartClick();
  };

  return (
    <Stack gap="lg" align="center" py="md">
      <Stack gap="sm" align="center">
        <Title
          order={1}
          ta="center"
          style={{ fontFamily: spaceGroteskStack, fontSize: '1.75rem', lineHeight: 1.2 }}
        >
          Tailor your resume to any job in under a minute
        </Title>
        <Text size="md" c="dimmed" ta="center" maw={420} lh={1.5}>
          Claude rewrites your bullets to match the role. You review every change as an inline
          diff — keep or revert with one tap.
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
        variant="gradient"
        gradient={{ ...appTheme.gradient, deg: 45 }}
        leftSection={<IconSparkles size={18} />}
        onClick={handleStartClick}
      >
        Tailor my resume — free
      </Button>
    </Stack>
  );
};

export default MobileHero;
