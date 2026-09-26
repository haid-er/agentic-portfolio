/**
 * GET/PATCH /api/demos/items: paginated demo API for the query-cache lab.
 * Rows are generated from a seed (see components/demos/data-grid/dataset.ts). Visitors can only
 * flip `starred` or change `status` (enums, no free text). Those edits live in this serverless
 * instance's memory and vanish when it recycles. Latency and failure are injectable via query
 * params so the client cache can be exercised; both are capped.
 * Abuse guard (per serverless instance, like the other demo routes): a per-IP request budget
 * per minute (429 + Retry-After over it), and writes must be same-origin JSON.
 */
import { applyPatch, paginate, patchSchema, querySchema, type Override } from '@/components/demos/data-grid/dataset'

export const dynamic = 'force-dynamic'

const overrides = new Map<string, Override>()
const NO_STORE = { 'cache-control': 'no-store', 'x-demo': 'items' }
const MAX_BODY = 512

const WINDOW_MS = 60_000
const READS_PER_MIN = 120
const WRITES_PER_MIN = 30
const MAX_KEYS = 5_000

/** Fixed-window counters per client IP and kind. Another instance starts fresh. */
const windows = new Map<string, { start: number; count: number }>()

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-vercel-forwarded-for') ?? req.headers.get('x-forwarded-for')
  return (fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown').slice(0, 64)
}

/** Spends one request; returns the seconds to wait when the budget is used up. */
function overLimit(req: Request, kind: 'read' | 'write'): number {
  const now = Date.now()
  const key = `${kind}:${clientIp(req)}`
  let w = windows.get(key)
  if (!w || now - w.start >= WINDOW_MS) {
    if (!w && windows.size >= MAX_KEYS) {
      for (const [k, v] of windows) if (now - v.start >= WINDOW_MS) windows.delete(k)
      if (windows.size >= MAX_KEYS) windows.delete(windows.keys().next().value as string)
    }
    w = { start: now, count: 0 }
    windows.set(key, w)
  }
  w.count++
  const cap = kind === 'read' ? READS_PER_MIN : WRITES_PER_MIN
  return w.count > cap ? Math.max(1, Math.ceil((w.start + WINDOW_MS - now) / 1000)) : 0
}

function limited(retryAfter: number): Response {
  return Response.json(
    { error: { code: 'rate_limited', message: `Too many requests. Try again in ${retryAfter} s.` } },
    { status: 429, headers: { ...NO_STORE, 'retry-after': String(retryAfter) } },
  )
}

/** Same-origin check: a cross-site form or fetch carries a foreign Origin header. */
function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true // same-origin navigations and server-to-server calls omit it
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  try { return new URL(origin).host === host } catch { return false }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function fail(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: NO_STORE })
}

export async function GET(req: Request): Promise<Response> {
  const wait = overLimit(req, 'read')
  if (wait) return limited(wait)
  const params = Object.fromEntries(new URL(req.url).searchParams)
  const q = querySchema.safeParse(params)
  if (!q.success) return fail(400, 'bad_request', 'Invalid query parameters.')
  await sleep(q.data.delay)
  if (q.data.fail > 0 && Math.random() < q.data.fail) {
    return fail(503, 'injected', 'Injected failure (the failure-rate control in the lab).')
  }
  return Response.json(paginate(q.data, Date.now(), overrides, 'server'), { headers: NO_STORE })
}

export async function PATCH(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return fail(403, 'forbidden', 'Cross-origin writes are not accepted.')
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return fail(415, 'unsupported_media_type', 'Send the patch as application/json.')
  }
  const wait = overLimit(req, 'write')
  if (wait) return limited(wait)
  const text = await req.text()
  if (text.length > MAX_BODY) return fail(413, 'input_too_large', 'Body too large.')
  let json: unknown
  try { json = JSON.parse(text) } catch { return fail(400, 'bad_request', 'Body is not JSON.') }
  const p = patchSchema.safeParse(json)
  if (!p.success) return fail(400, 'bad_request', 'Invalid patch.')
  await sleep(350)
  if (p.data.fail) return fail(503, 'injected', 'Injected mutation failure (rollback demo).')
  const item = applyPatch(overrides, p.data, Date.now())
  if (!item) return fail(404, 'not_found', 'No such item.')
  return Response.json({ item }, { headers: NO_STORE })
}

/** POST is accepted as an alias of PATCH for clients that cannot send PATCH. */
export async function POST(req: Request): Promise<Response> {
  return PATCH(req)
}
