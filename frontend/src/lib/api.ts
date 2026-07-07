import type { CoverLetterResult, CreditStatus, SavedResume, TailorResult } from './types'
import { getAuthToken } from './authToken'
import { getFingerprint } from './fingerprint'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export type TailorResponse = TailorResult & {
  runId: string
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class CreditsExhaustedError extends ApiError {
  readonly requiresAuth: boolean

  constructor(message: string, requiresAuth: boolean) {
    super(402, message)
    this.name = 'CreditsExhaustedError'
    this.requiresAuth = requiresAuth
  }
}

const buildHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  const [token, fingerprint] = await Promise.all([getAuthToken(), getFingerprint()])
  if (token) headers.Authorization = `Bearer ${token}`
  if (fingerprint) headers['X-Guest-Fingerprint'] = fingerprint

  return headers
}

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) return body.message
  } catch {
    return `Request failed with status ${response.status}.`
  }
  return `Request failed with status ${response.status}.`
}

const throwApiError = async (response: Response): Promise<never> => {
  if (response.status === 402) {
    try {
      const body = (await response.json()) as {
        message?: string
        requiresAuth?: boolean
      }
      throw new CreditsExhaustedError(
        body.message ?? 'You are out of credits.',
        body.requiresAuth ?? true,
      )
    } catch (error) {
      if (error instanceof CreditsExhaustedError) throw error
      throw new CreditsExhaustedError('You are out of credits.', true)
    }
  }
  throw new ApiError(response.status, await readErrorMessage(response))
}

export const getCredits = async (): Promise<CreditStatus> => {
  const response = await fetch(`${API_BASE_URL}/api/credits`, {
    headers: await buildHeaders(),
  })
  if (!response.ok) {
    return throwApiError(response)
  }
  return (await response.json()) as CreditStatus
}

export const postTailor = async (
  resumeText: string,
  jobDescription: string,
  resumeName: string,
): Promise<TailorResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/tailor`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({ resumeText, jobDescription, resumeName }),
  })
  if (!response.ok) {
    return throwApiError(response)
  }
  return (await response.json()) as TailorResponse
}

export const postCoverLetter = async (
  resumeText: string,
  jobDescription: string,
  candidateName?: string,
): Promise<CoverLetterResult> => {
  const response = await fetch(`${API_BASE_URL}/api/cover-letter`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({ resumeText, jobDescription, candidateName: candidateName ?? null }),
  })
  if (!response.ok) {
    return throwApiError(response)
  }
  return (await response.json()) as CoverLetterResult
}

export const getSavedResumes = async (): Promise<SavedResume[]> => {
  const response = await fetch(`${API_BASE_URL}/api/resumes`, {
    headers: await buildHeaders(),
  })
  if (!response.ok) {
    return throwApiError(response)
  }
  return (await response.json()) as SavedResume[]
}

export const renameSavedResume = async (
  resumeId: string,
  name: string,
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/resumes/${resumeId}`, {
    method: 'PATCH',
    headers: await buildHeaders(),
    body: JSON.stringify({ name }),
  })
  if (!response.ok) {
    return throwApiError(response)
  }
}

export const deleteSavedResume = async (resumeId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/resumes/${resumeId}`, {
    method: 'DELETE',
    headers: await buildHeaders(),
  })
  if (!response.ok) {
    return throwApiError(response)
  }
}
