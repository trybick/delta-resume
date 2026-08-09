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
          Tailor your resume to any job in seconds
        </Title>
        <Text size="md" c="dimmed" ta="center" maw={420} lh={1.5}>
          AI rewrites your bullets to match the role. You review every change as an inline diff
          and keep or revert each one with a tap.
        </Text>
        <Text size="sm" c="dimmed" ta="center" maw={420} lh={1.5}>
          Need a cover letter? Pro writes one to match your tailored resume in the same run.
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
        Tailor my resume for free
      </Button>
    </Stack>
  );
};

export default MobileHero;
