import { useCallback, useEffect, useState } from 'react';
import type { PaywallReason } from '../components/PaywallModal';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';

const PENDING_PAYWALL_KEY = 'deltaResume.pendingPaywallReason';
const PAYWALL_REASONS: PaywallReason[] = [
  'credits',
  'savedLimit',
  'upgrade',
  'coverLetter',
  'gaps',
  'signUp',
];

const readPendingPaywallReason = (): PaywallReason | null => {
  const stored = sessionStorage.getItem(PENDING_PAYWALL_KEY);
  if (!stored) return null;
  return PAYWALL_REASONS.includes(stored as PaywallReason) ? (stored as PaywallReason) : null;
};

type UsePaywallOptions = {
  isSignedIn: boolean | undefined;
  hasCreditsRemaining: boolean;
};

type UsePaywallResult = {
  paywallReason: PaywallReason | null;
  openPaywall: (reason: PaywallReason) => void;
  closePaywall: () => void;
};

export const usePaywall = ({
  isSignedIn,
  hasCreditsRemaining,
}: UsePaywallOptions): UsePaywallResult => {
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(null);

  const openPaywall = useCallback(
    (reason: PaywallReason) => {
      trackEvent(AnalyticsEvents.PaywallOpened, { reason });
      setPaywallReason(reason);
      if (!isSignedIn) {
        sessionStorage.setItem(PENDING_PAYWALL_KEY, reason);
      }
    },
    [isSignedIn],
  );

  const closePaywall = useCallback(() => {
    setPaywallReason((reason) => {
      if (reason) {
        trackEvent(AnalyticsEvents.PaywallClose, { reason });
      }
      return null;
    });
    sessionStorage.removeItem(PENDING_PAYWALL_KEY);
  }, []);

  useEffect(() => {
    if (isSignedIn === undefined) return;

    if (!isSignedIn) {
      sessionStorage.removeItem(PENDING_PAYWALL_KEY);
      return;
    }

    const pendingReason = readPendingPaywallReason();
    if (!pendingReason) return;
    sessionStorage.removeItem(PENDING_PAYWALL_KEY);

    if (pendingReason === 'signUp') return;

    let shouldTrack = false;
    setPaywallReason((current) => {
      if (current !== null) return current;
      shouldTrack = true;
      return pendingReason;
    });
    if (shouldTrack) {
      trackEvent(AnalyticsEvents.PaywallOpened, { reason: pendingReason });
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (hasCreditsRemaining) {
      setPaywallReason((reason) => (reason === 'credits' ? null : reason));
    }
  }, [hasCreditsRemaining]);

  return { paywallReason, openPaywall, closePaywall };
};
