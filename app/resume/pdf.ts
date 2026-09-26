/**
 * Résumé PDF resolution (server only). The admin uploads a PDF to
 * public/uploads/ and stores its path in content/resume.json `pdfUrl`.
 * A site-relative path is only used when the file really exists at build time,
 * so a stale path falls back to printing /resume instead of a 404.
 */
import 'server-only'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { getResume } from '@/lib/content'

export function resumePdfUrl(): string | undefined {
  const url = getResume().pdfUrl.trim()
  if (!url) return undefined
  if (/^https?:\/\//.test(url)) return url
  if (!url.startsWith('/') || url.includes('..')) return undefined
  try {
    return existsSync(join(process.cwd(), 'public', url)) ? url : undefined
  } catch {
    return undefined
  }
}

/** Where "Download PDF" points: the uploaded file, or /resume?print=1 (auto-opens the print dialog). */
export function resumeDownloadHref(): { href: string; kind: 'pdf' | 'print' } {
  const pdf = resumePdfUrl()
  return pdf ? { href: pdf, kind: 'pdf' } : { href: '/resume?print=1', kind: 'print' }
}
