import { useEffect, useState } from 'react'
import type { PaywallReason } from '../components/PaywallModal'

const PENDING_PAYWALL_KEY = 'deltaResume.pendingPaywallReason'
const PAYWALL_REASONS: PaywallReason[] = ['credits', 'savedLimit', 'upgrade', 'coverLetter']

const readPendingPaywallReason = (): PaywallReason | null => {
  const stored = sessionStorage.getItem(PENDING_PAYWALL_KEY)
  if (!stored) return null
  return PAYWALL_REASONS.includes(stored as PaywallReason) ? (stored as PaywallReason) : null
}

type UsePaywallOptions = {
  isSignedIn: boolean | undefined
  hasCreditsRemaining: boolean
}

type UsePaywallResult = {
  paywallReason: PaywallReason | null
  openPaywall: (reason: PaywallReason) => void
  closePaywall: () => void
}

export const usePaywall = ({
  isSignedIn,
  hasCreditsRemaining,
}: UsePaywallOptions): UsePaywallResult => {
  const [paywallReason, setPaywallReason] = useState<PaywallReason | null>(readPendingPaywallReason)

  const openPaywall = (reason: PaywallReason) => {
    setPaywallReason(reason)
    if (!isSignedIn) {
      sessionStorage.setItem(PENDING_PAYWALL_KEY, reason)
    }
  }

  const closePaywall = () => {
    setPaywallReason(null)
    sessionStorage.removeItem(PENDING_PAYWALL_KEY)
  }

  useEffect(() => {
    if (!isSignedIn) return
    const pendingReason = readPendingPaywallReason()
    if (!pendingReason) return
    sessionStorage.removeItem(PENDING_PAYWALL_KEY)
    setPaywallReason(pendingReason)
  }, [isSignedIn])

  useEffect(() => {
    if (hasCreditsRemaining) {
      setPaywallReason((reason) => (reason === 'credits' ? null : reason))
    }
  }, [hasCreditsRemaining])

  return { paywallReason, openPaywall, closePaywall }
}
