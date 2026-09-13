import { useEffect, useRef } from 'react';
import { FocusTrap, List, Modal, Paper, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { SignUp, useAuth, useUser } from '@clerk/clerk-react';
import { IconCheck } from '@tabler/icons-react';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { extraFreeRunsAfterSignup } from '../lib/constants';
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
  freeCreditTotal: number | null;
  onClose: () => void;
  onSubscriptionChange: () => void;
};

const PaywallModal = ({
  opened,
  reason,
  freeCreditTotal,
  onClose,
  onSubscriptionChange,
}: PaywallModalProps) => {
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
    if ((reason === 'savedLimit' || reason === 'coverLetter' || reason === 'gaps' || reason === 'keepFormatting') && hasProPlan) {
      onClose();
    }
  }, [opened, reason, hasProPlan, onClose]);

  useEffect(() => {
    if (!opened || !isSignedIn) return;
    if (reason === 'signUp' || reason === 'export') {
      onClose();
    }
  }, [opened, isSignedIn, reason, onClose]);

  const extraFreeRuns =
    freeCreditTotal !== null ? extraFreeRunsAfterSignup(freeCreditTotal) : 3;

  const signedInTitle =
    reason === 'savedLimit'
      ? 'Upgrade to save more resumes'
      : reason === 'coverLetter'
        ? 'Upgrade to customize cover letters'
        : reason === 'gaps'
          ? 'Upgrade to unlock missing requirements'
          : reason === 'keepFormatting'
            ? 'Upgrade to keep your formatting'
            : reason === 'upgrade'
              ? 'Upgrade to Pro'
              : 'Upgrade to keep tailoring';
  const signedInHeading =
    reason === 'savedLimit'
      ? 'You\u2019ve reached your saved resume limit'
      : reason === 'coverLetter'
        ? 'Cover letter length and tone are a Pro feature'
        : reason === 'gaps'
          ? 'See exactly what the job asks for that you\u2019re missing'
          : reason === 'keepFormatting'
            ? 'Keep your Word formatting on every export'
            : reason === 'upgrade'
              ? 'Never send an untailored resume again'
              : 'You\u2019re out of credits';
  const signedInDescription =
    reason === 'savedLimit'
      ? 'Go Pro to save up to 10 resumes and keep every application in one place.'
      : reason === 'coverLetter'
        ? 'Go Pro to pick the length and tone of every cover letter.'
        : reason === 'gaps'
          ? 'Pro shows the full requirements list, not just the first gap, plus a ready-to-edit bullet for each.'
          : reason === 'keepFormatting'
            ? 'Go Pro to export DOCX and PDF that look exactly like the resume you uploaded, fit to one page.'
            : reason === 'upgrade'
              ? 'Tailor every application, fill every gap, and keep your Word formatting.'
              : 'Go Pro to keep tailoring without interruption.';
  const signedOutHeading =
    reason === 'savedLimit'
      ? 'Save more resumes with Pro'
      : reason === 'coverLetter'
        ? 'Customize cover letters with Pro'
        : reason === 'gaps'
          ? 'See missing requirements with Pro'
          : reason === 'upgrade'
            ? 'Go Pro with Delta Resume'
            : reason === 'credits'
              ? 'You\u2019ve used your free run'
              : reason === 'export'
                ? 'Export as DOCX or PDF with a free account'
                : reason === 'signUp'
                  ? 'Create a free account'
                  : null;
  const signedOutDescription =
    reason === 'savedLimit'
      ? 'Create a free account and upgrade to Pro to save up to 10 resumes.'
      : reason === 'coverLetter'
        ? 'Create a free account and upgrade to Pro to pick the length and tone of every cover letter.'
        : reason === 'gaps'
          ? 'Create a free account and upgrade to Pro to see every job requirement your resume doesn\u2019t cover yet.'
          : reason === 'upgrade'
            ? 'Sign in to continue \u2014 it takes seconds with Google.'
            : reason === 'credits'
              ? `Create a free account for ${extraFreeRuns} more.`
              : reason === 'export'
                ? 'Export as DOCX or PDF with a free account.'
                : reason === 'signUp'
                  ? `Want ${extraFreeRuns} more free runs? Create a free account. This result is saved to Your applications and you can export it as DOCX or PDF.`
                  : null;
  const showFreeAccountBenefits = reason === 'signUp' || reason === 'export' || reason === 'credits';
  const freeAccountBenefits = [
    `${extraFreeRuns} more free runs`,
    'Saved history in Your applications',
    'DOCX and PDF export',
  ];

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
                {showFreeAccountBenefits ? 'With a free account' : 'Everything included with Pro'}
              </Text>
              {showFreeAccountBenefits ? (
                <List
                  spacing="xs"
                  size="sm"
                  icon={
                    <ThemeIcon size={20} radius="xl" variant="light" color="teal">
                      <IconCheck size={12} />
                    </ThemeIcon>
                  }
                >
                  {freeAccountBenefits.map((benefit) => (
                    <List.Item key={benefit}>{benefit}</List.Item>
                  ))}
                </List>
              ) : (
                <ProFeatureList columns={{ base: 1, xs: 2 }} />
              )}
            </Stack>
          </Paper>
          <SignUp routing="hash" appearance={embeddedSignUpAppearance} />
        </Stack>
      )}
    </Modal>
  );
};

export default PaywallModal;
