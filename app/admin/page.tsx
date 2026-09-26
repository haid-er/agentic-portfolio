/**
 * Admin dashboard: press status (deploying… / live), setup checks, every
 * collection with its counts and last save, the recent-saves ledger and uploads.
 * Owner: admin-core.
 */
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { getActivity, type ActivityCommit } from '@/lib/admin/activity'
import { timeAgo } from '@/lib/admin/format'
import { adminHealth } from '@/lib/admin/server'
import { collectionStats } from '@/lib/admin/stats'
import { DeployPanel } from '@/lib/admin/ui/DeployPanel'
import { UploadPanel } from '@/lib/admin/ui/UploadPanel'
import { listUploads, MAX_UPLOAD_BYTES, UPLOAD_ACCEPT, type UploadEntry } from '@/lib/admin/uploads'
import { COLLECTIONS, type CollectionName } from '@/lib/content'
import { folio } from '@/lib/utils'


/** Deep links into the Site editor's tabs (components/admin/editors/SiteEditor.tsx SITE_TABS). */
const SITE_TAB_LINKS = [
  { id: 'profile', label: 'Profile' },
  { id: 'hero', label: 'Hero & about' },
  { id: 'contact', label: 'Contact & links' },
  { id: 'sections', label: 'Section order' },
  { id: 'seo', label: 'SEO' },
] as const

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard' }

function SectionHead({ n, id, title, note }: { n: number; id: string; title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-s4 gap-y-s1 pt-s3 almanac:border-t-2 almanac:border-rule">
      <span className="display text-3 text-accent-ink nums" aria-hidden="true">{folio(n)}</span>
      <h2 id={id} className="m-0 display text-3">{title}</h2>
      {note ? <p className="m-0 w-full text-0 text-ink-2 measure">{note}</p> : null}
    </div>
  )
}

