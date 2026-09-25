/** Turn an uploaded image or PDF into a vision-ready data URL, entirely in the browser. */
import { imageToDataUrl } from '@/lib/ai'

export interface Prepared { dataUrl: string; note: string }

export async function prepareFile(file: File): Promise<Prepared> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (!isPdf) {
    if (!file.type.startsWith('image/')) throw new Error('Use a PNG, JPEG, WebP or PDF file.')
    const dataUrl = await imageToDataUrl(file, { maxSide: 1600 })
    return { dataUrl, note: `${file.name} · downscaled in your browser` }
  }
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const doc = await task.promise
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(3, 1600 / Math.max(base.width, base.height))
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvas, viewport }).promise
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not render the page'))), 'image/png'))
    const dataUrl = await imageToDataUrl(blob, { maxSide: 1600 })
    return { dataUrl, note: `${file.name} · page 1 of ${doc.numPages} rendered with pdf.js` }
  } finally {
    await task.destroy()
  }
}
