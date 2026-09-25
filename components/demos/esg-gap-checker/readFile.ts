/** Read .txt / .md / .pdf into plain text in the browser. pdfjs is loaded only when a PDF arrives. */

export interface ReadResult { text: string; pages?: number; truncated: boolean }

export async function readReportFile(file: File, maxChars: number): Promise<ReadResult> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf) {
    const text = (await file.text()).replace(/\r\n/g, '\n')
    return { text: text.slice(0, maxChars), truncated: text.length > maxChars }
  }
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await task.promise
  let text = ''
  let page = 1
  const numPages = doc.numPages
  try {
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
