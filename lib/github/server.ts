/**
 * Public GitHub activity for the profile handle (content/site.json socials -> github).
 * Server only. Uses the GitHub public REST API, cached with ISR for 6 hours.
 *
 * Content rules applied here (BRIEF 2, CONTRACTS 7):
 * - only repositories owned by the handle (events on other people's repos could
 *   expose colleague names), no forks, never private, nothing on the exclusion list;
 * - no star or fork counts and no commit messages, ever;
 * - on any failure the result is `ok: false` and the UI says so. Nothing is estimated.
 */
import 'server-only'
import { z } from 'zod'
import { getSite, getSocials } from '@/lib/content'
import { makeExcluded, siteExcluded } from '@/lib/content/privacy'

export const GITHUB_REVALIDATE = 21600 // 6 h
export const WINDOW_DAYS = 84 // 12 weeks; the events API only covers ~90 days

/** Contract terms plus `site.privacy.excluded` (shared rule, lib/content/privacy). */
function makeSiteExcluded(): (text: string) => boolean {
  return makeExcluded(siteExcluded(getSite()))
}

export interface GhRepo {
  name: string
  url: string
  description: string
  language: string
  pushedAt: string
}

export interface GhEvent {
  id: string
  /** Short human verb, e.g. "Pushed to", "Opened pull request in". */
  verb: string
  repo: string
  repoUrl: string
  /** Branch / tag / ref when it adds meaning. */
  ref: string
  createdAt: string
}

export interface GhDay {
  /** YYYY-MM-DD (UTC). */
  date: string
  count: number
}

export interface GitHubActivity {
  ok: boolean
  handle: string
  profileUrl: string
  /** When GitHub produced the data (response Date header), ISO. null on failure. */
  fetchedAt: string | null
  /** Account creation date, ISO ('' when unknown). */
  since: string
  days: GhDay[]
  totals: { events: number; activeDays: number; repos: number }
  repos: GhRepo[]
  events: GhEvent[]
}

/* ---------- wire schemas (loose: GitHub adds fields freely) ---------- */

const UserWire = z.object({
  login: z.string(),
  html_url: z.string(),
  created_at: z.string().optional(),
})

const RepoWire = z.object({
  name: z.string(),
  html_url: z.string(),
  description: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  pushed_at: z.string().nullable().optional(),
  fork: z.boolean().optional(),
  private: z.boolean().optional(),
  archived: z.boolean().optional(),
  owner: z.object({ login: z.string() }),
})

const EventWire = z.object({
  id: z.string(),
  type: z.string().nullable(),
  public: z.boolean().optional(),
  created_at: z.string().nullable(),
  repo: z.object({ name: z.string() }),
  payload: z
    .object({
      action: z.string().optional(),
      ref: z.string().nullable().optional(),
      ref_type: z.string().optional(),
    })
    .passthrough()
    .optional(),
})

type EventWire = z.infer<typeof EventWire>

/* ---------- helpers ---------- */

/** The GitHub handle from the enabled github social (content), or ''. */
export function githubHandle(): string {
  const s = getSocials().find((x) => x.id === 'github' || x.icon === 'github')
  if (!s) return ''
  const fromUrl = /github\.com\/([A-Za-z0-9-]+)/.exec(s.url)?.[1] ?? ''
  const h = (s.handle || fromUrl).replace(/^@/, '')
  return /^[A-Za-z0-9-]{1,39}$/.test(h) ? h : ''
}

async function gh(path: string): Promise<{ data: unknown; date: string | null } | null> {
  const base: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ground-truth-press-portfolio',
  }
  const token = process.env.GITHUB_TOKEN
  const attempt = async (auth: boolean) =>
    fetch(`https://api.github.com${path}`, {
      headers: auth && token ? { ...base, Authorization: `Bearer ${token}` } : base,
      next: { revalidate: GITHUB_REVALIDATE, tags: ['github-activity'] },
      signal: AbortSignal.timeout(8000),
    })
  try {
    let res = await attempt(true)
    // A token scoped elsewhere can be refused; public data never needs it.
    if (token && (res.status === 401 || res.status === 403)) res = await attempt(false)
    if (!res.ok) return null
    return { data: await res.json(), date: res.headers.get('date') }
  } catch {
    return null
  }
}

const owned = (repoFullName: string, handle: string) =>
  repoFullName.split('/')[0]?.toLowerCase() === handle.toLowerCase()

