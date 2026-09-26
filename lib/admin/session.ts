/**
 * Admin session: HMAC-SHA256 signed cookie (Web Crypto, edge + node safe). Owner: admin-core.
 *
 * Cookie value: base64url(payload).base64url(sig)
 *   payload = { v: 1, iat: epochSeconds, exp: epochSeconds, n: nonce }
 *
 * Nothing here touches Node APIs, so middleware (edge) and route handlers
 * (node) share one implementation. Rotating ADMIN_SECRET signs everyone out.
 */
export const SESSION_COOKIE = 'ghp_admin'
export const SESSION_TTL_SEC = 60 * 60 * 12

/** Used only by `next dev` when ADMIN_SECRET is unset, so local work needs one env var. */
const DEV_FALLBACK_SECRET = 'ghp-dev-only-admin-secret-never-used-in-production'
const MAX_TOKEN_LENGTH = 512

const enc = new TextEncoder()
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

interface SessionPayload {
  v: 1
  iat: number
  exp: number
  n: string
}

async function key(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/**
 * The signing secret. ADMIN_SECRET in every real environment; a fixed,
 * clearly-named fallback only under `next dev`. Returns undefined when unset
 * in production, which makes every session invalid (fail closed).
 */
export function sessionSecret(): string | undefined {
  const s = process.env.ADMIN_SECRET
  if (s && s.length >= 16) return s
  if (process.env.NODE_ENV === 'development') return DEV_FALLBACK_SECRET
  return undefined
}

/** True when the dev fallback secret is in use (shown as a warning in admin). */
export const usingDevSecret = () => sessionSecret() === DEV_FALLBACK_SECRET

export async function signSession(secret: string, ttlSec = SESSION_TTL_SEC): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(9)))
  const body: SessionPayload = { v: 1, iat: now, exp: now + ttlSec, n: nonce }
  const payload = b64url(enc.encode(JSON.stringify(body)))
  const sig = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(payload))
  return `${payload}.${b64url(sig)}`
}

/** Constant-time signature check (subtle.verify) + expiry. Never throws. */
export async function verifySession(secret: string | undefined, token: string | undefined): Promise<boolean> {
  return (await readSession(secret, token)) !== null
}

/** Like verifySession, but returns the payload (issued-at / expiry) for the admin shell. */
export async function readSession(
  secret: string | undefined,
  token: string | undefined,
): Promise<{ iat: number; exp: number } | null> {
  if (!secret || !token || token.length > MAX_TOKEN_LENGTH) return null
  const [payload, sig, extra] = token.split('.')
  if (!payload || !sig || extra !== undefined) return null
  try {
    const sigBytes = fromB64url(sig)
    // Canonical encoding only: no alternate spellings of the same signature.
    if (b64url(sigBytes) !== sig) return null
    const ok = await crypto.subtle.verify('HMAC', await key(secret), sigBytes, enc.encode(payload))
    if (!ok) return null
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as Partial<SessionPayload>
    if (typeof data.exp !== 'number' || data.exp <= Date.now() / 1000) return null
    return { iat: typeof data.iat === 'number' ? data.iat : data.exp - SESSION_TTL_SEC, exp: data.exp }
  } catch {
    return null
  }
}

/**
 * Constant-time password comparison: both sides are HMAC'd with a per-call
 * random key, so neither length nor content leaks through timing.
 */
export async function passwordMatches(given: string, expected: string | undefined): Promise<boolean> {
  if (!expected) return false
  const k = await crypto.subtle.importKey(
    'raw',
    crypto.getRandomValues(new Uint8Array(32)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const [a, b] = await Promise.all([
    crypto.subtle.sign('HMAC', k, enc.encode(given)),
    crypto.subtle.sign('HMAC', k, enc.encode(expected)),
  ])
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!
  return diff === 0
}

/** Cookie attributes shared by login and logout. */
export function sessionCookieOptions(maxAge = SESSION_TTL_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}
