import { useEffect } from 'react'
import { Center, Modal, Stack, Text, Title } from '@mantine/core'
import { PricingTable, SignUp, useAuth, useUser } from '@clerk/clerk-react'

type PaywallModalProps = {
  opened: boolean
  onClose: () => void
  onSubscriptionChange: () => void
}

const PaywallModal = ({ opened, onClose, onSubscriptionChange }: PaywallModalProps) => {
  const { isSignedIn } = useUser()
  const { has } = useAuth()

  const hasProPlan = has?.({ plan: 'pro' }) ?? false

  useEffect(() => {
    if (!opened) return
    onSubscriptionChange()
  }, [opened, isSignedIn, hasProPlan, onSubscriptionChange])

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      centered
      withCloseButton
      title={
        <Text fw={600}>{isSignedIn ? 'Upgrade to keep tailoring' : 'Continue for free'}</Text>
      }
    >
      {isSignedIn ? (
        <Stack gap="md">
          <div>
            <Title order={4}>You&apos;re out of credits</Title>
            <Text size="sm" c="dimmed">
              Subscribe to Pro and get 100 tailor credits every month. Cancel anytime.
            </Text>
          </div>
          <PricingTable />
        </Stack>
      ) : (
        <Stack gap="md" align="center">
          <Stack gap={4} align="center">
            <Title order={4}>You&apos;ve used your 3 free tailors</Title>
            <Text size="sm" c="dimmed" ta="center">
              Create a free account to continue. Signing in with Google takes seconds.
            </Text>
          </Stack>
          <Center>
            <SignUp routing="hash" />
          </Center>
        </Stack>
      )}
    </Modal>
  )
}

export default PaywallModal