function shortRef(ref: string | null | undefined) {
  return (ref ?? '').replace(/^refs\/(heads|tags)\//, '')
}

function describe(e: EventWire): { verb: string; ref: string } | null {
  const p = e.payload ?? {}
  const action = p.action ?? ''
  switch (e.type) {
    case 'PushEvent': return { verb: 'Pushed to', ref: shortRef(p.ref) }
    case 'CreateEvent':
      return p.ref_type === 'repository'
        ? { verb: 'Created repository', ref: '' }
        : { verb: `Created ${p.ref_type ?? 'ref'} in`, ref: shortRef(p.ref) }
    case 'DeleteEvent': return { verb: `Deleted ${p.ref_type ?? 'ref'} in`, ref: shortRef(p.ref) }
    case 'PullRequestEvent': return { verb: `${cap(action || 'updated')} pull request in`, ref: '' }
    case 'PullRequestReviewEvent': return { verb: 'Reviewed a pull request in', ref: '' }
    case 'PullRequestReviewCommentEvent': return { verb: 'Commented on a review in', ref: '' }
    case 'IssuesEvent': return { verb: `${cap(action || 'updated')} an issue in`, ref: '' }
    case 'IssueCommentEvent': return { verb: 'Commented on an issue in', ref: '' }
    case 'ReleaseEvent': return { verb: 'Published a release of', ref: '' }
    case 'PublicEvent': return { verb: 'Made public', ref: '' }
    default: return null // WatchEvent, ForkEvent, MemberEvent, ...: not shown
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const dayKey = (d: Date) => d.toISOString().slice(0, 10)

/** Empty day buckets ending today (UTC), oldest first. */
function emptyDays(now: Date): GhDay[] {
  const out: GhDay[] = []
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    out.push({ date: dayKey(new Date(now.getTime() - i * 86_400_000)), count: 0 })
  }
  return out
}

function fallback(handle: string, profileUrl: string): GitHubActivity {
  return {
    ok: false, handle, profileUrl, fetchedAt: null, since: '',
    days: [], totals: { events: 0, activeDays: 0, repos: 0 }, repos: [], events: [],
  }
}

/* ---------- main ---------- */

/** Public activity for the content handle. Never throws. */
export async function getGitHubActivity(): Promise<GitHubActivity> {
  const handle = githubHandle()
  const profileUrl = handle ? `https://github.com/${handle}` : ''
  if (!handle) return fallback(handle, profileUrl)

  const [userRes, reposRes, eventsRes] = await Promise.all([
    gh(`/users/${handle}`),
    gh(`/users/${handle}/repos?type=owner&sort=pushed&per_page=30`),
    gh(`/users/${handle}/events/public?per_page=100`),
  ])
  if (!reposRes) return fallback(handle, profileUrl)

  const user = UserWire.safeParse(userRes?.data)
  const repos = z.array(RepoWire).safeParse(reposRes?.data)
  const events = z.array(EventWire).safeParse(eventsRes?.data)
  // Without the repo list nothing can be vetted (forks, exclusions by description), so
  // showing raw events would risk leaking them: treat it as a failure.
  if (!repos.success) return fallback(handle, profileUrl)

  const isExcluded = makeSiteExcluded()
  const repoData = repos.data
  const showable = (r: z.infer<typeof RepoWire>) =>
    !r.fork && !r.private && !isExcluded(r.name) && !isExcluded(r.description ?? '')

  const repoList: GhRepo[] = repoData
    .filter((r) => showable(r) && !r.archived && owned(`${r.owner.login}/${r.name}`, handle))
    .map((r) => ({
      name: r.name,
      url: r.html_url,
      description: r.description ?? '',
      language: r.language ?? '',
      pushedAt: r.pushed_at ?? '',
    }))

  // Events count only for repos that pass the same checks as the repo list, so the feed,
  // day bars and list never disagree. Archived repos keep their (real, public) history.
  const vetted = new Set(repoData.filter(showable).map((r) => r.name.toLowerCase()))
  const eventList = (events.success ? events.data : []).filter((e) => {
    const name = e.repo.name.split('/')[1]?.toLowerCase() ?? ''
    return e.public !== false && owned(e.repo.name, handle) && !isExcluded(e.repo.name) && vetted.has(name)
  })

  const now = new Date(eventsRes?.date ?? reposRes?.date ?? Date.now())
  const days = emptyDays(now)
  const index = new Map(days.map((d, i) => [d.date, i]))
  for (const e of eventList) {
    if (!e.created_at) continue
    const i = index.get(e.created_at.slice(0, 10))
    if (i !== undefined) days[i]!.count += 1
  }

  const feed: GhEvent[] = []
  for (const e of eventList) {
    const d = describe(e)
    if (!d || !e.created_at) continue
    const repo = e.repo.name.split('/')[1] ?? e.repo.name
    // collapse consecutive pushes to the same repo on the same day
    const prev = feed[feed.length - 1]
    if (prev && prev.repo === repo && prev.verb === d.verb && prev.createdAt.slice(0, 10) === e.created_at.slice(0, 10)) continue
    // branch/tag names can carry client terms: drop excluded refs at the source
    feed.push({ id: e.id, verb: d.verb, ref: d.ref && !isExcluded(d.ref) ? d.ref : '', repo, repoUrl: `https://github.com/${e.repo.name}`, createdAt: e.created_at })
    if (feed.length >= 8) break
  }

  const date = eventsRes?.date ?? reposRes?.date ?? null
  return {
    ok: true,
    handle,
    profileUrl: user.success ? user.data.html_url : profileUrl,
    fetchedAt: date ? new Date(date).toISOString() : null,
    since: user.success ? (user.data.created_at ?? '') : '',
    days,
    totals: {
      events: days.reduce((a, d) => a + d.count, 0),
      activeDays: days.filter((d) => d.count > 0).length,
      repos: repoList.length,
    },
    repos: repoList.slice(0, 6),
    events: feed,
  }
}
