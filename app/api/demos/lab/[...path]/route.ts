/**
 * /api/demos/lab/* — the layered API lab's real routes. The Next handler is only the HTTP
 * adapter (like Express's app.listen): it reads the request, hands it to the layered mini app
 * and writes the response. State is per-session and in memory, so it resets on a cold start.
 */
import { handle, MAX_BODY_BYTES, requestId } from '@/components/demos/layered-api-lab/api/app'
import { SessionStore } from '@/components/demos/layered-api-lab/api/store'
import type { LabWire } from '@/components/demos/layered-api-lab/api/types'
import { createLimiter, rateLimitHeaders, type Limiter } from '@/components/demos/rate-limiter/algorithms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const store = new SessionStore()
const SESSION_RE = /^[a-z0-9-]{8,64}$/i

type Ctx = { params: Promise<{ path?: string[] }> }

// Abuse guards: this public route writes to server memory, so each IP gets a request budget
// and a smaller budget for opening new sessions (otherwise a script could evict real visitors).
const REQ_LIMIT = 60
const REQ_WINDOW_MS = 60_000
const NEW_SESSION_LIMIT = 10
const NEW_SESSION_WINDOW_MS = 10 * 60_000
const MAX_IPS = 5_000

class IpLimits {
  private readonly map = new Map<string, { limiter: Limiter; seen: number }>()
  constructor(private readonly limit: number, private readonly windowMs: number) {}

  take(ip: string, now: number) {
    let hit = this.map.get(ip)
    if (!hit) {
      if (this.map.size >= MAX_IPS) {
        for (const [k, v] of this.map) if (now - v.seen > this.windowMs) this.map.delete(k)
        if (this.map.size >= MAX_IPS) {
          const first = this.map.keys().next().value
          if (first) this.map.delete(first)
        }
      }
      hit = { limiter: createLimiter('token-bucket', this.limit, this.windowMs), seen: now }
      this.map.set(ip, hit)
    }
    hit.seen = now
    return hit.limiter.take(now)
  }
}

const requestLimits = new IpLimits(REQ_LIMIT, REQ_WINDOW_MS)
const sessionLimits = new IpLimits(NEW_SESSION_LIMIT, NEW_SESSION_WINDOW_MS)

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return (fwd || req.headers.get('x-real-ip') || 'unknown').slice(0, 64)
}

/** An error the lab can still render: same LabWire envelope, with an empty trace. */
function refuse(status: number, code: string, message: string, headers: Record<string, string>): Response {
  const wire: LabWire = { body: { error: { code, message } }, _debug: { trace: [], logs: [], durationMs: 0, runtime: 'server' } }
  return Response.json(wire, { status, headers: { ...headers, 'x-lab-status': String(status) } })
}

function tooMany(retryAfterMs: number, message: string, headers: Record<string, string>): Response {
  const retry = Math.max(1, Math.ceil(retryAfterMs / 1000))
  return refuse(429, 'RATE_LIMITED', `${message} Retry in ${retry}s.`, { ...headers, 'retry-after': String(retry) })
}

async function serve(req: Request, ctx: Ctx): Promise<Response> {
  const { path = [] } = await ctx.params
  const url = new URL(req.url)
  const session = req.headers.get('x-lab-session') ?? ''
  const id = requestId()
  const base: Record<string, string> = { 'cache-control': 'no-store', 'x-lab-runtime': 'server', 'x-request-id': id }

  const ip = clientIp(req)
  const now = Date.now()
  const budget = requestLimits.take(ip, now)
  const limited = { ...base, ...rateLimitHeaders(budget, REQ_WINDOW_MS, 'lab') }
  if (!budget.allowed) return tooMany(budget.retryAfterMs, `Too many requests: ${REQ_LIMIT} per minute.`, limited)

  if (!SESSION_RE.test(session)) {
    return refuse(400, 'BAD_SESSION', 'Send an x-lab-session header of 8 to 64 letters, digits or dashes.', limited)
  }

  if (path.join('/') === '_reset' && req.method === 'POST') {
    store.reset(session)
    return Response.json({ ok: true }, { headers: limited })
  }

  // Cap the body before reading it fully; the lab's body parser enforces the same limit.
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES * 2) {
    return refuse(413, 'PAYLOAD_TOO_LARGE', `Body is larger than ${MAX_BODY_BYTES} bytes`, limited)
  }
  const rawBody = req.method === 'GET' || req.method === 'HEAD' ? '' : (await req.text()).slice(0, MAX_BODY_BYTES * 2)

  const query: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { if (Object.keys(query).length < 12) query[k.slice(0, 40)] = v.slice(0, 200) })

  if (!store.has(session, now)) {
    const opens = sessionLimits.take(ip, now)
    if (!opens.allowed) return tooMany(opens.retryAfterMs, 'Too many new lab sessions from this address.', limited)
  }
  const { db, fresh } = store.get(session, now)
  const result = handle({ method: req.method, path: `/${path.map(encodeURIComponent).join('/')}`, query, rawBody, requestId: id }, db)

  const wire: LabWire = { body: result.body, _debug: { trace: result.trace, logs: result.logs, durationMs: result.durationMs, runtime: 'server', coldStart: fresh } }
  // 204 cannot carry a body; the debug envelope still has to reach the lab, so it answers 200 with x-lab-status.
  const status = result.status === 204 ? 200 : result.status
  return Response.json(wire, { status, headers: { ...result.headers, ...limited, 'x-lab-status': String(result.status) } })
}

export const GET = serve
export const POST = serve
export const PATCH = serve
export const PUT = serve
export const DELETE = serve
