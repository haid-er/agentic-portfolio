/**
 * Live GitHub activity for the public profile (ISR 6 h via lib/github/server.ts).
 *
 * A "deposition log": 12 weeks of public events drawn as sediment bars, newest on the
 * right, then the most recently pushed public repositories and the latest events.
 * No star counts, no private repos, no commit messages. On failure it says so and
 * links to the profile. Nothing is estimated.
 */
import { ButtonLink, Card, Icon, SectionShell, Tag, type Layer } from '@/components/ui'
import { getGitHubActivity, githubHandle, WINDOW_DAYS, type GhDay, type GitHubActivity as Activity } from '@/lib/github/server'
import { getSite } from '@/lib/content'
import { makeExcluded, siteExcluded } from '@/lib/content/privacy'
import type { SectionProps } from './types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
type Fmt = (d: Date) => string
/** UTC formatters (stable across ICU versions: always "Sep", never "Sept"). */
const fmtDay: Fmt = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
const fmtDate: Fmt = (d) => `${fmtDay(d)} ${d.getUTCFullYear()}`
const fmtMonth: Fmt = (d) => MONTHS[d.getUTCMonth()]!

const safe = (f: Fmt, iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : f(d)
}
const utcStamp = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC, ${fmtDay(d)}`
}
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/* ---------- deposition strip (single series: one ink, no legend) ---------- */

const BAR = 6 // viewBox units per day
const H = 80

function DepositionStrip({ days }: { days: GhDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const busiest = days.reduce<GhDay | null>((a, d) => (d.count > (a?.count ?? 0) ? d : a), null)
  const first = days[0]
  const last = days[days.length - 1]
  const summary = busiest
    ? `Public events per day, ${safe(fmtDay, first!.date)} to ${safe(fmtDay, last!.date)}. Busiest day ${safe(fmtDay, busiest.date)} with ${plural(busiest.count, 'event')}.`
    : 'No public events in this window.'
  const months = days
    .map((d, i) => ({ d, i }))
    .filter(({ d, i }) => d.date.endsWith('-01') || i === 0)
    .filter(({ i }, k, arr) => k === 0 || i - arr[k - 1]!.i > 10)
  const weeks: Array<{ start: string; count: number }> = []
  for (let i = 0; i < days.length; i += 7) {
    const slice = days.slice(i, i + 7)
    weeks.push({ start: slice[0]!.date, count: slice.reduce((a, d) => a + d.count, 0) })
  }

  return (
    <figure className="m-0 grid gap-2">
      <div className="relative bg-surface border border-rule strata:rounded-1 strata:border-rule-soft px-s3 pt-s4 pb-s2">
        <svg
          viewBox={`0 0 ${days.length * BAR} ${H + 2}`}
          preserveAspectRatio="none"
          className="block w-full h-[88px] md:h-[112px]"
          role="img"
          aria-label={summary}
        >
          {[0.5, 1].map((f) => (
            <line key={f} x1="0" x2={days.length * BAR} y1={H - H * f} y2={H - H * f} stroke="var(--rule-soft)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="2 3" />
          ))}
          {days.map((d, i) => {
            const h = d.count ? Math.max(4, (d.count / max) * (H - 4)) : 1.5
            return (
              <g key={d.date}>
                <title>{`${safe(fmtDay, d.date)}: ${plural(d.count, 'public event')}`}</title>
                {/* hit target taller than the mark */}
                <rect x={i * BAR} y="0" width={BAR} height={H} fill="transparent" />
                <rect
                  x={i * BAR + 1}
                  y={H - h}
                  width={BAR - 2}
                  height={h}
                  rx="1"
                  fill={d.count ? 'var(--data-1)' : 'var(--rule-soft)'}
                />
              </g>
            )
          })}
          <line x1="0" x2={days.length * BAR} y1={H + 1} y2={H + 1} stroke="var(--rule)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="relative h-5 mt-1" aria-hidden="true">
          {months.map(({ d, i }) => (
            <span key={d.date} className="mono absolute top-0 text-ink-3 whitespace-nowrap" style={{ left: `${(i / days.length) * 100}%` }}>
              {safe(fmtMonth, d.date)}
            </span>
          ))}
          <span className="mono absolute top-0 right-0 text-ink-3 bg-surface pl-2">Today</span>
        </div>
      </div>
      <figcaption className="mono text-ink-3">Public events per day · max {max} · {WINDOW_DAYS / 7} weeks</figcaption>
      <table className="sr-only">
        <caption>Public events per week</caption>
        <thead><tr><th scope="col">Week starting</th><th scope="col">Events</th></tr></thead>
        <tbody>
          {weeks.map((w) => <tr key={w.start}><td>{safe(fmtDay, w.start)}</td><td>{w.count}</td></tr>)}
        </tbody>
      </table>
    </figure>
  )
}

/* ---------- lists ---------- */

function Repos({ repos }: { repos: Activity['repos'] }) {
  if (!repos.length) return null
  return (
    <div className="grid gap-s4 content-start">
      <h3 className="mono text-ink-3 font-normal [font-variation-settings:normal] [font-stretch:100%]">Recently pushed</h3>
      <ul className="m-0 p-0 list-none grid gap-s4 xs:grid-cols-2">
        {repos.map((r, i) => (
          <li key={r.name} className="grid">
            <Card layer={((i % 6) + 1) as Layer} padded={false} className="p-s4 grid gap-2 content-start">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="mono text-ink inline-flex items-center gap-2 min-h-tap no-underline hover:text-accent-ink [overflow-wrap:anywhere]">
                <Icon name="github" size={16} />
                <span className="underline decoration-rule-soft underline-offset-4">{r.name}</span>
                <Icon name="arrow-up-right" size={14} />
              </a>
              {r.description ? <p className="m-0 text-0 text-ink-2">{r.description}</p> : null}
              <p className="m-0 flex flex-wrap items-center gap-2 mt-auto">
                {r.language ? <Tag>{r.language}</Tag> : null}
                {r.pushedAt ? (
                  <span className="mono text-ink-3">Pushed <time dateTime={r.pushedAt}>{safe(fmtDate, r.pushedAt)}</time></span>
                ) : null}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Feed({ events }: { events: Activity['events'] }) {
  if (!events.length) return null
  // Branch and tag names can carry client terms; never print an excluded one (CONTRACTS 7).
  const isExcluded = makeExcluded(siteExcluded(getSite()))
  return (
    <div className="grid gap-s4 content-start">
      <h3 className="mono text-ink-3 font-normal [font-variation-settings:normal] [font-stretch:100%]">Latest public events</h3>
      <ol className="m-0 p-0 list-none border-t border-rule">
        {events.map((e) => (
          <li key={e.id} className="grid grid-cols-[4.2rem_1fr] gap-x-3 py-s3 border-b border-rule-soft">
            <time dateTime={e.createdAt} className="mono nums text-accent-ink pt-[3px]">{safe(fmtDay, e.createdAt)}</time>
            <p className="m-0 text-0 text-ink-2 min-w-0 [overflow-wrap:anywhere]">
              {e.verb}{' '}
              <a href={e.repoUrl} target="_blank" rel="noopener noreferrer" className="mono text-ink underline decoration-accent-ink underline-offset-4 hover:text-accent-ink">
                {e.repo}
              </a>
              {e.ref && !isExcluded(e.ref) ? <> <Tag className="ml-1 align-middle">{e.ref}</Tag></> : null}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col-reverse gap-1 border-l-2 border-accent pl-s3">
      <dt className="mono text-ink-3">{label}</dt>
      <dd className="m-0 display text-4 nums leading-none">{value}</dd>
    </div>
  )
}

/* ---------- section ---------- */

/** Fallback heading when the admin leaves the section title empty. */
export const DEFAULT_TITLE = 'On GitHub'

/** The same test as this section's early `return null` (used by the nav and index). */
/** Same test as the component's `!data.handle` (getGitHubActivity takes its handle from githubHandle()). */
export const shouldRender = (): boolean => Boolean(githubHandle())

export default async function GitHubActivity({ section, folio }: SectionProps) {
  const data = await getGitHubActivity()
  if (!data.handle) return null
  const profile = (
    <ButtonLink href={data.profileUrl} variant="secondary" size="sm" icon="github" arrow>
      github.com/{data.handle}
    </ButtonLink>
  )

  return (
    <SectionShell id={section.id} folio={folio} title={section.title || DEFAULT_TITLE} note={section.note} aside={profile}>
      {data.ok ? (
        <div className="grid gap-s7">
          <div className="grid gap-s5">
            <dl className="m-0 flex flex-wrap gap-x-s6 gap-y-s4">
              <Stat value={data.totals.events} label="Public events" />
              <Stat value={data.totals.activeDays} label="Active days" />
              {data.since ? <Stat value={data.since.slice(0, 4)} label="On GitHub since" /> : null}
            </dl>
            <DepositionStrip days={data.days} />
          </div>
          {data.repos.length || data.events.length ? (
            <div className="grid gap-s7 mid:grid-cols-12 mid:gap-s6">
              <div className="mid:col-span-7 min-w-0"><Repos repos={data.repos} /></div>
              <div className="mid:col-span-5 min-w-0"><Feed events={data.events} /></div>
            </div>
          ) : null}
          <p className="mono m-0 text-ink-3 flex flex-wrap gap-x-3 gap-y-1">
            <span>Source: GitHub public REST API</span>
            {data.fetchedAt ? <span>· as of <time dateTime={data.fetchedAt}>{utcStamp(data.fetchedAt)}</time></span> : null}
            <span>· refreshed every 6 h</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 p-s5 border border-dashed border-rule rounded-1 bg-surface measure">
          <p className="m-0 flex items-center gap-2 font-semibold text-ink">
            <Icon name="flat" size={22} className="text-ink-3" />
            Feed unavailable. Nothing is estimated.
          </p>
          <p className="m-0 text-0 text-ink-2">The GitHub public API did not answer this time. The profile itself is one click away.</p>
          {profile}
        </div>
      )}
    </SectionShell>
  )
}
