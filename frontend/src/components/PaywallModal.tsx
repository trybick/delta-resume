import { useEffect } from 'react'
import { Modal, Stack, Text, Title } from '@mantine/core'
import { PricingTable, SignUp, useAuth, useUser } from '@clerk/clerk-react'

const embeddedSignUpAppearance = {
  elements: {
    rootBox: { width: '100%' },
    cardBox: {
      width: '100%',
      border: 'none',
      boxShadow: 'none',
      background: 'transparent',
      overflow: 'visible',
    },
    card: {
      padding: 0,
      margin: 0,
      boxShadow: 'none',
      border: 'none',
      background: 'transparent',
    },
    header: { display: 'none' },
    footer: { background: 'none' },
    footerItem: { background: 'none' },
  },
} as const

export type PaywallReason = 'credits' | 'savedLimit' | 'upgrade'

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
    reason === 'savedLimit'
      ? 'Upgrade to save more resumes'
      : reason === 'upgrade'
        ? 'Upgrade to Pro'
        : 'Upgrade to keep tailoring'
  const signedInHeading =
    reason === 'savedLimit'
      ? 'You\u2019ve reached your saved resume limit'
      : reason === 'upgrade'
        ? 'Get the most out of Delta Resume'
        : 'You\u2019re out of credits'
  const signedInDescription =
    reason === 'savedLimit'
      ? 'Subscribe to Pro to save up to 10 resumes, plus 200 tailor credits every month. Cancel anytime.'
      : 'Subscribe to Pro and get 200 tailor credits every month, 10 saved resumes, match scoring, and DOCX export. Cancel anytime.'
  const signedOutHeading =
    reason === 'savedLimit'
      ? 'Save more resumes with Pro'
      : reason === 'upgrade'
        ? 'Go Pro with Delta Resume'
        : 'You\u2019ve used your 3 free tailors'
  const signedOutDescription =
    reason === 'savedLimit'
      ? 'Create a free account and upgrade to Pro to save up to 10 resumes.'
      : 'Create a free account to continue. Signing in with Google takes seconds.'

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size={isSignedIn ? 'lg' : 'md'}
      centered
      withCloseButton
      title={<Text fw={600}>{isSignedIn ? signedInTitle : 'Create your account'}</Text>}
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
          <SignUp routing="hash" appearance={embeddedSignUpAppearance} />
        </Stack>
      )}
    </Modal>
  )
}

export default PaywallModal
