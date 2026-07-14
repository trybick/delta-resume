import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  type SimpleGridProps,
} from '@mantine/core';
import { SignedIn, useUser } from '@clerk/clerk-react';
import { CheckoutButton } from '@clerk/clerk-react/experimental';
import { IconSparkles } from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { PRO_FEATURES, useProPlan, type ProFeature } from '../lib/proPlan';
import { appTheme } from '../lib/theme';

type BillingPeriod = 'month' | 'annual';

type FeatureRowProps = {
  feature: ProFeature;
  compact: boolean;
};

const FeatureRow = ({ feature, compact }: FeatureRowProps) => {
  const Icon = feature.icon;

  return (
    <Group gap="sm" wrap="nowrap" align={compact ? 'center' : 'flex-start'}>
      <ThemeIcon size={compact ? 28 : 36} radius="md" variant="light" color="cyan">
        <Icon size={compact ? 15 : 19} />
      </ThemeIcon>
      <Box>
        <Text size={compact ? 'xs' : 'sm'} fw={600} lh={1.3}>
          {feature.title}
        </Text>
        {!compact && (
          <Text size="xs" c="dimmed" lh={1.4}>
            {feature.description}
          </Text>
        )}
      </Box>
    </Group>
  );
};

type ProPlanShowcaseProps = {
  onCheckoutOpen: () => void;
  onSubscriptionComplete: () => void;
};

const ProPlanShowcase = ({ onCheckoutOpen, onSubscriptionComplete }: ProPlanShowcaseProps) => {
  const { isSignedIn } = useUser();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('annual');
  const { monthlyPrice, annualMonthlyPrice, planId } = useProPlan();

  const displayedPrice = billingPeriod === 'annual' ? annualMonthlyPrice : monthlyPrice;

  const subscribeButton = (
    <Button
      size="md"
      fullWidth
      variant="gradient"
      gradient={{ ...appTheme.upgradeGradient, deg: 45 }}
      leftSection={<IconSparkles size={18} />}
    >
      Subscribe to Pro
    </Button>
  );

  return (
    <Paper
      p="lg"
      radius="lg"
      style={{
        border: '1px solid var(--mantine-color-cyan-9)',
        background:
          'linear-gradient(160deg, rgba(34, 184, 207, 0.08) 0%, rgba(34, 139, 230, 0.04) 60%, transparent 100%)',
      }}
    >
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="xs">
              <Text
                fw={700}
                size="xl"
                variant="gradient"
                gradient={{ ...appTheme.gradient, deg: 45 }}
              >
                Pro
              </Text>
              <Badge
                size="sm"
                variant="light"
                color="cyan"
                style={{ visibility: billingPeriod === 'annual' ? 'visible' : 'hidden' }}
              >
                Most popular
              </Badge>
            </Group>
            <Group gap={6} align="baseline">
              {displayedPrice ? (
                <Text fw={700} size="1.75rem" lh={1}>
                  {displayedPrice}
                </Text>
              ) : (
                <Skeleton width={64} height={28} />
              )}
              <Text size="sm" c="dimmed">
                / month
              </Text>
            </Group>
            <Text
              size="xs"
              c="cyan.4"
              style={{
                visibility: billingPeriod === 'annual' && annualMonthlyPrice ? 'visible' : 'hidden',
              }}
            >
              Billed annually
            </Text>
          </Stack>
          <SegmentedControl
            size="xs"
            value={billingPeriod}
            onChange={(value) => {
              const period = value as BillingPeriod;
              trackEvent(AnalyticsEvents.BillingPeriodChange, { period });
              setBillingPeriod(period);
            }}
            data={[
              { label: 'Monthly', value: 'month' },
              { label: 'Annual', value: 'annual' },
            ]}
          />
        </Group>

        <Stack gap="sm">
          {PRO_FEATURES.map((feature) => (
            <FeatureRow key={feature.title} feature={feature} compact={false} />
          ))}
        </Stack>

        {isSignedIn && planId ? (
          <SignedIn>
            <CheckoutButton
              planId={planId}
              planPeriod={billingPeriod}
              for="user"
              onSubscriptionComplete={onSubscriptionComplete}
            >
              <Button
                size="md"
                fullWidth
                variant="gradient"
                gradient={{ ...appTheme.upgradeGradient, deg: 45 }}
                leftSection={<IconSparkles size={18} />}
                onClick={() => {
                  trackEvent(AnalyticsEvents.SubscribeToPro, { period: billingPeriod });
                  onCheckoutOpen();
                }}
              >
                Subscribe to Pro
              </Button>
            </CheckoutButton>
          </SignedIn>
        ) : (
          <Skeleton visible={!planId}>{subscribeButton}</Skeleton>
        )}

        <Text size="xs" c="dimmed" ta="center">
          Cancel anytime. Your credits renew every month.
        </Text>
      </Stack>
    </Paper>
  );
};

type ProFeatureListProps = {
  columns?: SimpleGridProps['cols'];
};

export const ProFeatureList = ({ columns = 1 }: ProFeatureListProps) => (
  <SimpleGrid cols={columns} spacing="md" verticalSpacing="xs">
    {PRO_FEATURES.map((feature) => (
      <FeatureRow key={feature.title} feature={feature} compact />
    ))}
  </SimpleGrid>
);

export default ProPlanShowcase;
