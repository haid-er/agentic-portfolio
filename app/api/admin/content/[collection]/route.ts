/**
 * /api/admin/content/[collection]. Owner: admin-core. Guarded by middleware.
 *
 * GET  -> { ok, data, sha, mode }   latest stored copy (GitHub or disk)
 * POST -> body { data, baseSha?, note? } (or the bare collection object)
 *         zod-validate, then commit via the GitHub Contents API or write to disk.
 *         200 SaveResult | 422 invalid (+ issues) | 409 conflict | 503 unconfigured | 502 upstream
 */
import { COLLECTION_NAMES, type CollectionName } from '@/lib/content/schema'
import { clientIp, writes } from '@/lib/admin/rate-limit'
import { fromError, readCollection, saveCollection, statusFor } from '@/lib/admin/save'
import { getAdminSession, noStoreJson, readJsonBody } from '@/lib/admin/server'
import { saveMode } from '@/lib/admin/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY = 1024 * 1024
const ENVELOPE_KEYS = new Set(['data', 'baseSha', 'note'])

type Ctx = { params: Promise<{ collection: string }> }

async function resolve(ctx: Ctx): Promise<CollectionName | null> {
  const { collection } = await ctx.params
  return (COLLECTION_NAMES as string[]).includes(collection) ? (collection as CollectionName) : null
}

const unauthorized = () => noStoreJson({ ok: false, code: 'unauthorized', message: 'Sign in first.' }, { status: 401 })
const unknown = () => noStoreJson({ ok: false, code: 'bad_request', message: 'Unknown collection.' }, { status: 404 })

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  if (!(await getAdminSession())) return unauthorized()
  const name = await resolve(ctx)
  if (!name) return unknown()
  try {
    const stored = await readCollection(name)
    if (!stored) return noStoreJson({ ok: false, code: 'unconfigured', message: 'No content store is configured.' }, { status: 503 })
    return noStoreJson({ ok: true, ...stored })
  } catch (e) {
    const r = fromError(saveMode() ?? 'disk', e)
    return noStoreJson(r, { status: statusFor(r.code) })
  }
}

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  if (!(await getAdminSession())) return unauthorized()
  const name = await resolve(ctx)
  if (!name) return unknown()

  const limit = writes.hit(clientIp(req.headers))
  if (!limit.allowed) {
    return noStoreJson(
      { ok: false, code: 'rate_limited', message: 'Too many saves in a minute; wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    )
  }

  const body = await readJsonBody(req, MAX_BODY)
  if (!body.ok) return noStoreJson({ ok: false, code: 'bad_request', message: body.message }, { status: body.status })

  // Envelope { data, baseSha?, note? } or the bare collection object.
  const v = body.value
  const isEnvelope =
    typeof v === 'object' && v !== null && !Array.isArray(v) && 'data' in v && Object.keys(v).every((k) => ENVELOPE_KEYS.has(k))
  const env = isEnvelope ? (v as { data: unknown; baseSha?: unknown; note?: unknown }) : { data: v }
  const baseSha = typeof env.baseSha === 'string' && /^[0-9a-f]{40}$/.test(env.baseSha) ? env.baseSha : undefined
  const note = typeof env.note === 'string' ? env.note.slice(0, 500) : undefined

  const result = await saveCollection(name, env.data, { baseSha, note })
  return noStoreJson(result, { status: result.ok ? 200 : statusFor(result.code) })
}
