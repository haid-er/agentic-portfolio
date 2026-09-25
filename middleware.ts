/** Guards /admin/* and /api/admin/* with the signed session cookie. Owner: admin-core. */
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/admin/session'

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] }

const PUBLIC = ['/admin/login', '/api/admin/login']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some((p) => pathname === p)) return NextResponse.next()
  const ok = await verifySession(process.env.ADMIN_SECRET, req.cookies.get(SESSION_COOKIE)?.value)
  if (ok) return NextResponse.next()
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const url = req.nextUrl.clone()
  url.pathname = '/admin/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}
