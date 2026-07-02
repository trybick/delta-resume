import type { ChangeDecision, TailorResult } from './types'

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

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { message?: string }
    if (body.message) return body.message
  } catch {
    return `Request failed with status ${response.status}.`
  }
  return `Request failed with status ${response.status}.`
}

export const postTailor = async (
  resumeText: string,
  jobDescription: string,
): Promise<TailorResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/tailor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeText, jobDescription }),
  })
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response))
  }
  return (await response.json()) as TailorResponse
}

export const patchDecision = async (
  changeId: string,
  decision: ChangeDecision,
): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/changes/${changeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  })
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response))
  }
}
