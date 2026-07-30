import { useEffect, useRef, useState } from 'react';
import { ApiError, CreditsExhaustedError, postTailor } from '../lib/api';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import { NETWORK_ERROR_MESSAGE } from '../lib/constants';
import type { ResumeDocument, TailorResult, TailorStatus } from '../lib/types';

type UseTailorRunOptions = {
  onSuccess: () => void;
  onCreditsExhausted: () => void;
  onRequestFinished: () => void;
};

type UseTailorRunResult = {
  status: TailorStatus;
  result: TailorResult | null;
  runCount: number;
  errorMessage: string | null;
  clearError: () => void;
  runTailor: (
    resumeText: string,
    jobDescription: string,
    resumeName: string,
    resumeDocument?: ResumeDocument | null,
    runId?: string,
  ) => Promise<boolean>;
};

export const useTailorRun = ({
  onSuccess,
  onCreditsExhausted,
  onRequestFinished,
}: UseTailorRunOptions): UseTailorRunResult => {
  const [status, setStatus] = useState<TailorStatus>('idle');
  const [result, setResult] = useState<TailorResult | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resultRef = useRef<TailorResult | null>(null);
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const clearError = () => setErrorMessage(null);

  const runTailor = async (
    resumeText: string,
    jobDescription: string,
    resumeName: string,
    resumeDocument?: ResumeDocument | null,
    runId?: string,
  ): Promise<boolean> => {
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setStatus('loading');
    setErrorMessage(null);
    try {
      const tailorResult = await postTailor(
        resumeText,
        jobDescription,
        resumeName,
        resumeDocument,
        abortController.signal,
        runId,
      );
      resultRef.current = tailorResult;
      setResult(tailorResult);
      setRunCount((count) => count + 1);
      setStatus('done');
      onSuccess();
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus(resultRef.current ? 'done' : 'idle');
        return false;
      }
      if (error instanceof CreditsExhaustedError) {
        onCreditsExhausted();
      } else {
        trackEvent(AnalyticsEvents.TailorFailure);
        setErrorMessage(error instanceof ApiError ? error.message : NETWORK_ERROR_MESSAGE);
      }
      setStatus(resultRef.current ? 'done' : 'idle');
      return false;
    } finally {
      inFlightRef.current = false;
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      onRequestFinished();
    }
  };

  return { status, result, runCount, errorMessage, clearError, runTailor };
};
