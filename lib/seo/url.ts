/**
 * Canonical URL helpers. Owner: seo-theme.
 * The canonical origin is content/site.json `seo.siteUrl`, so preview deployments
 * still point search engines at production. Fallbacks: Vercel's production host,
 * then localhost for development.
 */
import { getSeo } from '@/lib/content'

function parseOrigin(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const u = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`)
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '')
  } catch {
    return undefined
  }
}

/** Absolute origin without a trailing slash, e.g. "https://example.vercel.app". */
export function siteUrl(): string {
  return (
    parseOrigin(getSeo().siteUrl) ??
    parseOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    'http://localhost:3000'
  )
}

/** "/playground" -> "https://…/playground". Absolute http(s) URLs pass through. */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//.test(path)) return path
  const p = path.startsWith('/') ? path : `/${path}`
  return p === '/' ? `${siteUrl()}/` : `${siteUrl()}${p}`
}

/** "https://example.vercel.app/x" -> "example.vercel.app" (for printed furniture). */
export function displayHost(url = siteUrl()): string {
  return url.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}
