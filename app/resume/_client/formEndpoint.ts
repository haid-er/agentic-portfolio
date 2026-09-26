/**
 * Decides how the contact slip can deliver, from the admin-set endpoint.
 * Plain module (no "use client") so the server (Contact.tsx) and the client
 * (ContactForm) apply exactly the same rule.
 *
 * - An https URL with a hostname is a POST target, except Web3Forms without
 *   `?access_key=...` (every POST would fail with 400), which counts as unset.
 * - A `mailto:` endpoint names the recipient for mailto mode.
 * - Anything else ('/path', '#hash', 'tel:') is ignored.
 */
export const WEB3FORMS_HOST = 'api.web3forms.com'

/** Hostname (without www.) of a usable POST endpoint, or '' if it cannot be posted to. */
export function endpointHost(endpoint?: string): string {
  if (!endpoint) return ''
  let u: URL
  try { u = new URL(endpoint) } catch { return '' }
  if (u.protocol !== 'https:' || !u.hostname) return ''
  const host = u.hostname.replace(/^www\./, '')
  if (host === WEB3FORMS_HOST && !u.searchParams.get('access_key')) return ''
  return host
}

/** The address in a `mailto:` endpoint, or ''. */
export function endpointMailto(endpoint?: string): string {
  if (!endpoint || !/^mailto:/i.test(endpoint)) return ''
  const addr = decodeURIComponent(endpoint.slice(7).split('?')[0] ?? '').trim()
  return /^[^\s@]+@[^\s@]+$/.test(addr) ? addr : ''
}
