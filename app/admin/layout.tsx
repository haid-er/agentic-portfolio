/**
 * Admin chrome (the site header/footer are hidden on /admin by PublicOnly).
 * Owner: admin-core.
 *
 * A compact masthead in the site's own print language: register mark, the
 * "Press room" name, a Collections index, the live deploy pill, the world
 * switch (to preview both themes) and sign-out. Signed-out visitors (the
 * login page) get the masthead only.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { ThemeSwitch } from '@/components/layout/ThemeSwitch'
import { WorldText } from '@/components/layout/WorldText'
import { Icon } from '@/components/ui/Icon'
import { getAdminSession } from '@/lib/admin/server'
import { CollectionsMenu } from '@/lib/admin/ui/CollectionsMenu'
import { DeployPill } from '@/lib/admin/ui/DeployPill'
import { COLLECTIONS, getTheme } from '@/lib/content'
import { themeLabels } from '@/lib/theme'
import { folio } from '@/lib/utils'

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin' },
  robots: { index: false, follow: false, nocache: true },
}

export const dynamic = 'force-dynamic'

const linkClasses =
  'mono inline-flex items-center gap-2 min-h-tap px-3 border border-transparent rounded-pill text-ink no-underline hover:border-rule'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession()
  const labels = themeLabels(getTheme())
  const entries = Object.values(COLLECTIONS).map((c, i) => ({ name: c.name, label: c.label, folio: folio(i + 1) }))

  return (
    <div className="min-h-dvh bg-bg text-ink">
      {/* Admin has no folio bar: toasts sit at the bottom on phones (editors raise it again). */}
      <style>{':root{--folio-bar:0px}'}</style>
      <header className="border-b border-rule bg-bg">
        <div className="wrap flex justify-between gap-s3 py-s1 mono text-ink-3 border-b border-rule-soft">
          <span>Admin · private</span>
          <span>
            Edition: <WorldText almanac={labels.almanac.label} strata={labels.strata.label} />
          </span>
        </div>
        <div className="wrap flex flex-wrap items-center gap-x-s3 gap-y-s2 py-s3">
          <Link
            href={session ? '/admin' : '/admin/login'}
            className="inline-flex items-center gap-2 min-h-tap pr-2 no-underline text-ink mr-auto"
          >
            <Icon name="register" size={24} className="text-accent-2" />
            <span className="display text-2">Press room</span>
          </Link>

          {session ? (
            <>
              <nav aria-label="Admin" className="order-last w-full md:order-none md:w-auto flex flex-wrap items-center gap-s2">
                <CollectionsMenu entries={entries} />
                <DeployPill />
                <Link href="/" className={linkClasses} target="_blank" rel="noopener noreferrer">
                  View site
                  <Icon name="arrow-up-right" size={14} />
                  <span className="sr-only">(opens in a new tab)</span>
                </Link>
              </nav>
              <ThemeSwitch labels={labels} compact />
              <form method="post" action="/api/admin/logout">
                <button type="submit" className={linkClasses}>
                  <Icon name="lock" size={16} />
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <ThemeSwitch labels={labels} compact />
              <Link href="/" className={linkClasses}>
                Back to site
                <Icon name="arrow" size={14} />
              </Link>
            </>
          )}
        </div>
      </header>
      <div className="wrap py-s6 md:py-s7">{children}</div>
    </div>
  )
}
