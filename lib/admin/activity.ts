/**
 * Dashboard activity: recent content commits and the deploy state.
 * Owner: admin-core. Server only.
 *
 * Deploy state compares the commit this deployment was built from
 * (VERCEL_GIT_COMMIT_SHA) with the branch head on GitHub. When they differ,
 * Vercel is building (or failed to build) the newer commit.
 */
import 'server-only'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { COLLECTION_NAMES, type CollectionName } from '@/lib/content/schema'
import { branchHead, githubConfig, listCommits, type CommitInfo } from './github'
import { saveMode, type SaveMode } from './store'

export interface ActivityCommit {
  sha: string
  shortSha: string
  /** First line of the message. */
  title: string
  date: string
  author: string
  url?: string
  /** Parsed from our "content(<name>): …" convention. */
  collection?: CollectionName
  upload?: boolean
}

export type DeployState =
  /** The live site was built from the branch head. */
  | 'live'
  /** A newer commit is on the branch; Vercel should be building it. */
  | 'deploying'
  /** A newer commit has waited longer than expected: the build may have failed. */
  | 'stalled'
  /** Local dev / not on Vercel / preview of another branch: nothing to track. */
  | 'untracked'

export interface DeployStatus {
  state: DeployState
  branch?: string
  deployedSha?: string
  headSha?: string
  headTitle?: string
  headDate?: string
  headUrl?: string
  /** Seconds since the head commit was made (deploying / stalled). */
  waitingSec?: number
}

export interface Activity {
  mode: SaveMode | null
  repo?: string
  branch?: string
  commits: ActivityCommit[]
  deploy: DeployStatus
  /** Honest failure note when GitHub could not be read. */
  error?: string
  checkedAt: string
}

/** A redeploy normally takes 1-2 minutes; after this we say it may have failed. */
const STALL_AFTER_SEC = 8 * 60

const COLLECTION_RE = /^content\(([a-z]+)\):/

function toActivity(c: CommitInfo): ActivityCommit {
  const title = c.message.split('\n')[0] ?? ''
  const m = COLLECTION_RE.exec(title)
  const name = m?.[1]
  return {
    sha: c.sha,
    shortSha: c.sha.slice(0, 7),
    title,
    date: c.date,
    author: c.author,
    url: c.url || undefined,
    collection: name && (COLLECTION_NAMES as readonly string[]).includes(name) ? (name as CollectionName) : undefined,
    upload: title.startsWith('uploads:'),
  }
}

let cache: { at: number; value: Activity } | null = null
const CACHE_MS = 10_000

/** Cached for 10 s per instance so polling never burns the GitHub rate limit. */
export async function getActivity(opts: { fresh?: boolean } = {}): Promise<Activity> {
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.value
  const value = await loadActivity()
  cache = { at: Date.now(), value }
  return value
}

async function loadActivity(): Promise<Activity> {
  const mode = saveMode()
  const checkedAt = new Date().toISOString()
  const cfg = githubConfig()

  if (!cfg) {
    const commits = await localCommits()
    return { mode, commits, deploy: { state: 'untracked' }, checkedAt }
  }

  try {
    const [content, uploads, head] = await Promise.all([
      listCommits(cfg, { path: 'content', perPage: 12 }),
      listCommits(cfg, { path: 'public/uploads', perPage: 5 }),
      branchHead(cfg),
    ])
    const commits = [...content, ...uploads]
      .filter((c, i, all) => all.findIndex((x) => x.sha === c.sha) === i)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 12)
      .map(toActivity)
    return { mode, repo: cfg.repo, branch: cfg.branch, commits, deploy: deployStatus(cfg.branch, head), checkedAt }
  } catch (e) {
    return {
      mode,
      repo: cfg.repo,
      branch: cfg.branch,
      commits: [],
      deploy: { state: 'untracked', branch: cfg.branch },
      error: e instanceof Error ? e.message : 'GitHub could not be read',
      checkedAt,
    }
  }
}

function deployStatus(branch: string, head: CommitInfo): DeployStatus {
  const deployedSha = process.env.VERCEL_GIT_COMMIT_SHA
  const deployedRef = process.env.VERCEL_GIT_COMMIT_REF
  const base: DeployStatus = {
    state: 'untracked',
    branch,
    deployedSha,
    headSha: head.sha,
    headTitle: head.message.split('\n')[0],
    headDate: head.date,
    headUrl: head.url,
  }
  // Only a deployment of the save branch can tell whether that branch is live.
  if (!deployedSha || deployedRef !== branch) return base
  if (deployedSha === head.sha) return { ...base, state: 'live' }
  const waitingSec = Math.max(0, Math.round((Date.now() - Date.parse(head.date)) / 1000))
  return { ...base, state: waitingSec > STALL_AFTER_SEC ? 'stalled' : 'deploying', waitingSec }
}

const run = promisify(execFile)

/** Local dev: read the working tree's git log (best effort, silent on failure). */
async function localCommits(): Promise<ActivityCommit[]> {
  if (process.env.VERCEL) return []
  try {
    const { stdout } = await run(
      'git',
      ['log', '-n', '12', '--format=%H%x1f%an%x1f%aI%x1f%s', '--', 'content', 'public/uploads'],
      { cwd: process.cwd(), timeout: 3000 },
    )
    return stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha = '', author = '', date = '', title = ''] = line.split('\x1f')
        return toActivity({ sha, author, date, message: title, url: '' })
      })
  } catch {
    return []
  }
}
