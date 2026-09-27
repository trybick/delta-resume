import { Button, type ButtonProps } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';

type LandingCtaButtonProps = Omit<ButtonProps, 'children'> & {
  placement: string;
  onStartClick: () => void;
};

const LandingCtaButton = ({ placement, onStartClick, ...buttonProps }: LandingCtaButtonProps) => {
  const handleClick = () => {
    trackEvent(AnalyticsEvents.LandingCta, { placement });
    onStartClick();
  };

  return (
    <Button
      size="lg"
      className="tailor-button"
      leftSection={<IconSparkles size={18} />}
      styles={{ label: { whiteSpace: 'nowrap' } }}
      {...buttonProps}
      onClick={handleClick}
    >
      Tailor my resume for free
    </Button>
  );
};

export default LandingCtaButton;
