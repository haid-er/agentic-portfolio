/**
 * GET/PATCH /api/demos/items: paginated demo API for the query-cache lab.
 * Rows are generated from a seed (see components/demos/data-grid/dataset.ts). Visitors can only
 * flip `starred` or change `status` (enums, no free text). Those edits live in this serverless
 * instance's memory and vanish when it recycles. Latency and failure are injectable via query
 * params so the client cache can be exercised; both are capped.
 */
import { applyPatch, paginate, patchSchema, querySchema, type Override } from '@/components/demos/data-grid/dataset'

export const dynamic = 'force-dynamic'

const overrides = new Map<string, Override>()
const NO_STORE = { 'cache-control': 'no-store', 'x-demo': 'items' }
const MAX_BODY = 512

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function fail(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: NO_STORE })
}

export async function GET(req: Request): Promise<Response> {
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
