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

const pageWasReloaded = (): boolean => {
  const [entry] = performance.getEntriesByType('navigation');
  return entry instanceof PerformanceNavigationTiming && entry.type === 'reload';
};

// A refresh should start empty. Signing in can leave the page and come back as a
// navigation, and that return still needs the stashed run.
export const readPendingRunForThisLoad = (): PendingRunStash | null => {
  if (pageWasReloaded()) {
    clearPendingRun();
    return null;
  }
  return readPendingRun();
};
