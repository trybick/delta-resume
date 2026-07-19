import type { CreditStatus } from './types';

export const NETWORK_ERROR_MESSAGE =
  "Couldn't reach the server. Check your connection and try again.";

export const SAVED_RESUME_LIMIT_FREE = 1;
export const SAVED_RESUME_LIMIT_PRO = 10;

export const RESUME_TEXT_MAX_LENGTH = 15000;

export const isProPlan = (credits: CreditStatus | null | undefined): boolean =>
  credits?.plan === 'pro';

export const getSavedResumeLimit = (proPlan: boolean): number =>
  proPlan ? SAVED_RESUME_LIMIT_PRO : SAVED_RESUME_LIMIT_FREE;
