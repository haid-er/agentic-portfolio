/** POST /api/admin/logout: clears the session cookie. Form posts get a 303 to the login page. Owner: admin-core. */
import { NextResponse } from 'next/server'
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/admin/session'

export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const wantsJson = (req.headers.get('accept') ?? '').includes('application/json')
  const res = wantsJson
    ? NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
    : NextResponse.redirect(new URL('/admin/login?signedOut=1', req.url), 303)
  res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0))
  return res
}
