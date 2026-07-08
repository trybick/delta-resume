import localforage from 'localforage'
import { normalizeResumeTextForComparison } from './exportDocx'

type StoredDocx = {
  bytes: ArrayBuffer
  filename: string
  savedAt: number
}

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const docxStore = localforage.createInstance({
  name: 'delta-resume',
  storeName: 'original_docx',
})

const hashResumeText = async (text: string): Promise<string> => {
  const encoded = new TextEncoder().encode(normalizeResumeTextForComparison(text))
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const saveOriginalDocx = async (parsedText: string, file: File): Promise<void> => {
  try {
    const key = await hashResumeText(parsedText)
    const stored: StoredDocx = {
      bytes: await file.arrayBuffer(),
      filename: file.name,
      savedAt: Date.now(),
    }
    await docxStore.setItem(key, stored)
  } catch {
    return
  }
}

export const loadOriginalDocx = async (resumeText: string): Promise<File | null> => {
  try {
    const key = await hashResumeText(resumeText)
    const stored = await docxStore.getItem<StoredDocx>(key)
    if (!stored) return null
    return new File([stored.bytes], stored.filename, { type: DOCX_MIME })
  } catch {
    return null
  }
}

export const cleanupOriginalDocxStore = async (keepResumeTexts: string[]): Promise<void> => {
  try {
    const keepKeys = new Set(await Promise.all(keepResumeTexts.map(hashResumeText)))
    const storedKeys = await docxStore.keys()
    const staleKeys = storedKeys.filter((key) => !keepKeys.has(key))
    await Promise.all(staleKeys.map((key) => docxStore.removeItem(key)))
  } catch {
    return
  }
}
