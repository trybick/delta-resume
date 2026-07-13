import { useCallback, useState } from 'react';
import { getCredits } from '../lib/api';
import type { CreditStatus } from '../lib/types';

type UseCreditsResult = {
  credits: CreditStatus | null;
  outOfCredits: boolean;
  creditsLabel: string | null;
  isLoadingCredits: boolean;
  creditsError: boolean;
  loadCredits: () => Promise<void>;
};

export const useCredits = (): UseCreditsResult => {
  const [credits, setCredits] = useState<CreditStatus | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(true);
  const [creditsError, setCreditsError] = useState(false);

  const loadCredits = useCallback(async () => {
    setIsLoadingCredits(true);
    setCreditsError(false);
    try {
      setCredits(await getCredits());
    } catch {
      setCredits(null);
      setCreditsError(true);
    } finally {
      setIsLoadingCredits(false);
    }
  }, []);

  const outOfCredits = credits !== null && credits.remaining <= 0;

  const creditsLabel =
    credits === null
      ? null
      : credits.plan === 'pro'
        ? `${credits.remaining} credits`
        : `${credits.remaining} free ${credits.remaining === 1 ? 'credit' : 'credits'} left`;

  return {
    credits,
    outOfCredits,
    creditsLabel,
    isLoadingCredits,
    creditsError,
    loadCredits,
  };
};
