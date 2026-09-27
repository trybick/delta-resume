import { Stack } from '@mantine/core';
import LandingCtaButton from './LandingCtaButton';
import LandingTrustRow from './LandingTrustRow';

type LandingCtaBlockProps = {
  placement: string;
  onStartClick: () => void;
};

const LandingCtaBlock = ({ placement, onStartClick }: LandingCtaBlockProps) => (
  <Stack gap="sm" align="center" w="100%">
    <LandingCtaButton placement={placement} onStartClick={onStartClick} fullWidth maw={420} />
    <LandingTrustRow />
  </Stack>
);

export default LandingCtaBlock;
