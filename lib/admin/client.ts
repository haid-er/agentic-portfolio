/**
 * Browser helpers for admin editors. Owner: admin-core. Client safe (no secrets, no Node APIs).
 *
 *   const res = await saveContent('skills', data, { baseSha })
 *   if (res.ok) toast(res.message) else if (res.code === 'invalid') showIssues(res.issues)
 *
 *   const up = await uploadFile(file, { name: 'resume' })   // -> { url: '/uploads/resume.pdf' }
 *
 * Every helper resolves (never throws) with the route's JSON shape, so
 * editors can render one honest result state. A 401 means the session
 * expired: `code: 'unauthorized'`, and the editor should link to /admin/login.
 */
import type { CollectionName } from '@/lib/content/schema'
import type { Activity } from './activity'
import type { SaveResult } from './save'
import type { UploadEntry, UploadResult } from './uploads'
import { notifySaved } from './events'

export type { SaveResult, SaveIssue, SaveErrorCode } from './save'
export type { UploadResult, UploadEntry } from './uploads'
export type { Activity, ActivityCommit, DeployStatus, DeployState } from './activity'
export { ADMIN_SAVED_EVENT, type AdminSavedDetail } from './events'

export type ClientCode = SaveResult['code'] | 'unauthorized' | 'network' | 'rate_limited'
export type ClientResult<T> =
  | (Omit<T, 'ok'> & { ok: true })
  | (Partial<Omit<T, 'ok' | 'code' | 'message'>> & { ok: false; code: ClientCode; message: string; retryAfterSec?: number })

async function call<T extends object>(input: string, init: RequestInit): Promise<ClientResult<T>> {
  let res: Response
  try {
    res = await fetch(input, { ...init, credentials: 'same-origin', cache: 'no-store' })
  } catch {
    return { ok: false, code: 'network', message: 'Network error: the request did not reach the server. Nothing was saved.' } as ClientResult<T>
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.status === 401) {
    return { ok: false, code: 'unauthorized', message: 'Your admin session expired. Sign in again; your edits are still on this page.' } as ClientResult<T>
  }
  if (res.status === 429) {
    const retryAfterSec = Number(res.headers.get('retry-after') ?? 0) || undefined
    return { ok: false, code: 'rate_limited', retryAfterSec, message: String(body.message ?? 'Too many requests; wait a moment.') } as ClientResult<T>
  }
  if (!res.ok || body.ok === false) {
    return { ...body, ok: false, code: (body.code as ClientCode) ?? 'upstream', message: String(body.message ?? `Request failed (${res.status}).`) } as ClientResult<T>
  }
  return { ...body, ok: true } as ClientResult<T>
}

/** Tell the admin shell (deploy pill) that something was written. */
function announce<T extends SaveResult>(kind: 'content' | 'upload', res: ClientResult<T>): ClientResult<T> {
  if (res.ok) {
    const r = res as unknown as SaveResult
    if (!r.unchanged) notifySaved({ kind, mode: r.mode, commitSha: r.commitSha })
  }
  return res
}

/**
 * Validate + save a whole collection. `baseSha` (from loadContent or a previous
 * save's `sha`) turns a silent overwrite of a newer save into a 409 "conflict".
 */
export async function saveContent(name: CollectionName, data: unknown, opts: { baseSha?: string; note?: string } = {}) {
  const res = await call<SaveResult>(`/api/admin/content/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, baseSha: opts.baseSha, note: opts.note }),
  })
  return announce('content', res)
}

/** Latest stored copy of a collection (on Vercel this can be newer than the running build). */
export function loadContent(name: CollectionName) {
  return call<{ data: unknown; sha: string | null; mode: SaveResult['mode'] }>(`/api/admin/content/${name}`, { method: 'GET' })
}

/** Upload an image or PDF into public/uploads. `name` fixes the file name (e.g. "resume" -> /uploads/resume.pdf). */
export async function uploadFile(file: File, opts: { name?: string } = {}) {
  const form = new FormData()
  form.set('file', file)
  if (opts.name) form.set('name', opts.name)
  return announce('upload', await call<UploadResult>('/api/admin/upload', { method: 'POST', body: form }))
}

export function listUploadsClient() {
  return call<{ files: UploadEntry[] }>('/api/admin/upload', { method: 'GET' })
}

export function getActivityClient(fresh = false) {
  return call<Activity>(`/api/admin/status${fresh ? '?fresh=1' : ''}`, { method: 'GET' })
}
