import { useCallback, useState } from 'react'
import { getCredits } from '../lib/api'
import type { CreditStatus } from '../lib/types'

type UseCreditsResult = {
  credits: CreditStatus | null
  outOfCredits: boolean
  creditsLabel: string | null
  loadCredits: () => Promise<void>
}

export const useCredits = (): UseCreditsResult => {
  const [credits, setCredits] = useState<CreditStatus | null>(null)

  const loadCredits = useCallback(async () => {
    try {
      setCredits(await getCredits())
    } catch {
      setCredits(null)
    }
  }, [])

  const outOfCredits = credits !== null && credits.remaining <= 0

  const creditsLabel =
    credits === null
      ? null
      : credits.plan === 'pro'
        ? `${credits.remaining} credits`
        : `${credits.remaining} free ${credits.remaining === 1 ? 'credit' : 'credits'} left`

  return { credits, outOfCredits, creditsLabel, loadCredits }
}
