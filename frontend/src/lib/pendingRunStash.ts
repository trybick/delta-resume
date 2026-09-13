import type {
  AddedBullet,
  ChangeDecision,
  CoverLetterResult,
  TailorResult,
} from './types';

export type PendingRunStash = {
  runId: string;
  resumeText: string;
  jobDescription: string;
  resumeName?: string;
  result: TailorResult;
  coverLetterResult: CoverLetterResult | null;
  decisions: Record<string, ChangeDecision>;
  addedBullets: AddedBullet[];
};

const PENDING_RUN_KEY = 'deltaResume.pendingRun';

export const writePendingRun = (stash: PendingRunStash): void => {
  try {
    sessionStorage.setItem(PENDING_RUN_KEY, JSON.stringify(stash));
  } catch {
    return;
  }
};

export const readPendingRun = (): PendingRunStash | null => {
  try {
    const stored = sessionStorage.getItem(PENDING_RUN_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as PendingRunStash;
    if (!parsed || typeof parsed !== 'object' || !parsed.result) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearPendingRun = (): void => {
  try {
    sessionStorage.removeItem(PENDING_RUN_KEY);
  } catch {
    return;
  }
};
