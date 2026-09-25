/**
 * Guards /admin/* and /api/admin/* with the signed session cookie. Owner: admin-core.
 *
 * - Pages without a valid session redirect to /admin/login?next=<path>.
 * - API routes without a valid session answer 401 JSON.
 * - Mutating API requests must come from this origin (CSRF guard on top of SameSite=Lax).
 * - A signed-in visit to /admin/login goes straight to the dashboard.
 * - Everything under /admin is private and never cached.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { safeNext } from '@/lib/admin/redirect'
import { SESSION_COOKIE, sessionSecret, verifySession } from '@/lib/admin/session'

export const config = { matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'] }

const PUBLIC = new Set(['/admin/login', '/api/admin/login', '/api/admin/logout'])
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  // Browsers always send Origin on cross-site POSTs; its absence means a non-browser client.
  if (!origin) return req.headers.get('sec-fetch-site') !== 'cross-site'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function privateHeaders(res: NextResponse): NextResponse {
  res.headers.set('Cache-Control', 'no-store')
  res.headers.set('X-Robots-Tag', 'noindex, nofollow')
  return res
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isApi = pathname.startsWith('/api/')

  if (isApi && !SAFE_METHODS.has(req.method) && !sameOrigin(req)) {
    return privateHeaders(NextResponse.json({ ok: false, code: 'forbidden', message: 'Cross-origin request refused.' }, { status: 403 }))
  }

  const signedIn = await verifySession(sessionSecret(), req.cookies.get(SESSION_COOKIE)?.value)

  if (PUBLIC.has(pathname)) {
    if (signedIn && pathname === '/admin/login') {
      const url = req.nextUrl.clone()
      url.pathname = safeNext(req.nextUrl.searchParams.get('next'))
      url.search = ''
      return privateHeaders(NextResponse.redirect(url))
    }
    return privateHeaders(NextResponse.next())
  }

  if (signedIn) return privateHeaders(NextResponse.next())

  if (isApi) {
    return privateHeaders(NextResponse.json({ ok: false, code: 'unauthorized', message: 'Sign in first.' }, { status: 401 }))
  }
  const url = req.nextUrl.clone()
  url.pathname = '/admin/login'
  url.search = ''
  if (pathname !== '/admin') url.searchParams.set('next', safeNext(pathname))
  return privateHeaders(NextResponse.redirect(url))
}
