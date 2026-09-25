/**
 * Where admin writes land. Owner: admin-core. Server only.
 *
 * - "github": GITHUB_TOKEN + GITHUB_REPO are set -> one commit per save via the
 *   Contents API. Vercel sees the commit and redeploys.
 * - "disk":   not on Vercel and no token -> write into the working tree
 *   (local `next dev` / `next start`). Vercel's filesystem is read-only, so a
 *   Vercel deployment without a token is "unconfigured" and refuses to save.
 *
 * Both modes speak git blob shas, so optimistic concurrency works the same way.
 */
import 'server-only'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getFile, githubConfig, putFile, type GithubConfig } from './github'

export type SaveMode = 'github' | 'disk'

export class StoreError extends Error {
  readonly code: 'unconfigured' | 'conflict' | 'upstream' | 'forbidden_path'
  readonly status: number

  constructor(message: string, code: StoreError['code'], status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

export interface StoredFile {
  sha: string
  bytes: Buffer
}

export interface WriteResult {
  mode: SaveMode
  sha: string
  commitSha?: string
  commitUrl?: string
}

/** Which save mode this deployment uses, or null when saving is impossible. */
export function saveMode(): SaveMode | null {
  if (githubConfig()) return 'github'
  if (!process.env.VERCEL) return 'disk'
  return null
}

function requireMode(): { mode: 'github'; cfg: GithubConfig } | { mode: 'disk' } {
  const cfg = githubConfig()
  if (cfg) return { mode: 'github', cfg }
  if (!process.env.VERCEL) return { mode: 'disk' }
  throw new StoreError('Saving is not configured: set GITHUB_TOKEN and GITHUB_REPO in the Vercel project.', 'unconfigured', 503)
}

/** git's blob sha: sha1("blob <len>\0<bytes>"). Matches GitHub's file sha. */
export function blobSha(bytes: Buffer): string {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
}

const ALLOWED_ROOTS = ['content/', 'public/uploads/']

/** Resolve a repo-relative path inside the working tree, refusing anything outside the allowed roots. */
function diskPath(repoPath: string): string {
  const clean = path.posix.normalize(repoPath)
  if (!ALLOWED_ROOTS.some((r) => clean.startsWith(r)) || clean.includes('..')) {
    throw new StoreError(`Refusing to write ${repoPath}`, 'forbidden_path', 400)
  }
  return path.join(process.cwd(), ...clean.split('/'))
}

/** Read a file from the active store (null when it does not exist). */
export async function readRepoFile(repoPath: string): Promise<StoredFile | null> {
  const m = requireMode()
  if (m.mode === 'github') {
    const f = await getFile(m.cfg, repoPath)
    return f ? { sha: f.sha, bytes: f.bytes } : null
  }
  try {
    const bytes = await readFile(diskPath(repoPath))
    return { sha: blobSha(bytes), bytes }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

/**
 * Write one file. `expectedSha`:
 *  - a sha: fail with "conflict" unless the stored file still has that sha
 *  - undefined: last write wins (the current sha is looked up just before writing)
 */
export async function writeRepoFile(
  repoPath: string,
  bytes: Buffer,
  message: string,
  opts: { expectedSha?: string; currentSha?: string | null } = {},
): Promise<WriteResult> {
  const m = requireMode()
  const current = opts.currentSha !== undefined ? opts.currentSha : ((await readRepoFile(repoPath))?.sha ?? null)
  if (opts.expectedSha && current !== opts.expectedSha) {
    throw new StoreError('This file changed since you opened it. Reload to get the latest version, then re-apply your edit.', 'conflict', 409)
  }

  if (m.mode === 'github') {
    const res = await putFile(m.cfg, repoPath, bytes.toString('base64'), message, current ?? undefined)
    return { mode: 'github', sha: res.fileSha, commitSha: res.commitSha, commitUrl: res.commitUrl }
  }

  // Disk: atomic replace (write a temp file next to it, then rename).
  const target = diskPath(repoPath)
  await mkdir(path.dirname(target), { recursive: true })
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, bytes)
  await rename(tmp, target)
  return { mode: 'disk', sha: blobSha(bytes) }
}
