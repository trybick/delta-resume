import type {
  CoverLetterResult,
  CreditStatus,
  ResumeDocument,
  SavedResume,
  TailorResult,
  UserSettings,
} from './types';
import { getAuthToken } from './authToken';
import { getFingerprint } from './fingerprint';
import { notifyRateLimited } from './rateLimitNotice';
import { parseResumeDocument } from './resumeModel';
import { parsePersistedDocxLayout, serializeDocxLayout, type DocxCleanLayout } from './docxLayout';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export type TailorResponse = TailorResult & {
  runId: string;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class RateLimitedError extends ApiError {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(429, message);
    this.name = 'RateLimitedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class CreditsExhaustedError extends ApiError {
  readonly requiresAuth: boolean;

  constructor(message: string, requiresAuth: boolean) {
    super(402, message);
    this.name = 'CreditsExhaustedError';
    this.requiresAuth = requiresAuth;
  }
}

const buildHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const [token, fingerprint] = await Promise.all([getAuthToken(), getFingerprint()]);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (fingerprint) headers['X-Guest-Fingerprint'] = fingerprint;

  return headers;
};

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as { message?: string };
    if (body.message) return body.message;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
  return `Request failed with status ${response.status}.`;
};

const throwApiError = async (response: Response): Promise<never> => {
  if (response.status === 429) {
    const retryAfterSeconds = Number.parseInt(response.headers.get('Retry-After') ?? '', 10) || 60;
    const message = `Rate limited by the backend. Try again in ${retryAfterSeconds}s.`;
    notifyRateLimited(message);
    throw new RateLimitedError(message, retryAfterSeconds);
  }
  if (response.status === 402) {
    try {
      const body = (await response.json()) as {
        message?: string;
        requiresAuth?: boolean;
      };
      throw new CreditsExhaustedError(
        body.message ?? 'You are out of credits.',
        body.requiresAuth ?? true,
      );
    } catch (error) {
      if (error instanceof CreditsExhaustedError) throw error;
      throw new CreditsExhaustedError('You are out of credits.', true);
    }
  }
  throw new ApiError(response.status, await readErrorMessage(response));
};

export const getCredits = async (): Promise<CreditStatus> => {
  const response = await fetch(`${API_BASE_URL}/api/credits`, {
    headers: await buildHeaders(),
  });
  if (!response.ok) {
    return throwApiError(response);
  }
  return (await response.json()) as CreditStatus;
};

export const postTailor = async (
  resumeText: string,
  jobDescription: string,
  resumeName: string,
  resumeDocument?: ResumeDocument | null,
  resumeLayout?: DocxCleanLayout | null,
  signal?: AbortSignal,
  runId?: string,
): Promise<TailorResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/tailor`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({
      resumeText,
      jobDescription,
      resumeName,
      resumeDocument: resumeDocument ? JSON.stringify(resumeDocument) : null,
      resumeLayout: resumeLayout ? serializeDocxLayout(resumeLayout) : null,
      runId: runId ?? null,
    }),
    signal,
  });
  if (!response.ok) {
    return throwApiError(response);
  }
  const data = (await response.json()) as Omit<TailorResponse, 'document' | 'resumeLayout'> & {
    document?: unknown;
    resumeLayout?: unknown;
  };
  return {
    ...data,
    changes: (data.changes ?? []).map((change) => ({
      ...change,
      sourceLines:
        change.sourceLines && change.sourceLines.length > 0
          ? change.sourceLines
          : [],
    })),
    requirements: (data.requirements ?? []).map((requirement) => ({
      ...requirement,
      gapHint: requirement.gapHint ?? null,
      draftBullet: requirement.draftBullet ?? null,
      insertAfterId: requirement.insertAfterId ?? null,
      locked: requirement.locked ?? false,
    })),
    document: parseResumeDocument(data.document),
    resumeLayout: parsePersistedDocxLayout(data.resumeLayout),
  };
};

export const postCoverLetter = async (
  resumeText: string,
  jobDescription: string,
  candidateName?: string,
  signal?: AbortSignal,
  runId?: string,
): Promise<CoverLetterResult> => {
  const response = await fetch(`${API_BASE_URL}/api/cover-letter`, {
    method: 'POST',
    headers: await buildHeaders(),
    body: JSON.stringify({
      resumeText,
      jobDescription,
      candidateName: candidateName ?? null,
      runId: runId ?? null,
    }),
    signal,
  });
  if (!response.ok) {
    return throwApiError(response);
  }
  return (await response.json()) as CoverLetterResult;
};

export const convertDocxToPdfRemote = async (docxBlob: Blob): Promise<Blob> => {
  const headers = await buildHeaders();
  headers['Content-Type'] =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const response = await fetch(`${API_BASE_URL}/api/convert-pdf`, {
    method: 'POST',
    headers,
    body: docxBlob,
  });
  if (!response.ok) {
    return throwApiError(response);
  }
  return response.blob();
};

export const getSettings = async (): Promise<UserSettings> => {
  const response = await fetch(`${API_BASE_URL}/api/settings`, {
    headers: await buildHeaders(),
  });
  if (!response.ok) {
    return throwApiError(response);
  }
  return (await response.json()) as UserSettings;
};

export const putSettings = async (settings: UserSettings): Promise<UserSettings> => {
  const response = await fetch(`${API_BASE_URL}/api/settings`, {
    method: 'PUT',
    headers: await buildHeaders(),
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    return throwApiError(response);
  }
  return (await response.json()) as UserSettings;
};

export const getSavedResumes = async (): Promise<SavedResume[]> => {
  const response = await fetch(`${API_BASE_URL}/api/saved-resumes`, {
    headers: await buildHeaders(),
  });
  if (!response.ok) {
    return throwApiError(response);
  }
  const data = (await response.json()) as Array<
    Omit<SavedResume, 'resumeDocument' | 'resumeLayout'> & {
      resumeDocument?: unknown;
      resumeLayout?: unknown;
    }
  >;
  return data.map((resume) => ({
    ...resume,
    resumeDocument: parseResumeDocument(resume.resumeDocument),
    resumeLayout: parsePersistedDocxLayout(resume.resumeLayout),
  }));
};

export const renameSavedResume = async (resumeId: string, name: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/saved-resumes/${resumeId}`, {
    method: 'PATCH',
    headers: await buildHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    return throwApiError(response);
  }
};

export const deleteSavedResume = async (resumeId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/saved-resumes/${resumeId}`, {
    method: 'DELETE',
    headers: await buildHeaders(),
  });
  if (!response.ok) {
    return throwApiError(response);
  }
};
