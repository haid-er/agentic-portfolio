/** /admin/login: the press-room door. Owner: admin-core. */
import type { Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { safeNext } from '@/lib/admin/redirect'
import { SESSION_TTL_SEC } from '@/lib/admin/session'
import { adminHealth } from '@/lib/admin/server'
import { getProfile } from '@/lib/content'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } }

type Search = Promise<Record<string, string | string[] | undefined>>

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const next = safeNext(one(sp.next))
  const error = one(sp.error)
  const health = adminHealth()
  const profile = getProfile()

  return (
    <div className="grid min-h-[calc(100dvh-160px)] place-items-center py-s7">
      <Card as="section" feature layer={2} className="w-full max-w-[30rem] grid gap-s6" aria-labelledby="login-title">
        <header className="grid gap-s3">
          <p className="m-0 flex justify-between gap-s3 mono text-ink-3 border-b border-rule-soft pb-s2">
            <span>Plate 0 · Press room</span>
            <span>Admin</span>
          </p>
          <h1 id="login-title" className="m-0 display text-4">Sign in</h1>
          {profile.name ? <p className="m-0 text-0 text-ink-2">{profile.name} · portfolio</p> : null}
        </header>

        {!health.canLogin ? (
          <div role="alert" className="grid gap-s2 p-s4 border border-danger rounded-1 bg-bg-2">
            <p className="m-0 flex items-center gap-2 font-semibold text-danger">
              <Icon name="alert" size={18} />
              Sign-in is not configured here
            </p>
            <ul className="m-0 pl-5 text-0 text-ink-2 grid gap-1">
              {health.checks
                .filter((c) => !c.ok && c.id !== 'store')
                .map((c) => (
                  <li key={c.id}>{c.detail}</li>
                ))}
            </ul>
          </div>
        ) : null}

        <LoginForm next={next} initialError={error} signedOut={one(sp.signedOut) === '1'} disabled={!health.canLogin} />

        <p className="m-0 flex items-center gap-2 text-00 text-ink-3 border-t border-rule-soft pt-s3">
          <Icon name="lock" size={14} />
          <span>Session cookie is httpOnly and HMAC-signed; {SESSION_TTL_SEC / 3600} hours, then sign in again.</span>
        </p>
      </Card>
    </div>
  )
}