export default async function AdminHome() {
  const [activity, uploads] = await Promise.all([
    getActivity(),
    listUploads().catch((): UploadEntry[] => []),
  ])
  const health = adminHealth()
  const now = Date.parse(activity.checkedAt)

  // Last save per collection, from our "content(<name>): …" commit subjects.
  const lastSave = new Map<CollectionName, ActivityCommit>()
  for (const c of activity.commits) if (c.collection && !lastSave.has(c.collection)) lastSave.set(c.collection, c)

  const collections = Object.values(COLLECTIONS).map((c, i) => ({ ...c, n: i + 1, stats: collectionStats(c.name), last: lastSave.get(c.name) }))
  const problems = health.checks.filter((c) => !c.ok)

  return (
    <div className="grid gap-s8">
      <header className="grid gap-s3">
        <p className="m-0 mono text-ink-3">Press room / Dashboard</p>
        <h1 className="m-0 display text-4 md:text-5">Dashboard</h1>
        <p className="m-0 text-1 text-ink-2 measure">
          Everything on the site is set from these collections. Saving validates the content, commits it
          {activity.repo ? <> to <span className="mono text-ink">{activity.repo}</span></> : null}, and the site reprints itself.
        </p>
      </header>

      <div className="grid gap-s5 lg:grid-cols-[7fr_5fr] items-start">
        <Card as="section" feature layer={1} id="press-status" aria-label="Press status" className="scroll-mt-s6">
          <DeployPanel initial={activity} />
        </Card>

        <Card as="section" layer={4} aria-labelledby="setup-title" className="grid gap-s4">
          <div className="flex items-center justify-between gap-s3">
            <h2 id="setup-title" className="m-0 mono text-ink-3">Setup</h2>
            {problems.length ? <Badge tone="warn">{problems.length} to fix</Badge> : <Badge tone="ok">All set</Badge>}
          </div>
          <ul className="m-0 p-0 list-none grid gap-s3">
            {health.checks.map((c) => (
              <li key={c.id} className="grid grid-cols-[auto_1fr] gap-x-s3 gap-y-1 items-start">
                <Icon name={c.ok ? 'check' : 'alert'} size={18} className={c.ok ? 'text-ok mt-[2px]' : 'text-warn mt-[2px]'} />
                <p className="m-0 text-0">
                  <span className="mono text-ink">{c.id === 'store' ? 'Save target' : c.id === 'secret' ? 'Session key' : 'Password'}</span>{' '}
                  <span className={c.ok ? 'mono text-ok' : 'mono text-warn'}>{c.status}</span>
                  <span className="block text-ink-2">{c.detail}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section aria-labelledby="collections-title" className="grid gap-s5">
        <SectionHead n={1} id="collections-title" title="Collections" note="Each one is a JSON file in content/. Hidden and unverified items stay in admin and never render on the site." />
        <ul className="m-0 p-0 list-none grid gap-s4 md:grid-cols-2 xl:grid-cols-3">
          {collections.map((c) => (
            <li key={c.name} className="min-w-0">
              <Card as="article" layer={(((c.n - 1) % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6} className="group h-full flex flex-col gap-s3 transition-transform duration-[var(--dur-fast)] hover:-translate-y-[2px] focus-within:-translate-y-[2px] motion-reduce:transition-none">
                <p className="m-0 flex items-baseline justify-between gap-s3">
                  <span className="display text-2 text-accent-ink nums" aria-hidden="true">{folio(c.n)}</span>
                  <span className="mono text-ink-3">{c.file}</span>
                </p>
                <h3 className="m-0 display text-2">
                  <Link href={`/admin/${c.name}`} className="no-underline text-ink after:absolute after:inset-0 after:content-[''] group-hover:underline underline-offset-4">
                    {c.label}
                  </Link>
                </h3>
                <p className="m-0 text-0 text-ink-2">{c.description}</p>
                {c.name === 'site' ? (
                  <ul aria-label="Site editor tabs" className="relative z-[1] m-0 p-0 list-none flex flex-wrap gap-2">
                    {SITE_TAB_LINKS.map((t) => (
                      <li key={t.id}>
                        <Link href={`/admin/site?tab=${t.id}`} className="inline-flex items-center min-h-tap px-3 rounded-pill border border-rule mono text-ink no-underline hover:bg-bg-2">
                          {t.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {c.stats.line ? <p className="m-0 mono text-ink nums">{c.stats.line}</p> : null}
                <div className="flex flex-wrap items-center gap-s2 mt-auto pt-s2">
                  {c.stats.unverified ? <Badge tone="warn">{c.stats.unverified} unverified</Badge> : null}
                  {c.stats.hidden ? <Badge>{c.stats.hidden} hidden</Badge> : null}
                  {c.last ? (
                    <span className="mono text-ink-3">Saved {timeAgo(c.last.date, now)}</span>
                  ) : null}
                  <Icon name="arrow" size={16} className="ml-auto text-accent-ink transition-transform duration-[var(--dur-fast)] group-hover:translate-x-[3px] motion-reduce:transition-none" />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="saves-title" className="grid gap-s5">
        <SectionHead n={2} id="saves-title" title="Recent saves" note={activity.mode === 'github' ? `Commits touching content/ and public/uploads on ${activity.branch}.` : 'From this working tree’s git log.'} />
        {activity.error ? (
          <p role="alert" className="m-0 flex items-center gap-2 text-0 text-danger">
            <Icon name="alert" size={16} />
            GitHub could not be read: {activity.error}
          </p>
        ) : null}
        {activity.commits.length ? (
          <ol className="m-0 p-0 list-none grid border-t border-rule">
            {activity.commits.map((c) => (
              <li key={c.sha} className="grid gap-x-s4 gap-y-1 py-s3 border-b border-rule-soft md:grid-cols-[6rem_1fr_auto] items-baseline min-w-0">
                <span className="mono text-ink-3 nums">{timeAgo(c.date, now)}</span>
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {c.collection ? <span className="mono text-accent-ink mr-2">{COLLECTIONS[c.collection].label}</span> : null}
                  {c.upload ? <span className="mono text-accent-ink mr-2">Upload</span> : null}
                  <span className="text-0">{c.title}</span>
                </span>
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="mono text-ink-2 underline underline-offset-4 inline-flex items-center gap-1 min-h-tap md:min-h-0">
                    {c.shortSha}
                    <Icon name="arrow-up-right" size={12} />
                    <span className="sr-only">(opens GitHub)</span>
                  </a>
                ) : (
                  <span className="mono text-ink-3">{c.shortSha}</span>
                )}
              </li>
            ))}
          </ol>
        ) : !activity.error ? (
          <p className="m-0 text-0 text-ink-3">No saves yet. The first save from an editor shows up here.</p>
        ) : null}
      </section>

      <section aria-labelledby="uploads-title" className="grid gap-s5">
        <SectionHead
          n={3}
          id="uploads-title"
          title="Uploads"
          note="Images and PDFs go to public/uploads. Paste the copied path into any image or PDF field (the résumé PDF, a project image)."
        />
        <UploadPanel initial={uploads} accept={UPLOAD_ACCEPT} maxBytes={MAX_UPLOAD_BYTES} />
      </section>
    </div>
  )
}
