/**
 * POST /api/admin/login. Owner: admin-core.
 * Accepts JSON ({ password, next }) from the login island, or a plain form post
 * (works without JavaScript: answers with a 303 redirect).
 * Failed attempts are rate limited per IP (5 / 15 min) and globally.
 */
import { NextResponse } from 'next/server'
import { safeNext } from '@/lib/admin/redirect'
import { clientIp, loginFailures, loginFailuresGlobal } from '@/lib/admin/rate-limit'
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

async function attempt(req: Request, password: string, next: string): Promise<Outcome> {
  const secret = sessionSecret()
  if (!process.env.ADMIN_PASSWORD || !secret) {
    return { ok: false, status: 503, code: 'unconfigured', message: 'Admin sign-in is not configured on this deployment (ADMIN_PASSWORD / ADMIN_SECRET).' }
  }
  const ip = clientIp(req.headers)
  const local = loginFailures.peek(ip)
  const global = loginFailuresGlobal.peek('*')
  if (!local.allowed || !global.allowed) {
    const retryAfterSec = Math.max(local.retryAfterSec, global.retryAfterSec)
    return { ok: false, status: 429, code: 'rate_limited', retryAfterSec, message: `Too many attempts. Try again in ${Math.ceil(retryAfterSec / 60)} min.` }
  }
  if (!password || password.length > MAX_PASSWORD) {
    return { ok: false, status: 400, code: 'bad_request', message: 'Enter the admin password.' }
  }

  if (await passwordMatches(password, process.env.ADMIN_PASSWORD)) {
    loginFailures.reset(ip)
    return { ok: true, next }
  }

  const after = loginFailures.hit(ip)
  loginFailuresGlobal.hit('*')
  await new Promise((r) => setTimeout(r, FAIL_DELAY_MS))
  if (!after.allowed) {
    return { ok: false, status: 429, code: 'rate_limited', retryAfterSec: after.retryAfterSec, message: `Too many attempts. Try again in ${Math.ceil(after.retryAfterSec / 60)} min.` }
  }
  return {
    ok: false,
    status: 401,
    code: 'invalid_password',
    remaining: after.remaining,
    message: `That password is not right. ${after.remaining} attempt${after.remaining === 1 ? '' : 's'} left before a pause.`,
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
