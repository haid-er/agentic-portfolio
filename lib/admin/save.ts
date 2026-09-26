/**
 * Save pipeline: validate -> commit via GitHub Contents API (prod) or write to disk (dev).
 * Owner: admin-core. Server only.
 *
 *   1. zod-validate against the collection schema (invalid content never reaches the repo)
 *   2. serialise exactly like the seed files (2-space JSON + trailing newline)
 *   3. compare with the stored file: identical -> no commit, no redeploy
 *   4. write with sha handling; the commit message says what changed:
 *        content(skills): 2 edited (react, nextjs), 1 hidden (vlad)
 */
import 'server-only'
import { COLLECTIONS, validateCollection } from '@/lib/content'
import type { CollectionName } from '@/lib/content/schema'
import { describeChange } from './diff'
import { GithubError } from './github'
import { readRepoFile, saveMode, StoreError, writeRepoFile, type SaveMode } from './store'
import { themeCheck } from '@/components/admin/lib/themeCheck'

export interface SaveIssue {
  path: string
  message: string
}

export interface SaveResult {
  ok: boolean
  mode: SaveMode
  commitUrl?: string
  /** Commit sha (github mode). */
  commitSha?: string
  /** Blob sha of the saved file: send it back as `baseSha` on the next save. */
  sha?: string
  /** True when the content was identical and nothing was written. */
  unchanged?: boolean
  /** One-line change summary, e.g. "2 edited (react, nextjs)". */
  summary?: string
  message?: string
  /** Machine-readable failure reason (ok: false). */
  code?: SaveErrorCode
  /** Field-level problems when code === 'invalid'. */
  issues?: SaveIssue[]
}

export type SaveErrorCode = 'invalid' | 'conflict' | 'unconfigured' | 'upstream' | 'bad_request'

export interface SaveOptions {
  /** Sha the editor loaded; a mismatch fails with "conflict" instead of overwriting. */
  baseSha?: string
  /** Optional note appended to the commit message body. */
  note?: string
}

export const serialize = (data: unknown) => `${JSON.stringify(data, null, 2)}\n`

/** HTTP status for a failed SaveResult. */
export function statusFor(code: SaveErrorCode | undefined): number {
  switch (code) {
    case 'invalid': return 422
    case 'conflict': return 409
    case 'unconfigured': return 503
    case 'bad_request': return 400
    default: return 502
  }
}

/** The latest stored copy of a collection (fresher than the build on Vercel between a save and its redeploy). */
export async function readCollection(name: CollectionName): Promise<{ data: unknown; sha: string | null; mode: SaveMode } | null> {
  const mode = saveMode()
  if (!mode) return null
  const f = await readRepoFile(COLLECTIONS[name].file)
  if (!f) return { data: null, sha: null, mode }
  return { data: JSON.parse(f.bytes.toString('utf8')) as unknown, sha: f.sha, mode }
}

export async function saveCollection(name: CollectionName, data: unknown, opts: SaveOptions = {}): Promise<SaveResult> {
  const meta = COLLECTIONS[name]
  const mode = saveMode()
  if (!mode) {
    return fail('disk', 'unconfigured', 'Saving is not configured on this deployment: set GITHUB_TOKEN and GITHUB_REPO.')
  }

  const parsed = validateCollection(name, data)
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 50).map((i) => ({ path: i.path.join('.') || '(root)', message: i.message }))
    return { ...fail(mode, 'invalid', `${meta.label} has ${issues.length} problem${issues.length === 1 ? '' : 's'}; nothing was saved.`), issues }
  }

  // Same WCAG gate as the theme editor, so a hand-crafted request cannot bypass it.
  if (name === 'theme') {
    const contrastIssues = themeCheck(parsed.data).slice(0, 50).map((i) => ({ path: i.path.join('.'), message: i.message }))
    if (contrastIssues.length) {
      return { ...fail(mode, 'invalid', `${meta.label} fails the contrast check (${contrastIssues.length} problem${contrastIssues.length === 1 ? '' : 's'}); nothing was saved.`), issues: contrastIssues }
    }
  }

  const text = serialize(parsed.data)
  try {
    const current = await readRepoFile(meta.file)
    if (opts.baseSha && current && current.sha !== opts.baseSha) {
      return fail(mode, 'conflict', `${meta.label} changed since you opened it (another save landed first). Reload to get the latest, then re-apply your edit.`)
    }
    let before: unknown = null
    try {
      before = current ? (JSON.parse(current.bytes.toString('utf8')) as unknown) : null
    } catch {
      before = null
    }
    const change = describeChange(before, parsed.data)
    if (current && current.bytes.toString('utf8') === text) {
      return { ok: true, mode, unchanged: true, sha: current.sha, message: `${meta.label}: nothing changed, nothing committed.` }
    }

    const summary = change.text || (current ? 'edited' : 'created')
    const subject = `content(${name}): ${summary}`.slice(0, 120)
    const body = [`Saved from /admin (${meta.label}).`, opts.note?.trim()].filter(Boolean).join('\n\n')
    const res = await writeRepoFile(meta.file, Buffer.from(text, 'utf8'), `${subject}\n\n${body}`, { currentSha: current?.sha ?? null })

    return {
      ok: true,
      mode: res.mode,
      sha: res.sha,
      commitSha: res.commitSha,
      commitUrl: res.commitUrl,
      summary,
      message:
        res.mode === 'github'
          ? `${meta.label} committed. Vercel is redeploying; the site updates in a minute or two.`
          : `${meta.label} written to ${meta.file}. The dev server reloads it; a production build needs a rebuild.`,
    }
  } catch (e) {
    return fromError(mode, e)
  }
}

function fail(mode: SaveMode, code: SaveErrorCode, message: string): SaveResult {
  return { ok: false, mode, code, message }
}

export function fromError(mode: SaveMode, e: unknown): SaveResult {
  if (e instanceof StoreError) {
    return fail(mode, e.code === 'forbidden_path' ? 'bad_request' : e.code, e.message)
  }
  if (e instanceof GithubError) {
    if (e.code === 'conflict') return fail(mode, 'conflict', 'GitHub reports the file changed while saving. Reload, then save again.')
    return fail(mode, 'upstream', e.message)
  }
  console.error('[admin] save failed', e)
  return fail(mode, 'upstream', 'Saving failed unexpectedly; nothing was committed.')
}
