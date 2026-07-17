import { useEffect, useRef } from 'react';
import { FocusTrap, Modal, Paper, Stack, Text, Title } from '@mantine/core';
import { SignUp, useAuth, useUser } from '@clerk/clerk-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import type { PaywallReason } from '../lib/types';
import ProFeatureList from './ProFeatureList';
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
    socialButtonsBlockButton: {
      minHeight: '3.25rem',
      fontSize: '1rem',
      fontWeight: 600,
      paddingTop: '0.85rem',
      paddingBottom: '0.85rem',
    },
    socialButtonsBlockButtonText: {
      fontSize: '1rem',
      fontWeight: 600,
    },
    socialButtonsProviderIcon: {
      width: '1.35rem',
      height: '1.35rem',
    },
  },
} as const;

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
  }, [opened, isSignedIn, hasProPlan, onSubscriptionChange]);

  useEffect(() => {
    if (!opened) return;
    if ((reason === 'savedLimit' || reason === 'coverLetter' || reason === 'gaps') && hasProPlan) {
      onClose();
    }
  }, [opened, reason, hasProPlan, onClose]);

  useEffect(() => {
    if (!opened || !isSignedIn) return;
    if (reason === 'signUp') {
      onClose();
    }
  }, [opened, isSignedIn, reason, onClose]);

  const signedInTitle =
    reason === 'savedLimit'
      ? 'Upgrade to save more resumes'
      : reason === 'coverLetter'
        ? 'Upgrade to unlock cover letters'
        : reason === 'gaps'
          ? 'Upgrade to unlock missing requirements'
          : reason === 'upgrade'
            ? 'Upgrade to Pro'
            : 'Upgrade to keep tailoring';
  const signedInHeading =
    reason === 'savedLimit'
      ? 'You\u2019ve reached your saved resume limit'
      : reason === 'coverLetter'
        ? 'Cover letters are a Pro feature'
        : reason === 'gaps'
          ? 'Missing requirements are a Pro feature'
          : reason === 'upgrade'
            ? 'Get the most out of Delta Resume'
            : 'You\u2019re out of credits';
  const signedInDescription =
    reason === 'savedLimit'
      ? 'Go Pro to save up to 10 resumes and keep tailoring all month.'
      : reason === 'coverLetter'
        ? 'Go Pro and every tailor run also writes a matching cover letter.'
        : reason === 'gaps'
          ? 'Go Pro to unlock every job requirement your resume doesn\u2019t show yet, plus where a bullet would fit.'
          : reason === 'upgrade'
            ? 'Everything you need to land more interviews, in one plan.'
            : 'Go Pro to keep tailoring without interruption.';
  const signedOutHeading =
    reason === 'savedLimit'
      ? 'Save more resumes with Pro'
      : reason === 'coverLetter'
        ? 'Get instant cover letters with Pro'
        : reason === 'gaps'
          ? 'See missing requirements with Pro'
          : reason === 'upgrade'
            ? 'Go Pro with Delta Resume'
            : reason === 'credits'
              ? 'You\u2019ve used your 3 free tailors'
              : null;
  const signedOutDescription =
    reason === 'savedLimit'
      ? 'Create a free account and upgrade to Pro to save up to 10 resumes.'
      : reason === 'coverLetter'
        ? 'Create a free account and upgrade to Pro to get a matching cover letter with every tailor run.'
        : reason === 'gaps'
          ? 'Create a free account and upgrade to Pro to unlock every job requirement your resume doesn\u2019t cover yet.'
          : reason === 'upgrade'
            ? 'Sign in to continue \u2014 it takes seconds with Google.'
            : reason === 'credits'
              ? 'Create a free account to keep tailoring. Signing in with Google takes seconds.'
              : null;

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
      radius="lg"
      overlayProps={{ backgroundOpacity: 0.6, blur: 3 }}
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
          {signedOutHeading && signedOutDescription && (
            <Stack gap={4} align="center">
              <Title order={4}>{signedOutHeading}</Title>
              <Text size="sm" c="dimmed" ta="center">
                {signedOutDescription}
              </Text>
            </Stack>
          )}
          <Paper
            p="md"
            radius="md"
            w="100%"
            style={{
              border: '1px solid var(--mantine-color-cyan-9)',
              background:
                'linear-gradient(160deg, rgba(34, 184, 207, 0.1) 0%, rgba(34, 139, 230, 0.04) 65%, transparent 100%)',
            }}
          >
            <Stack gap="sm">
              <Text
                size="xs"
                fw={700}
                c="cyan.4"
                tt="uppercase"
                style={{ letterSpacing: '0.06em' }}
              >
                Everything included with Pro
              </Text>
              <ProFeatureList columns={{ base: 1, xs: 2 }} />
            </Stack>
          </Paper>
          <SignUp routing="hash" appearance={embeddedSignUpAppearance} />
        </Stack>
      )}
    </Modal>
  );
};

export default PaywallModal;
