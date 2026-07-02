import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import mammoth from 'mammoth'

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const TEXT_EXTENSIONS = new Set(['txt', 'md'])
const DOCX_EXTENSIONS = new Set(['docx'])
const PDF_EXTENSIONS = new Set(['pdf'])

export class ResumeParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResumeParseError'
  }
}

const readTextFile = async (file: File): Promise<string> => {
  const text = await file.text()
  if (!text.trim()) {
    throw new ResumeParseError('The file is empty.')
  }
  return text
}

const buildPageText = (items: TextItem[]): string => {
  const lines: string[] = []
  let currentLine = ''
  let lastY: number | null = null

  const flushLine = () => {
    const trimmed = currentLine.replace(/\s+/g, ' ').trim()
    if (trimmed) lines.push(trimmed)
    currentLine = ''
  }

  for (const item of items) {
    const y = item.transform[5]
    const startsNewLine = lastY !== null && Math.abs(y - lastY) > 2

    if (startsNewLine) flushLine()
    currentLine = currentLine ? `${currentLine} ${item.str}` : item.str
    if (item.hasEOL) flushLine()
    lastY = y
  }

  flushLine()
  return lines.join('\n')
}

const readPdfFile = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const textItems = content.items.filter(
      (item): item is TextItem => 'str' in item,
    )
    pages.push(buildPageText(textItems))
  }
  const text = pages.join('\n\n').trim()
  if (!text) {
    throw new ResumeParseError(
      'Could not extract text from this PDF. Try a text-based PDF or paste your resume instead.',
    )
  }
  return text
}

const readDocxFile = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  const text = result.value.trim()
  if (!text) {
    throw new ResumeParseError('Could not extract text from this DOCX file.')
  }
  return text
}

export const parseResumeFile = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (TEXT_EXTENSIONS.has(extension)) {
    return readTextFile(file)
  }
  if (PDF_EXTENSIONS.has(extension)) {
    return readPdfFile(file)
  }
  if (DOCX_EXTENSIONS.has(extension)) {
    return readDocxFile(file)
  }
  if (extension === 'doc') {
    throw new ResumeParseError(
      'Legacy .doc files are not supported. Save as .docx or paste your resume text.',
    )
  }
  throw new ResumeParseError(
    `Unsupported file type ".${extension}". Use .txt, .md, .pdf, or .docx.`,
  )
}
