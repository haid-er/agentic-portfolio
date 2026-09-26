/**
 * GET /api/demos/limited?algo=token-bucket|sliding-window — a real rate-limited edge endpoint.
 * 5 requests per 10 seconds per IP. Answers 200 or 429 with RateLimit headers and Retry-After.
 * Counters live in this edge isolate's memory: another isolate or region starts fresh
 * (production would keep them in a shared store such as Redis).
 */
import { createLimiter, rateLimitHeaders, type AlgoKey, type Limiter } from '@/components/demos/rate-limiter/algorithms'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const LIMIT = 5
const WINDOW_MS = 10_000
const MAX_KEYS = 5_000
const ALGOS: readonly AlgoKey[] = ['token-bucket', 'sliding-window']

/** One id per isolate so the page can show when a different instance answered. */
const ISOLATE = Math.random().toString(36).slice(2, 8)
const limiters = new Map<string, { limiter: Limiter; seen: number }>()

function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd || req.headers.get('x-real-ip') || 'unknown'
  return ip.slice(0, 64)
}

function limiterFor(key: string, algo: AlgoKey, now: number): Limiter {
  const id = `${algo}|${key}`
  const hit = limiters.get(id)
  if (hit) {
    hit.seen = now
    return hit.limiter
  }
  if (limiters.size >= MAX_KEYS) {
    // Evict idle keys first; otherwise the oldest inserted.
    for (const [k, v] of limiters) if (now - v.seen > WINDOW_MS * 2) limiters.delete(k)
    if (limiters.size >= MAX_KEYS) {
      const first = limiters.keys().next().value
      if (first) limiters.delete(first)
    }
  }
  const limiter = createLimiter(algo, LIMIT, WINDOW_MS)
  limiters.set(id, { limiter, seen: now })
  return limiter
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const raw = url.searchParams.get('algo') ?? 'token-bucket'
  const base = { 'cache-control': 'no-store', 'x-edge-isolate': ISOLATE }

  if (!ALGOS.includes(raw as AlgoKey)) {
    return Response.json(
      { error: { code: 'bad_request', message: `algo must be one of: ${ALGOS.join(', ')}` } },
      { status: 400, headers: base },
    )
  }
  const algo = raw as AlgoKey
  const now = Date.now()
  const decision = limiterFor(clientKey(req), algo, now).take(now)
  const headers = { ...base, 'x-ratelimit-algorithm': algo, ...rateLimitHeaders(decision, WINDOW_MS, algo === 'token-bucket' ? 'bucket' : 'sliding') }

  if (!decision.allowed) {
    const retry = Math.max(1, Math.ceil(decision.retryAfterMs / 1000))
    return Response.json(
      { error: { code: 'rate_limited', message: `Too many requests: ${LIMIT} per ${WINDOW_MS / 1000}s. Retry in ${retry}s.`, retryAfterSec: retry } },
      { status: 429, headers },
    )
  }
  return Response.json(
    { ok: true, algo, limit: LIMIT, windowSec: WINDOW_MS / 1000, remaining: decision.remaining, isolate: ISOLATE, servedAt: new Date(now).toISOString() },
    { headers },
  )
}
