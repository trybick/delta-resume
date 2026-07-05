import type { ComponentPropsWithoutRef } from 'react'
import {
  Badge,
  Box,
  Button,
  Group,
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
import { IconCoins } from '@tabler/icons-react'
import DeltaLogo from './DeltaLogo'
import { appTheme } from '../lib/theme'

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
}

const AppHeader = ({ creditsLabel, outOfCredits }: AppHeaderProps) => {
  return (
    <Box
      component="header"
      py="md"
      px="xl"
      bg="dark.7"
      style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}
    >
      <Group justify="space-between">
        <Group gap="sm">
          <DeltaLogo size={40} />
          <div>
            <Title order={3} style={{ letterSpacing: '-0.02em' }}>
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
            <Text size="xs" c="dimmed">
              Optimize your resume bullets for any job description
            </Text>
          </div>
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
