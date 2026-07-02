import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
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

const readPdfFile = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(pageText)
  }
  const text = pages.join('\n').trim()
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
