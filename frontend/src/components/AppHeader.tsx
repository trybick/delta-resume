import { Badge, Box, Button, Group, Skeleton, Stack, Text, Title, Tooltip } from '@mantine/core';
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
  creditsRemaining: number | null;
  creditsResetsAt: string | null;
  outOfCredits: boolean;
  lowCredits: boolean;
  isProPlan: boolean;
  planLoaded: boolean;
  isLoadingCredits: boolean;
  creditsError: boolean;
  showUpgradeCta: boolean;
  onUpgradeClick: () => void;
  onRetryCredits: () => void;
  onHomeClick: () => void;
};

const formatCreditsResetAt = (resetsAt: string): string =>
  new Date(resetsAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

const AppHeader = ({
  creditsLabel,
  creditsRemaining,
  creditsResetsAt,
  outOfCredits,
  lowCredits,
  isProPlan,
  planLoaded,
  isLoadingCredits,
  creditsError,
  showUpgradeCta,
  onUpgradeClick,
  onRetryCredits,
  onHomeClick,
}: AppHeaderProps) => {
  const handleRetryCreditsClick = () => {
    trackEvent(AnalyticsEvents.RetryCredits, { source: 'header' });
    onRetryCredits();
  };

  const handleUpgradeClick = () => {
    trackEvent(AnalyticsEvents.UpgradeToProHeader);
    onUpgradeClick();
  };

  const handleHomeClick = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    trackEvent(AnalyticsEvents.HeaderLogoHome);
    onHomeClick();
  };

  const mobileUpgradeLabel =
    creditsRemaining === null ? 'Get Pro' : `${creditsRemaining} left · Get Pro`;

  const proCreditsLabel =
    creditsRemaining === null
      ? 'Pro'
      : `Pro · ${creditsRemaining} ${creditsRemaining === 1 ? 'credit' : 'credits'}`;

  const proCreditsTooltip =
    creditsResetsAt === null
      ? 'One tailor uses one credit.'
      : `One tailor uses one credit. Resets ${formatCreditsResetAt(creditsResetsAt)}.`;

  const proCreditsBadge = (
    <Tooltip label={proCreditsTooltip}>
      <Badge
        size="lg"
        variant="gradient"
        gradient={{ ...proAccent.gradient, deg: 45 }}
        leftSection={<IconCrown size={14} />}
      >
        {proCreditsLabel}
      </Badge>
    </Tooltip>
  );

  return (
    <Box
      component="header"
      py="sm"
      px={{ base: 'sm', sm: 'xl' }}
      style={{
        borderBottom: '1px solid var(--mantine-color-dark-4)',
        backgroundColor: 'color-mix(in srgb, var(--mantine-color-dark-7) 82%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <a
          href="/"
          aria-label="Delta Resume home"
          onClick={handleHomeClick}
          style={{ minWidth: 0, textDecoration: 'none', color: 'inherit' }}
        >
          <Group gap="sm" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
            <Box visibleFrom="sm" lh={0}>
              <DeltaLogo size={38} />
            </Box>
            <Box hiddenFrom="sm" lh={0}>
              <DeltaLogo size={30} />
            </Box>
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Title
                order={1}
                fz={{ base: 'clamp(0.95rem, 4.8vw, 1.125rem)', sm: 'h3' }}
                lh={1.2}
                style={{
                  fontFamily: spaceGroteskStack,
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <Text span inherit variant="gradient" gradient={{ ...appTheme.gradient, deg: 45 }}>
                  Delta
                </Text>{' '}
                <Text span inherit fw={400} c="gray.3">
                  Resume
                </Text>
              </Title>
              <Text size="xs" c="dimmed" lh={1.4} visibleFrom="sm">
                Tailor your resume to any job description in seconds
              </Text>
            </Stack>
          </Group>
        </a>
        <Group gap="xs" justify="flex-end" align="center" visibleFrom="sm">
          {planLoaded && isProPlan && proCreditsBadge}
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
          {!creditsLabel && !isProPlan && isLoadingCredits && (
            <Skeleton width={110} height={26} radius="xl" />
          )}
          {!creditsLabel && !isProPlan && creditsError && !isLoadingCredits && (
            <Badge
              size="lg"
              variant="light"
              color="red"
              style={{ cursor: 'pointer' }}
              onClick={handleRetryCreditsClick}
            >
              Credits unavailable · Retry
            </Badge>
          )}
          {planLoaded && !isProPlan && showUpgradeCta && (
            <UpgradeHoverCard onUpgradeClick={onUpgradeClick} />
          )}
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
            <Box
              component="span"
              display="inline-flex"
              style={{ alignItems: 'center', lineHeight: 0 }}
              onClick={() => trackEvent(AnalyticsEvents.UserButtonOpen)}
            >
              <UserButton />
            </Box>
          </SignedIn>
        </Group>
        <Group gap="xs" justify="flex-end" wrap="nowrap" align="center" hiddenFrom="sm">
          {!planLoaded && isLoadingCredits && <Skeleton width={110} height={30} radius="xl" />}
          {!creditsLabel && !isProPlan && creditsError && !isLoadingCredits && (
            <Badge
              size="lg"
              variant="light"
              color="red"
              style={{ cursor: 'pointer' }}
              onClick={handleRetryCreditsClick}
            >
              Retry credits
            </Badge>
          )}
          {planLoaded && isProPlan && proCreditsBadge}
          {planLoaded && !isProPlan && showUpgradeCta && (
            <Button
              size="xs"
              variant="gradient"
              gradient={{ ...proAccent.gradient, deg: 45 }}
              styles={{ label: { whiteSpace: 'nowrap' } }}
              onClick={handleUpgradeClick}
            >
              {mobileUpgradeLabel}
            </Button>
          )}
          {planLoaded && !isProPlan && !showUpgradeCta && creditsLabel && (
            <Tooltip label={`${creditsLabel} remaining. One credit is used when tailoring starts.`}>
              <Badge
                size="lg"
                variant="light"
                color={outOfCredits ? 'red' : lowCredits ? 'orange' : undefined}
                leftSection={<IconCoins size={14} />}
                styles={{ label: { whiteSpace: 'nowrap' } }}
              >
                {creditsLabel}
              </Badge>
            </Tooltip>
          )}
          <SignedOut>
            <SignInButton mode="modal">
              <ClerkAuthButton
                size="xs"
                variant="light"
                px={8}
                aria-label="Sign in"
                style={{ border: '1px solid rgba(34, 184, 207, 0.35)' }}
                onClick={() => trackEvent(AnalyticsEvents.SignIn)}
              >
                <IconLogin2 size={16} />
              </ClerkAuthButton>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Box
              component="span"
              display="inline-flex"
              style={{ alignItems: 'center', lineHeight: 0 }}
              onClick={() => trackEvent(AnalyticsEvents.UserButtonOpen)}
            >
              <UserButton />
            </Box>
          </SignedIn>
        </Group>
      </Group>
    </Box>
  );
};

export default AppHeader;
