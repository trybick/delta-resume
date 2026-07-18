import {
  Badge,
  Box,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { IconCoins, IconCrown, IconLogin2 } from '@tabler/icons-react';
import ClerkAuthButton from './ClerkAuthButton';
import DeltaLogo from './DeltaLogo';
import UpgradeHoverCard from './UpgradeHoverCard';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { proAccent } from '../lib/proAccent';
import { appTheme, spaceGroteskStack } from '../lib/theme';

type AppHeaderProps = {
  creditsLabel: string | null;
  outOfCredits: boolean;
  lowCredits: boolean;
  isProPlan: boolean;
  planLoaded: boolean;
  isLoadingCredits: boolean;
  creditsError: boolean;
  onUpgradeClick: () => void;
  onRetryCredits: () => void;
};

const AppHeader = ({
  creditsLabel,
  outOfCredits,
  lowCredits,
  isProPlan,
  planLoaded,
  isLoadingCredits,
  creditsError,
  onUpgradeClick,
  onRetryCredits,
}: AppHeaderProps) => {
  return (
    <Box
      component="header"
      py="sm"
      px="xl"
      style={{
        borderBottom: '1px solid var(--mantine-color-dark-4)',
        backgroundColor: 'color-mix(in srgb, var(--mantine-color-dark-7) 82%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <Group justify="space-between">
        <Group gap="md" align="center">
          <DeltaLogo size={38} />
          <Stack gap={2}>
            <Title
              order={3}
              lh={1.2}
              style={{ fontFamily: spaceGroteskStack, letterSpacing: '-0.02em' }}
            >
              <Text span inherit variant="gradient" gradient={{ ...appTheme.gradient, deg: 45 }}>
                Delta
              </Text>{' '}
              <Text span inherit fw={400} c="gray.3">
                Resume
              </Text>
            </Title>
            <Text size="xs" c="dimmed" lh={1.4}>
              Tailor your resume to any job in seconds
            </Text>
          </Stack>
        </Group>
        <Group gap="sm">
          {planLoaded && isProPlan && (
            <Badge
              size="lg"
              variant="gradient"
              gradient={{ ...proAccent.gradient, deg: 45 }}
              leftSection={<IconCrown size={14} />}
            >
              Pro
            </Badge>
          )}
          {creditsLabel && (
            <Tooltip label={`${creditsLabel} remaining. One credit is used when tailoring starts.`}>
              <Badge
                size="lg"
                variant="light"
                color={outOfCredits ? 'red' : lowCredits ? 'orange' : undefined}
                leftSection={<IconCoins size={14} />}
              >
                {creditsLabel}
              </Badge>
            </Tooltip>
          )}
          {!creditsLabel && isLoadingCredits && <Skeleton width={110} height={26} radius="xl" />}
          {!creditsLabel && creditsError && !isLoadingCredits && (
            <Badge
              size="lg"
              variant="light"
              color="red"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                trackEvent(AnalyticsEvents.RetryCredits, { source: 'header' });
                onRetryCredits();
              }}
            >
              Credits unavailable · Retry
            </Badge>
          )}
          {planLoaded && !isProPlan && <UpgradeHoverCard onUpgradeClick={onUpgradeClick} />}
          <SignedOut>
            <SignInButton mode="modal">
              <ClerkAuthButton
                size="xs"
                variant="light"
                leftSection={<IconLogin2 size={14} />}
                style={{ border: '1px solid rgba(34, 184, 207, 0.35)' }}
                onClick={() => trackEvent(AnalyticsEvents.SignIn)}
              >
                Sign in
              </ClerkAuthButton>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <span onClick={() => trackEvent(AnalyticsEvents.UserButtonOpen)}>
              <UserButton />
            </span>
          </SignedIn>
        </Group>
      </Group>
    </Box>
  );
};

export default AppHeader;
