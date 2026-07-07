import type { ComponentPropsWithoutRef } from 'react'
import {
  Badge,
  Box,
  Button,
  Group,
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
} from '@clerk/clerk-react'
import { IconCoins, IconSparkles } from '@tabler/icons-react'
import DeltaLogo from './DeltaLogo'
import { appTheme, spaceGroteskStack } from '../lib/theme'

type ClerkAuthButtonProps = ButtonProps &
  ComponentPropsWithoutRef<'button'> & {
    component?: string
    clerk?: unknown
  }

const ClerkAuthButton = ({ component: _component, clerk: _clerk, ...props }: ClerkAuthButtonProps) => (
  <Button {...props} />
)

type AppHeaderProps = {
  creditsLabel: string | null
  outOfCredits: boolean
  isProPlan: boolean
  onUpgradeClick: () => void
}

const AppHeader = ({ creditsLabel, outOfCredits, isProPlan, onUpgradeClick }: AppHeaderProps) => {
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
              Optimize your resume bullets for any job description
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
          {!isProPlan && (
            <Tooltip label="Pro: 200 tailor credits every month, 10 saved resumes, match scoring, and DOCX export">
              <Button
                size="xs"
                variant="gradient"
                gradient={{ ...appTheme.gradient, deg: 45 }}
                leftSection={<IconSparkles size={14} />}
                onClick={onUpgradeClick}
              >
                Upgrade to Pro
              </Button>
            </Tooltip>
          )}
          <SignedOut>
            <SignInButton mode="modal">
              <ClerkAuthButton variant="outline">
                Sign in
              </ClerkAuthButton>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </Group>
      </Group>
    </Box>
  )
}

export default AppHeader
