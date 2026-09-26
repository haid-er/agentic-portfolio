/**
 * Lazy pdf.js loader for browser demos (org-chart-extractor, esg-gap-checker).
 * The worker is bundled from the installed package (webpack 5 asset via
 * `new URL(..., import.meta.url)`), not fetched from a CDN, so PDF reading works
 * offline and under a strict CSP.
 */
import type * as PdfjsModule from 'pdfjs-dist'

type Pdfjs = typeof PdfjsModule

let loading: Promise<Pdfjs> | null = null

export function loadPdfjs(): Promise<Pdfjs> {
  loading ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    return pdfjs
  }).catch((e: unknown) => {
    loading = null
    throw e
  })
  return loading
}
