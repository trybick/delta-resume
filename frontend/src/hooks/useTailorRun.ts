import { useRef, useState } from 'react';
import { ApiError, CreditsExhaustedError, postTailor } from '../lib/api';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import type { TailorResult, TailorStatus } from '../lib/types';

type UseTailorRunOptions = {
  onSuccess: () => void;
  onCreditsExhausted: () => void;
};

type UseTailorRunResult = {
  status: TailorStatus;
  result: TailorResult | null;
  runCount: number;
  errorMessage: string | null;
  clearError: () => void;
  runTailor: (resumeText: string, jobDescription: string, resumeName: string) => Promise<boolean>;
};

export const useTailorRun = ({
  onSuccess,
  onCreditsExhausted,
}: UseTailorRunOptions): UseTailorRunResult => {
  const [status, setStatus] = useState<TailorStatus>('idle');
  const [result, setResult] = useState<TailorResult | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resultRef = useRef<TailorResult | null>(null);

  const clearError = () => setErrorMessage(null);

  const runTailor = async (
    resumeText: string,
    jobDescription: string,
    resumeName: string,
  ): Promise<boolean> => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const tailorResult = await postTailor(resumeText, jobDescription, resumeName);
      resultRef.current = tailorResult;
      setResult(tailorResult);
      setRunCount((count) => count + 1);
      setStatus('done');
      onSuccess();
      return true;
    } catch (error) {
      if (error instanceof CreditsExhaustedError) {
        onCreditsExhausted();
      } else {
        trackEvent(AnalyticsEvents.TailorFailure);
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : 'Could not reach the server. Is the backend running?',
        );
      }
      setStatus(resultRef.current ? 'done' : 'idle');
      return false;
    }
  };

  return { status, result, runCount, errorMessage, clearError, runTailor };
};
