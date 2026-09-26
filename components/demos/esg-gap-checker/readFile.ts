/** Read .txt / .md / .pdf into plain text in the browser. pdfjs is loaded only when a PDF arrives. */
import { loadPdfjs } from '@/lib/pdf'

export interface ReadResult { text: string; pages?: number; truncated: boolean }

export async function readReportFile(file: File, maxChars: number): Promise<ReadResult> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf) {
    const text = (await file.text()).replace(/\r\n/g, '\n')
    return { text: text.slice(0, maxChars), truncated: text.length > maxChars }
  }
  // Worker is bundled from the installed package (no CDN), so PDF reading works offline.
  const pdfjs = await loadPdfjs()
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  let text = ''
  let page = 1
  let numPages = 0
  try {
    const doc = await openPdf(task.promise)
    numPages = doc.numPages
    for (; page <= doc.numPages && text.length < maxChars; page++) {
      const content = await (await doc.getPage(page)).getTextContent()
      const line = content.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join('')
      text += `${line.replace(/[ \t]+/g, ' ').trim()}\n\n`
    }
  } finally {
    await task.destroy()
  }
  const clean = text.trim()
  return { text: clean.slice(0, maxChars), pages: page - 1, truncated: clean.length > maxChars || page <= numPages }
}

/** Worker start-up failures and damaged files both reject here; give the reader a plain message. */
async function openPdf<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    throw new Error(`Could not start the PDF reader or open this file (${detail}). Try pasting the text instead.`)
  }
}
