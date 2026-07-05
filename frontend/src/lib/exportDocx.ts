import JSZip from 'jszip'
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TextRun } from 'docx'

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'
const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const BULLET_MARKER = /^[\s\u00A0]*[-•–—*]\s*/

const FONT = 'Calibri'
const BODY_SIZE = 22
const NAME_SIZE = 36
const HEADING_SIZE = 24

export type DocxReplacement = {
  original: string
  tailored: string
}

const normalizeLine = (line: string): string =>
  line.replace(BULLET_MARKER, '').replace(/\s+/g, ' ').trim().toLowerCase()

const stripBulletMarker = (line: string): string => line.replace(BULLET_MARKER, '')

export const patchOriginalDocx = async (
  file: File,
  replacements: DocxReplacement[],
): Promise<Blob> => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const documentEntry = zip.file('word/document.xml')
  if (!documentEntry) throw new Error('missing document.xml')

  const xmlText = await documentEntry.async('string')
  const parsed = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (parsed.getElementsByTagName('parsererror').length > 0) {
    throw new Error('could not parse document.xml')
  }

  const replacementMap = new Map(
    replacements.map((replacement) => [
      normalizeLine(replacement.original),
      stripBulletMarker(replacement.tailored).trim(),
    ]),
  )

  let patchedCount = 0
  const paragraphs = parsed.getElementsByTagNameNS(WORD_NS, 'p')
  for (const paragraph of Array.from(paragraphs)) {
    const textNodes = Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 't'))
    if (textNodes.length === 0) continue
    const paragraphText = textNodes.map((node) => node.textContent ?? '').join('')
    const tailored = replacementMap.get(normalizeLine(paragraphText))
    if (tailored === undefined) continue
    textNodes.forEach((node, index) => {
      node.textContent = index === 0 ? tailored : ''
      if (index === 0) node.setAttributeNS(XML_NS, 'xml:space', 'preserve')
    })
    patchedCount += 1
  }

  if (patchedCount === 0) throw new Error('no matching paragraphs found')

  zip.file('word/document.xml', new XMLSerializer().serializeToString(parsed))
  return zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME })
}

const isHeadingLine = (line: string): boolean => {
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.length > 48) return false
  return /[A-Z]/.test(trimmed) && trimmed === trimmed.toUpperCase()
}

const buildParagraph = (line: string, index: number, previousBlank: boolean): Paragraph | null => {
  const trimmed = line.trim()
  if (trimmed.length === 0) return null

  if (index === 0) {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: trimmed, font: FONT, size: NAME_SIZE, bold: true })],
    })
  }

  if (isHeadingLine(line)) {
    return new Paragraph({
      spacing: { before: 220, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, space: 2 } },
      children: [new TextRun({ text: trimmed, font: FONT, size: HEADING_SIZE, bold: true })],
    })
  }

  const strippedBullet = stripBulletMarker(line).trim()
  if (strippedBullet !== trimmed && strippedBullet.length > 0) {
    return new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 40 },
      children: [new TextRun({ text: strippedBullet, font: FONT, size: BODY_SIZE })],
    })
  }

  return new Paragraph({
    spacing: { before: previousBlank ? 120 : 0, after: 40 },
    children: [new TextRun({ text: trimmed, font: FONT, size: BODY_SIZE })],
  })
}

export const buildTemplateDocx = async (resumeText: string): Promise<Blob> => {
  const lines = resumeText.split('\n')
  const paragraphs: Paragraph[] = []
  let previousBlank = false
  let contentIndex = 0

  lines.forEach((line) => {
    if (line.trim().length === 0) {
      previousBlank = true
      return
    }
    const paragraph = buildParagraph(line, contentIndex, previousBlank)
    if (paragraph) paragraphs.push(paragraph)
    contentIndex += 1
    previousBlank = false
  })

  const document = new Document({
    sections: [{ children: paragraphs }],
  })

  return Packer.toBlob(document)
}

export const downloadDocx = (blob: Blob, filename: string): void => {
  const typedBlob = blob.type === DOCX_MIME ? blob : new Blob([blob], { type: DOCX_MIME })
  const url = URL.createObjectURL(typedBlob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
