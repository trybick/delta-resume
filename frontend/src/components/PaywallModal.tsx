import { useEffect, useRef } from 'react';
import { FocusTrap, Modal, Stack, Text, Title } from '@mantine/core';
import { SignUp, useAuth, useUser } from '@clerk/clerk-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import ProPlanShowcase from './ProPlanShowcase';

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
} as const;

export type PaywallReason = 'credits' | 'savedLimit' | 'upgrade' | 'coverLetter';

type PaywallModalProps = {
  opened: boolean;
  reason: PaywallReason;
  onClose: () => void;
  onSubscriptionChange: () => void;
};

const PaywallModal = ({ opened, reason, onClose, onSubscriptionChange }: PaywallModalProps) => {
  const { isSignedIn } = useUser();
  const { has } = useAuth();
  const wasSignedOutRef = useRef(false);

  const hasProPlan = has?.({ plan: 'pro' }) ?? false;

  useEffect(() => {
    if (!opened) {
      wasSignedOutRef.current = false;
      return;
    }
    if (!isSignedIn) {
      wasSignedOutRef.current = true;
      return;
    }
    if (wasSignedOutRef.current) {
      trackEvent(AnalyticsEvents.PaywallSignUpAction, { reason });
      wasSignedOutRef.current = false;
    }
  }, [opened, isSignedIn, reason]);

  useEffect(() => {
    if (!opened) return;
    onSubscriptionChange();
    if ((reason === 'savedLimit' || reason === 'coverLetter') && hasProPlan) {
      onClose();
    }
  }, [opened, isSignedIn, hasProPlan, reason, onSubscriptionChange, onClose]);

  const signedInTitle =
    reason === 'savedLimit'
      ? 'Upgrade to save more resumes'
      : reason === 'coverLetter'
        ? 'Upgrade to unlock cover letters'
        : reason === 'upgrade'
          ? 'Upgrade to Pro'
          : 'Upgrade to keep tailoring';
  const signedInHeading =
    reason === 'savedLimit'
      ? 'You\u2019ve reached your saved resume limit'
      : reason === 'coverLetter'
        ? 'Cover letters are a Pro feature'
        : reason === 'upgrade'
          ? 'Get the most out of Delta Resume'
          : 'You\u2019re out of credits';
  const signedInDescription =
    reason === 'savedLimit'
      ? 'Go Pro to save up to 10 resumes and keep tailoring all month.'
      : reason === 'coverLetter'
        ? 'Go Pro and every tailor run also writes a matching cover letter.'
        : reason === 'upgrade'
          ? 'Everything you need to land more interviews, in one plan.'
          : 'Go Pro to keep tailoring without interruption.';
  const signedOutHeading =
    reason === 'savedLimit'
      ? 'Save more resumes with Pro'
      : reason === 'coverLetter'
        ? 'Get instant cover letters with Pro'
        : reason === 'upgrade'
          ? 'Go Pro with Delta Resume'
          : 'You\u2019ve used your 3 free tailors';
  const signedOutDescription =
    reason === 'savedLimit'
      ? 'Create a free account and upgrade to Pro to save up to 10 resumes.'
      : reason === 'coverLetter'
        ? 'Create a free account and upgrade to Pro to get a matching cover letter with every tailor run.'
        : reason === 'upgrade'
          ? 'Sign in to continue \u2014 it takes seconds with Google.'
          : 'Create a free account to keep tailoring. Signing in with Google takes seconds.';

  const handleSubscriptionComplete = () => {
    trackEvent(AnalyticsEvents.SubscriptionComplete, { reason });
    onSubscriptionChange();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="md"
      centered
      withCloseButton
      title={<Text fw={600}>{isSignedIn ? signedInTitle : 'Create your account'}</Text>}
    >
      <FocusTrap.InitialFocus />
      {isSignedIn ? (
        <Stack gap="md">
          <div>
            <Title order={4}>{signedInHeading}</Title>
            <Text size="sm" c="dimmed">
              {signedInDescription}
            </Text>
          </div>
          <ProPlanShowcase
            onCheckoutOpen={onClose}
            onSubscriptionComplete={handleSubscriptionComplete}
          />
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
  );
};

export default PaywallModal;
