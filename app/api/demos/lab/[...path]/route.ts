/**
 * /api/demos/lab/* — the layered API lab's real routes. The Next handler is only the HTTP
 * adapter (like Express's app.listen): it reads the request, hands it to the layered mini app
 * and writes the response. State is per-session and in memory, so it resets on a cold start.
 */
import { handle, MAX_BODY_BYTES, requestId } from '@/components/demos/layered-api-lab/api/app'
import { SessionStore } from '@/components/demos/layered-api-lab/api/store'
import type { LabWire } from '@/components/demos/layered-api-lab/api/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const store = new SessionStore()
const SESSION_RE = /^[a-z0-9-]{8,64}$/i

type Ctx = { params: Promise<{ path?: string[] }> }

async function serve(req: Request, ctx: Ctx): Promise<Response> {
  const { path = [] } = await ctx.params
  const url = new URL(req.url)
  const rawSession = req.headers.get('x-lab-session') ?? ''
  const session = SESSION_RE.test(rawSession) ? rawSession : 'anonymous'
  const id = requestId()
  const base = { 'cache-control': 'no-store', 'x-lab-runtime': 'server', 'x-request-id': id }

  if (path.join('/') === '_reset' && req.method === 'POST') {
    store.reset(session)
    return Response.json({ ok: true }, { headers: base })
  }

  // Cap the body before reading it fully; the lab's body parser enforces the same limit.
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES * 2) {
    return Response.json({ error: { code: 'PAYLOAD_TOO_LARGE', message: `Body is larger than ${MAX_BODY_BYTES} bytes` } }, { status: 413, headers: base })
  }
  const rawBody = req.method === 'GET' || req.method === 'HEAD' ? '' : (await req.text()).slice(0, MAX_BODY_BYTES * 2)

  const query: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { if (Object.keys(query).length < 12) query[k.slice(0, 40)] = v.slice(0, 200) })

  const { db, fresh } = store.get(session)
  const result = handle({ method: req.method, path: `/${path.map(encodeURIComponent).join('/')}`, query, rawBody, requestId: id }, db)

  const wire: LabWire = { body: result.body, _debug: { trace: result.trace, logs: result.logs, durationMs: result.durationMs, runtime: 'server', coldStart: fresh } }
  // 204 cannot carry a body; the debug envelope still has to reach the lab, so it answers 200 with x-lab-status.
  const status = result.status === 204 ? 200 : result.status
  return Response.json(wire, { status, headers: { ...result.headers, ...base, 'x-lab-status': String(result.status) } })
}

export const GET = serve
export const POST = serve
export const PATCH = serve
export const PUT = serve
export const DELETE = serve
