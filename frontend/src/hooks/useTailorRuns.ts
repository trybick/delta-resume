import { useCallback, useState } from 'react';
import { deleteTailorRun, getTailorRuns } from '../lib/api';
import type { TailorRunSummary } from '../lib/types';

type UseTailorRunsResult = {
  runs: TailorRunSummary[];
  hiddenOlderCount: number;
  isLoadingRuns: boolean;
  loadRuns: () => Promise<void>;
  deleteRun: (runId: string) => Promise<void>;
};

export const useTailorRuns = (isSignedIn: boolean): UseTailorRunsResult => {
  const [runs, setRuns] = useState<TailorRunSummary[]>([]);
  const [hiddenOlderCount, setHiddenOlderCount] = useState(0);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);

  const loadRuns = useCallback(async () => {
    if (!isSignedIn) {
      setRuns([]);
      setHiddenOlderCount(0);
      setIsLoadingRuns(false);
      return;
    }
    setIsLoadingRuns(true);
    try {
      const listed = await getTailorRuns();
      setRuns(listed.runs);
      setHiddenOlderCount(listed.hiddenOlderCount);
    } catch {
      setRuns([]);
      setHiddenOlderCount(0);
    } finally {
      setIsLoadingRuns(false);
    }
  }, [isSignedIn]);

  const deleteRun = useCallback(
    async (runId: string) => {
      setRuns((current) => current.filter((run) => run.id !== runId));
      try {
        await deleteTailorRun(runId);
      } catch {
        void loadRuns();
      }
    },
    [loadRuns],
  );

  return { runs, hiddenOlderCount, isLoadingRuns, loadRuns, deleteRun };
};
