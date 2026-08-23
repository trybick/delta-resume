import {
  Button,
  Divider,
  Group,
  HoverCard,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import ProFeatureList from './ProFeatureList';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { proAccent } from '../lib/proAccent';
import { useProPlan } from '../hooks/useProPlan';

type UpgradeHoverCardProps = {
  onUpgradeClick: () => void;
};

const UpgradeHoverCard = ({ onUpgradeClick }: UpgradeHoverCardProps) => {
  const { annualMonthlyPrice, monthlyPrice, isLoading: isLoadingProPrice } = useProPlan();
  const displayedPrice = annualMonthlyPrice ?? monthlyPrice;

  return (
    <HoverCard
      width={300}
      position="bottom-end"
      shadow="lg"
      radius="lg"
      openDelay={120}
      closeDelay={150}
      withArrow
    >
      <HoverCard.Target>
        <Button
          size="xs"
          variant="gradient"
          gradient={{ ...proAccent.gradient, deg: 45 }}
          leftSection={<IconSparkles size={14} />}
          onClick={() => {
            trackEvent(AnalyticsEvents.UpgradeToProHeader);
            onUpgradeClick();
          }}
        >
          Upgrade to Pro
        </Button>
      </HoverCard.Target>
      <HoverCard.Dropdown
        style={{
          border: '1px solid var(--mantine-color-dark-4)',
          backgroundColor: 'var(--mantine-color-dark-7)',
          backgroundImage: 'linear-gradient(160deg, rgba(34, 184, 207, 0.12) 0%, transparent 55%)',
        }}
      >
        <Stack gap="sm">
          <Group justify="space-between" align="baseline">
            <Text
              fw={700}
              size="md"
              variant="gradient"
              gradient={{ ...proAccent.gradient, deg: 45 }}
            >
              Delta Resume Pro
            </Text>
            {displayedPrice ? (
              <Group gap={4} align="baseline">
                <Text fw={700} size="md">
                  {displayedPrice}
                </Text>
                <Text size="xs" c="dimmed">
                  / month
                </Text>
              </Group>
            ) : isLoadingProPrice ? (
              <Skeleton width={56} height={18} />
            ) : null}
          </Group>
          <Text size="xs" c="dimmed" lh={1.4}>
            One run, full application — tailored resume, cover letter, and gap detection.
          </Text>
          <Divider color="dark.4" />
          <ProFeatureList />
          <Button
            size="xs"
            fullWidth
            variant="gradient"
            gradient={{ ...proAccent.gradient, deg: 45 }}
            onClick={() => {
              trackEvent(AnalyticsEvents.SeePlanDetails);
              onUpgradeClick();
            }}
          >
            See plan details
          </Button>
        </Stack>
      </HoverCard.Dropdown>
    </HoverCard>
  );
};

export default UpgradeHoverCard;
