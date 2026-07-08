import type { ComponentPropsWithoutRef } from 'react'
import {
  Badge,
  Box,
  Button,
  Divider,
  Group,
  HoverCard,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
  type ButtonProps,
} from '@mantine/core'
import {
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
  useClerk,
} from '@clerk/clerk-react'
import { IconCoins, IconLogout, IconSettings, IconSparkles } from '@tabler/icons-react'
import DeltaLogo from './DeltaLogo'
import { ProFeatureList } from './ProPlanShowcase'
import { AnalyticsEvents, trackEvent } from '../lib/analytics'
import { useProPlan } from '../lib/proPlan'
import { appTheme, spaceGroteskStack } from '../lib/theme'

type ClerkAuthButtonProps = ButtonProps &
  ComponentPropsWithoutRef<'button'> & {
    component?: string
    clerk?: unknown
  }

const ClerkAuthButton = ({ component: _component, clerk: _clerk, ...props }: ClerkAuthButtonProps) => (
  <Button {...props} />
)

type UpgradeHoverCardProps = {
  onUpgradeClick: () => void
}

const UpgradeHoverCard = ({ onUpgradeClick }: UpgradeHoverCardProps) => {
  const { annualMonthlyPrice, monthlyPrice } = useProPlan()
  const displayedPrice = annualMonthlyPrice ?? monthlyPrice

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
          gradient={{ ...appTheme.upgradeGradient, deg: 45 }}
          leftSection={<IconSparkles size={14} />}
          onClick={() => {
            trackEvent(AnalyticsEvents.UpgradeToProHeader)
            onUpgradeClick()
          }}
        >
          Upgrade to Pro
        </Button>
      </HoverCard.Target>
      <HoverCard.Dropdown
        style={{
          border: '1px solid var(--mantine-color-dark-4)',
          backgroundColor: 'var(--mantine-color-dark-7)',
          backgroundImage:
            'linear-gradient(160deg, rgba(34, 184, 207, 0.12) 0%, transparent 55%)',
        }}
      >
        <Stack gap="sm">
          <Group justify="space-between" align="baseline">
            <Text
              fw={700}
              size="md"
              variant="gradient"
              gradient={{ ...appTheme.gradient, deg: 45 }}
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
            ) : (
              <Skeleton width={56} height={18} />
            )}
          </Group>
          <Divider color="dark.4" />
          <ProFeatureList />
          <Button
            size="xs"
            fullWidth
            variant="gradient"
            gradient={{ ...appTheme.upgradeGradient, deg: 45 }}
            onClick={() => {
              trackEvent(AnalyticsEvents.SeePlanDetails)
              onUpgradeClick()
            }}
          >
            See plan details
          </Button>
        </Stack>
      </HoverCard.Dropdown>
    </HoverCard>
  )
}

const TrackedUserButton = () => {
  const clerk = useClerk()

  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Action
          label="Manage account"
          labelIcon={<IconSettings size={16} />}
          onClick={() => {
            trackEvent(AnalyticsEvents.UserButtonOpen, { action: 'manage_account' })
            clerk.openUserProfile()
          }}
        />
        <UserButton.Action
          label="Sign out"
          labelIcon={<IconLogout size={16} />}
          onClick={() => {
            trackEvent(AnalyticsEvents.UserButtonOpen, { action: 'sign_out' })
            void clerk.signOut()
          }}
        />
      </UserButton.MenuItems>
    </UserButton>
  )
}

type AppHeaderProps = {
  creditsLabel: string | null
  outOfCredits: boolean
  isProPlan: boolean
  planLoaded: boolean
  onUpgradeClick: () => void
}

const AppHeader = ({
  creditsLabel,
  outOfCredits,
  isProPlan,
  planLoaded,
  onUpgradeClick,
}: AppHeaderProps) => {
  return (
    <Box
      component="header"
      py="sm"
      px="xl"
      bg="dark.7"
      style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}
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
              <Text
                span
                inherit
                variant="gradient"
                gradient={{ ...appTheme.gradient, deg: 45 }}
              >
                Delta
              </Text>{' '}
              <Text span inherit fw={400} c="gray.3">
                Resume
              </Text>
            </Title>
            <Text size="xs" c="dimmed" lh={1.4}>
              Optimize your resume for any job description
            </Text>
          </Stack>
        </Group>
        <Group gap="sm">
          {creditsLabel && (
            <Tooltip label="One credit is used per tailor run">
              <Badge
                size="lg"
                variant="light"
                color={outOfCredits ? 'red' : undefined}
                leftSection={<IconCoins size={14} />}
              >
                {creditsLabel}
              </Badge>
            </Tooltip>
          )}
          {planLoaded && !isProPlan && (
            <UpgradeHoverCard onUpgradeClick={onUpgradeClick} />
          )}
          <SignedOut>
            <SignInButton mode="modal">
              <ClerkAuthButton
                variant="outline"
                onClick={() => trackEvent(AnalyticsEvents.SignIn)}
              >
                Sign in
              </ClerkAuthButton>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <TrackedUserButton />
          </SignedIn>
        </Group>
      </Group>
    </Box>
  )
}

export default AppHeader
