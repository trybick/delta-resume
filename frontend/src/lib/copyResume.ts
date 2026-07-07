import { isHeadingLine, stripBulletMarker } from './exportDocx'

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const BASE_STYLE = "font-family: Calibri, Arial, sans-serif; font-size: 11pt;"

export const buildResumeHtml = (resumeText: string): string => {
  const lines = resumeText.split('\n')
  const blocks: string[] = []
  let listItems: string[] = []
  let contentIndex = 0

  const flushList = () => {
    if (listItems.length === 0) return
    blocks.push(`<ul style="margin: 0 0 6pt 0;">${listItems.join('')}</ul>`)
    listItems = []
  }

  lines.forEach((line) => {
    const trimmed = line.trim()
    if (trimmed.length === 0) return

    if (contentIndex === 0) {
      blocks.push(
        `<p style="text-align: center; font-size: 16pt; font-weight: bold; margin: 0 0 4pt 0;">${escapeHtml(trimmed)}</p>`,
      )
      contentIndex += 1
      return
    }

    if (isHeadingLine(line)) {
      flushList()
      blocks.push(
        `<p style="font-size: 12pt; font-weight: bold; border-bottom: 1px solid #999; margin: 10pt 0 4pt 0;">${escapeHtml(trimmed)}</p>`,
      )
      contentIndex += 1
      return
    }

    const strippedBullet = stripBulletMarker(line).trim()
    if (strippedBullet !== trimmed && strippedBullet.length > 0) {
      listItems.push(`<li style="margin: 0 0 2pt 0;">${escapeHtml(strippedBullet)}</li>`)
      contentIndex += 1
      return
    }

    flushList()
    blocks.push(`<p style="margin: 0 0 2pt 0;">${escapeHtml(trimmed)}</p>`)
    contentIndex += 1
  })

  flushList()
  return `<div style="${BASE_STYLE}">${blocks.join('')}</div>`
}

export const copyResumeRichText = async (resumeText: string): Promise<void> => {
  const html = buildResumeHtml(resumeText)
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    await navigator.clipboard.writeText(resumeText)
    return
  }
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([resumeText], { type: 'text/plain' }),
    }),
  ])
}
