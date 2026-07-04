import { useEffect } from 'react'
import { Center, Modal, Stack, Text, Title } from '@mantine/core'
import { PricingTable, SignUp, useAuth, useUser } from '@clerk/clerk-react'

export type PaywallReason = 'credits' | 'savedLimit'

type PaywallModalProps = {
  opened: boolean
  reason: PaywallReason
  onClose: () => void
  onSubscriptionChange: () => void
}

const PaywallModal = ({ opened, reason, onClose, onSubscriptionChange }: PaywallModalProps) => {
  const { isSignedIn } = useUser()
  const { has } = useAuth()

  const hasProPlan = has?.({ plan: 'pro' }) ?? false

  useEffect(() => {
    if (!opened) return
    onSubscriptionChange()
    if (reason === 'savedLimit' && hasProPlan) {
      onClose()
    }
  }, [opened, isSignedIn, hasProPlan, reason, onSubscriptionChange, onClose])

  const signedInTitle =
    reason === 'savedLimit' ? 'Upgrade to save more resumes' : 'Upgrade to keep tailoring'
  const signedInHeading =
    reason === 'savedLimit' ? 'You\u2019ve reached your saved resume limit' : 'You\u2019re out of credits'
  const signedInDescription =
    reason === 'savedLimit'
      ? 'Subscribe to Pro to save up to 10 resumes, plus 100 tailor credits every month. Cancel anytime.'
      : 'Subscribe to Pro and get 100 tailor credits every month. Cancel anytime.'
  const signedOutHeading =
    reason === 'savedLimit' ? 'Save more resumes with Pro' : 'You\u2019ve used your 3 free tailors'
  const signedOutDescription =
    reason === 'savedLimit'
      ? 'Create a free account and upgrade to Pro to save up to 10 resumes.'
      : 'Create a free account to continue. Signing in with Google takes seconds.'

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      centered
      withCloseButton
      title={<Text fw={600}>{isSignedIn ? signedInTitle : 'Continue for free'}</Text>}
    >
      {isSignedIn ? (
        <Stack gap="md">
          <div>
            <Title order={4}>{signedInHeading}</Title>
            <Text size="sm" c="dimmed">
              {signedInDescription}
            </Text>
          </div>
          <PricingTable />
        </Stack>
      ) : (
        <Stack gap="md" align="center">
          <Stack gap={4} align="center">
            <Title order={4}>{signedOutHeading}</Title>
            <Text size="sm" c="dimmed" ta="center">
              {signedOutDescription}
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
