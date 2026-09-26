/**
 * POST /api/admin/login. Owner: admin-core.
 * Accepts JSON ({ password, next }) from the login island, or a plain form post
 * (works without JavaScript: answers with a 303 redirect).
 * Attempts are counted before the password check (per IP, 5 / 15 min) and
 * failures globally; a success clears the IP's count.
 */
import { NextResponse } from 'next/server'
import { safeNext } from '@/lib/admin/redirect'
import { clientIp, LOGIN_FAILURE_LIMIT as LOCAL_LIMIT, loginFailures, loginFailuresGlobal } from '@/lib/admin/rate-limit'
import { passwordMatches, SESSION_COOKIE, sessionCookieOptions, sessionSecret, signSession } from '@/lib/admin/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_PASSWORD = 256
const FAIL_DELAY_MS = 350

type Outcome =
  | { ok: true; next: string }
  | { ok: false; status: number; code: 'invalid_password' | 'rate_limited' | 'unconfigured' | 'bad_request'; message: string; retryAfterSec?: number; remaining?: number }

async function readCredentials(req: Request): Promise<{ password: string; next: string; form: boolean }> {
  const type = req.headers.get('content-type') ?? ''
  if (type.includes('application/json')) {
    const j = (await req.json().catch(() => ({}))) as { password?: unknown; next?: unknown }
    return { password: typeof j.password === 'string' ? j.password : '', next: safeNext(j.next), form: false }
  }
  const f = await req.formData().catch(() => null)
  const pw = f?.get('password')
  return { password: typeof pw === 'string' ? pw : '', next: safeNext(f?.get('next')), form: true }
}

function rateLimited(retryAfterSec: number): Outcome {
  return { ok: false, status: 429, code: 'rate_limited', retryAfterSec, message: `Too many attempts. Try again in ${Math.ceil(retryAfterSec / 60)} min.` }
}

async function attempt(req: Request, password: string, next: string): Promise<Outcome> {
  const secret = sessionSecret()
  if (!process.env.ADMIN_PASSWORD || !secret) {
    return { ok: false, status: 503, code: 'unconfigured', message: 'Admin sign-in is not configured on this deployment (ADMIN_PASSWORD / ADMIN_SECRET).' }
  }
  if (!password || password.length > MAX_PASSWORD) {
    return { ok: false, status: 400, code: 'bad_request', message: 'Enter the admin password.' }
  }

  // Check and count synchronously, before any await, so parallel requests see
  // each other's attempts (no burst slips past the limit while hashing).
  const ip = clientIp(req.headers)
  const local = loginFailures.peek(ip)
  const global = loginFailuresGlobal.peek('*')
  // The global ceiling only refuses IPs that already failed: a distributed
  // attacker cannot lock the owner out, and gets at most one guess per IP.
  const globalBlocks = !global.allowed && local.remaining < LOCAL_LIMIT
  if (!local.allowed || globalBlocks) {
    return rateLimited(Math.max(local.retryAfterSec, globalBlocks ? global.retryAfterSec : 0))
  }
  const after = loginFailures.hit(ip)
  loginFailuresGlobal.hit('*')

  if (await passwordMatches(password, process.env.ADMIN_PASSWORD)) {
    loginFailures.reset(ip)
    loginFailuresGlobal.undo('*')
    return { ok: true, next }
  }

  await new Promise((r) => setTimeout(r, FAIL_DELAY_MS))
  if (!after.allowed) return rateLimited(after.retryAfterSec)
  // Under the global ceiling this IP now has a failure, so it is paused next time.
  const remaining = loginFailuresGlobal.peek('*').allowed ? after.remaining : 0
  return {
    ok: false,
    status: 401,
    code: 'invalid_password',
    remaining,
    message: `That password is not right. ${remaining} attempt${remaining === 1 ? '' : 's'} left before a pause.`,
  }
}

export async function POST(req: Request): Promise<Response> {
  const { password, next, form } = await readCredentials(req)
  const out = await attempt(req, password, next)

  if (out.ok) {
    const token = await signSession(sessionSecret()!)
    const res = form
      ? NextResponse.redirect(new URL(out.next, req.url), 303)
      : NextResponse.json({ ok: true, next: out.next }, { headers: { 'Cache-Control': 'no-store' } })
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
    return res
  }

  const headers: Record<string, string> = { 'Cache-Control': 'no-store' }
  if (out.retryAfterSec) headers['Retry-After'] = String(out.retryAfterSec)
  if (form) {
    const url = new URL('/admin/login', req.url)
    url.searchParams.set('error', out.code)
    if (next !== '/admin') url.searchParams.set('next', next)
    return NextResponse.redirect(url, { status: 303, headers })
  }
  const { ok: _ok, status, ...body } = out
  return NextResponse.json({ ok: false, ...body }, { status, headers })
}
