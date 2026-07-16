import { useEffect, useRef, useState } from 'react';
import { ApiError, postCoverLetter } from '../lib/api';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';
import type { CoverLetterResult, CoverLetterStatus } from '../lib/types';

type CoverLetterInputs = {
  resumeText: string;
  jobDescription: string;
};

type UseCoverLetterResult = {
  status: CoverLetterStatus;
  result: CoverLetterResult | null;
  errorMessage: string | null;
  runCoverLetter: (resumeText: string, jobDescription: string) => Promise<void>;
  retryCoverLetter: () => void;
  resetCoverLetter: () => void;
};

export const useCoverLetter = (): UseCoverLetterResult => {
  const [status, setStatus] = useState<CoverLetterStatus>('idle');
  const [result, setResult] = useState<CoverLetterResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastInputsRef = useRef<CoverLetterInputs | null>(null);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  const runCoverLetter = async (resumeText: string, jobDescription: string): Promise<void> => {
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    lastInputsRef.current = { resumeText, jobDescription };
    setStatus('loading');
    setResult(null);
    setErrorMessage(null);
    try {
      const coverLetterResult = await postCoverLetter(
        resumeText,
        jobDescription,
        undefined,
        abortController.signal,
      );
      if (requestIdRef.current !== requestId) return;
      setResult(coverLetterResult);
      setStatus('done');
      trackEvent(AnalyticsEvents.CoverLetterSuccess);
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      trackEvent(AnalyticsEvents.CoverLetterFailure);
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'Could not reach the server. Is the backend running?',
      );
      setStatus('error');
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  };

  const retryCoverLetter = () => {
    const inputs = lastInputsRef.current;
    if (!inputs) return;
    void runCoverLetter(inputs.resumeText, inputs.jobDescription);
  };

  const resetCoverLetter = () => {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    lastInputsRef.current = null;
    setStatus('idle');
    setResult(null);
    setErrorMessage(null);
  };

  return { status, result, errorMessage, runCoverLetter, retryCoverLetter, resetCoverLetter };
};
