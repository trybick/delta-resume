import FingerprintJS from '@fingerprintjs/fingerprintjs';

const STORAGE_KEY = 'delta-resume-visitor-id';

let cachedVisitorId: string | null = null;

export const getFingerprint = async (): Promise<string | null> => {
  if (cachedVisitorId) return cachedVisitorId;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      cachedVisitorId = stored;
      return stored;
    }

    const agent = await FingerprintJS.load();
    const { visitorId } = await agent.get();
    cachedVisitorId = visitorId;
    localStorage.setItem(STORAGE_KEY, visitorId);
    return visitorId;
  } catch {
    return null;
  }
};
