/**
 * Admin session: HMAC-SHA256 signed cookie (Web Crypto, edge + node safe). Owner: admin-core.
 * Cookie value: base64url(payload).base64url(sig), payload = { exp: epochSeconds }.
 */
export const SESSION_COOKIE = 'ghp_admin'
export const SESSION_TTL_SEC = 60 * 60 * 12

const enc = new TextEncoder()
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function key(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signSession(secret: string, ttlSec = SESSION_TTL_SEC): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSec })))
  const sig = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(payload))
  return `${payload}.${b64url(sig)}`
}

export async function verifySession(secret: string | undefined, token: string | undefined): Promise<boolean> {
  if (!secret || !token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  try {
    const ok = await crypto.subtle.verify('HMAC', await key(secret), fromB64url(sig), enc.encode(payload))
    if (!ok) return false
    const { exp } = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { exp: number }
    return typeof exp === 'number' && exp > Date.now() / 1000
  } catch {
    return false
  }
}
