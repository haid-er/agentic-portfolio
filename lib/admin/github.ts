/**
 * Minimal GitHub REST client for the admin save pipeline (fetch only, no SDK).
 * Owner: admin-core. Server only: it reads GITHUB_TOKEN.
 *
 * Uses the Contents API with sha handling (optimistic concurrency):
 *   GET  /repos/{repo}/contents/{path}?ref={branch}  -> current sha (+ content)
 *   PUT  /repos/{repo}/contents/{path}               -> commit (sha required to update)
 * A fine-grained token with "Contents: read and write" on this repo is enough.
 */
import 'server-only'

export interface GithubConfig {
  token: string
  repo: string
  branch: string
}

export interface RemoteFile {
  sha: string
  /** Raw bytes; empty for files over 1 MB (the API omits content, the sha is still exact). */
  bytes: Buffer
  size: number
}

export interface CommitInfo {
  sha: string
  message: string
  date: string
  author: string
  url: string
}

export type GithubErrorCode = 'conflict' | 'auth' | 'not_found' | 'rate_limited' | 'upstream'

export class GithubError extends Error {
  readonly status: number
  readonly code: GithubErrorCode

  constructor(message: string, status: number, code: GithubErrorCode = 'upstream') {
    super(message)
    this.status = status
    this.code = code
  }
}

const API = 'https://api.github.com'
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

/** null when saving to GitHub is not configured (then dev writes to disk). */
export function githubConfig(): GithubConfig | null {
  const token = process.env.GITHUB_TOKEN?.trim()
  const repo = process.env.GITHUB_REPO?.trim()
  if (!token || !repo || !REPO_RE.test(repo)) return null
  return { token, repo, branch: process.env.GITHUB_BRANCH?.trim() || 'main' }
}

/** Repo path segments are encoded one by one so "/" stays a separator. */
const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/')

async function gh<T>(cfg: GithubConfig, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}/repos/${cfg.repo}${path}`, {
      ...init,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'agentic-portfolio-admin',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError'
    throw new GithubError(timedOut ? 'GitHub did not answer in time' : 'Could not reach GitHub', 504)
  }
  if (res.ok) return (await res.json()) as T

  const detail = await res.json().then((j: { message?: string }) => j.message ?? '').catch(() => '')
  if (res.status === 401 || res.status === 403) {
    const limited = res.headers.get('x-ratelimit-remaining') === '0'
    throw new GithubError(
      limited ? 'GitHub API rate limit reached; try again shortly' : `GitHub refused the token (${detail || res.status}). Check GITHUB_TOKEN has Contents: read and write on ${cfg.repo}.`,
      res.status,
      limited ? 'rate_limited' : 'auth',
    )
  }
  if (res.status === 404) throw new GithubError(`Not found on GitHub: ${detail || path}`, 404, 'not_found')
  // 409: branch moved / sha mismatch. 422 with "sha" in the message is the same thing.
  if (res.status === 409 || (res.status === 422 && /sha/i.test(detail))) {
    throw new GithubError('The file changed on GitHub since it was loaded', 409, 'conflict')
  }
  throw new GithubError(`GitHub error ${res.status}${detail ? `: ${detail}` : ''}`, res.status)
}

/** Current file on the branch, or null when it does not exist yet. */
export async function getFile(cfg: GithubConfig, path: string): Promise<RemoteFile | null> {
  try {
    const j = await gh<{ sha: string; content?: string; encoding?: string; size: number; type: string }>(
      cfg,
      `/contents/${encodePath(path)}?ref=${encodeURIComponent(cfg.branch)}`,
    )
    if (j.type !== 'file') throw new GithubError(`${path} is not a file`, 422)
    const bytes = j.encoding === 'base64' && j.content ? Buffer.from(j.content, 'base64') : Buffer.alloc(0)
    return { sha: j.sha, bytes, size: j.size }
  } catch (e) {
    if (e instanceof GithubError && e.code === 'not_found') return null
    throw e
  }
}

/** Create or update one file in a single commit. `sha` is required when the file exists. */
export async function putFile(
  cfg: GithubConfig,
  path: string,
  base64: string,
  message: string,
  sha?: string,
): Promise<{ commitSha: string; commitUrl: string; fileSha: string }> {
  const j = await gh<{ content: { sha: string }; commit: { sha: string; html_url: string } }>(
    cfg,
    `/contents/${encodePath(path)}`,
    { method: 'PUT', body: JSON.stringify({ message, content: base64, branch: cfg.branch, ...(sha ? { sha } : {}) }) },
  )
  return { commitSha: j.commit.sha, commitUrl: j.commit.html_url, fileSha: j.content.sha }
}

/** Files directly inside a folder (empty when the folder does not exist). */
export async function listDir(cfg: GithubConfig, path: string): Promise<{ name: string; size: number; sha: string }[]> {
  try {
    const j = await gh<Array<{ name: string; size: number; sha: string; type: string }>>(
      cfg,
      `/contents/${encodePath(path)}?ref=${encodeURIComponent(cfg.branch)}`,
    )
    return Array.isArray(j) ? j.filter((f) => f.type === 'file').map(({ name, size, sha }) => ({ name, size, sha })) : []
  } catch (e) {
    if (e instanceof GithubError && e.code === 'not_found') return []
    throw e
  }
}

interface ApiCommit {
  sha: string
  html_url: string
  commit: { message: string; author: { name: string; date: string } | null; committer: { date: string } | null }
  author: { login: string } | null
}

const toCommit = (c: ApiCommit): CommitInfo => ({
  sha: c.sha,
  message: c.commit.message,
  date: c.commit.author?.date ?? c.commit.committer?.date ?? '',
  author: c.author?.login ?? c.commit.author?.name ?? '',
  url: c.html_url,
})

/** Latest commits on the branch, optionally only those touching `path`. */
export async function listCommits(cfg: GithubConfig, opts: { path?: string; perPage?: number } = {}): Promise<CommitInfo[]> {
  const q = new URLSearchParams({ sha: cfg.branch, per_page: String(opts.perPage ?? 10) })
  if (opts.path) q.set('path', opts.path)
  const j = await gh<ApiCommit[]>(cfg, `/commits?${q}`)
  return j.map(toCommit)
}

/** The branch head commit (what Vercel builds next). */
export async function branchHead(cfg: GithubConfig): Promise<CommitInfo> {
  return toCommit(await gh<ApiCommit>(cfg, `/commits/${encodeURIComponent(cfg.branch)}`))
}
