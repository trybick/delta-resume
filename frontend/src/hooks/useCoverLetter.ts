import { useRef, useState } from 'react'
import { ApiError, postCoverLetter } from '../lib/api'
import { AnalyticsEvents, trackEvent } from '../lib/analytics'
import type { CoverLetterResult, CoverLetterStatus } from '../lib/types'

type CoverLetterInputs = {
  resumeText: string
  jobDescription: string
}

type UseCoverLetterResult = {
  status: CoverLetterStatus
  result: CoverLetterResult | null
  errorMessage: string | null
  runCoverLetter: (resumeText: string, jobDescription: string) => Promise<void>
  retryCoverLetter: () => void
  resetCoverLetter: () => void
}

export const useCoverLetter = (): UseCoverLetterResult => {
  const [status, setStatus] = useState<CoverLetterStatus>('idle')
  const [result, setResult] = useState<CoverLetterResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const lastInputsRef = useRef<CoverLetterInputs | null>(null)
  const requestIdRef = useRef(0)

  const runCoverLetter = async (resumeText: string, jobDescription: string): Promise<void> => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    lastInputsRef.current = { resumeText, jobDescription }
    setStatus('loading')
    setResult(null)
    setErrorMessage(null)
    try {
      const coverLetterResult = await postCoverLetter(resumeText, jobDescription)
      if (requestIdRef.current !== requestId) return
      setResult(coverLetterResult)
      setStatus('done')
      trackEvent(AnalyticsEvents.CoverLetterSuccess)
    } catch (error) {
      if (requestIdRef.current !== requestId) return
      trackEvent(AnalyticsEvents.CoverLetterFailure)
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'Could not reach the server. Is the backend running?',
      )
      setStatus('error')
    }
  }

  const retryCoverLetter = () => {
    const inputs = lastInputsRef.current
    if (!inputs) return
    void runCoverLetter(inputs.resumeText, inputs.jobDescription)
  }

  const resetCoverLetter = () => {
    requestIdRef.current += 1
    lastInputsRef.current = null
    setStatus('idle')
    setResult(null)
    setErrorMessage(null)
  }

  return { status, result, errorMessage, runCoverLetter, retryCoverLetter, resetCoverLetter }
}
