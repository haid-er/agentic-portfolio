/**
 * GET /api/demos/telemetry: a Server-Sent Events stream of simulated sensor / fleet metrics.
 *
 *   ?scenario=fleet|wearables  &hz=1..5  &seed=0..2^31-1  &from=<seq>
 *
 * - Every sample is `event: sample` with `id: <seq>`, so a browser EventSource that reconnects
 *   sends `Last-Event-ID` and the stream resumes at the next sequence number.
 * - Connections rotate after ~50 s with `event: rotate` (serverless streams must end); the client
 *   reconnects on its own after the advertised `retry`.
 * - A `: ping` comment every 15 s keeps proxies from closing an idle connection.
 * - Abuse guard (per edge isolate, like /api/demos/limited): at most 3 open streams and
 *   12 new connections per minute per client IP; over that the answer is 429 + Retry-After,
 *   which a browser EventSource treats as fatal (no reconnect loop).
 * Values are generated, never measured (see components/demos/live-telemetry/generator.ts).
 */
import { z } from 'zod'
import { frame, HZ_MAX, HZ_MIN, SCENARIOS } from '@/components/demos/live-telemetry/generator'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const ROTATE_MS = 50_000
const PING_MS = 15_000
const RETRY_MS = 1500
const MAX_SEQ = 1_000_000_000

const MAX_OPEN_PER_IP = 3
const MAX_OPENS_PER_MIN = 12
const OPEN_WINDOW_MS = 60_000
const MAX_OPEN_TOTAL = 300
const MAX_KEYS = 5_000

/** Per-isolate connection bookkeeping. Another isolate or region starts fresh. */
interface ClientUse { open: number; opens: number[] }
const clients = new Map<string, ClientUse>()
let openTotal = 0

function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd || req.headers.get('x-real-ip') || 'unknown'
  return ip.slice(0, 64)
}

function clientFor(key: string, now: number): ClientUse {
  const hit = clients.get(key)
  if (hit) return hit
  if (clients.size >= MAX_KEYS) {
    // Forget idle clients first; otherwise the oldest inserted one without open streams.
    for (const [k, v] of clients) if (!v.open && v.opens.every((t) => now - t > OPEN_WINDOW_MS)) clients.delete(k)
    if (clients.size >= MAX_KEYS) {
      for (const [k, v] of clients) if (!v.open) { clients.delete(k); break }
    }
  }
  const use: ClientUse = { open: 0, opens: [] }
  clients.set(key, use)
  return use
}

/** Reserves a stream slot, or returns the seconds to wait before trying again. */
function acquire(key: string, now: number): { ok: true; release: () => void } | { ok: false; retryAfter: number; message: string } {
  const use = clientFor(key, now)
  use.opens = use.opens.filter((t) => now - t < OPEN_WINDOW_MS)
  if (use.open >= MAX_OPEN_PER_IP || openTotal >= MAX_OPEN_TOTAL) {
    return { ok: false, retryAfter: 30, message: `Too many open streams: at most ${MAX_OPEN_PER_IP} per client. Close another tab and retry.` }
  }
  if (use.opens.length >= MAX_OPENS_PER_MIN) {
    const oldest = use.opens[0] ?? now
    return { ok: false, retryAfter: Math.max(1, Math.ceil((OPEN_WINDOW_MS - (now - oldest)) / 1000)), message: `Too many connections: at most ${MAX_OPENS_PER_MIN} per minute.` }
  }
  use.opens.push(now)
  use.open++
  openTotal++
  let released = false
  return {
    ok: true,
    release: () => {
      if (released) return
      released = true
      use.open = Math.max(0, use.open - 1)
      openTotal = Math.max(0, openTotal - 1)
    },
  }
}

function rateLimited(message: string, retryAfter: number) {
  return Response.json(
    { error: { code: 'rate_limited', message, retryAfterSec: retryAfter } },
    { status: 429, headers: { 'cache-control': 'no-store', 'retry-after': String(retryAfter) } },
  )
}

const Query = z.object({
  scenario: z.enum(['fleet', 'wearables']).default('fleet'),
  hz: z.coerce.number().int().min(HZ_MIN).max(HZ_MAX).default(2),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).default(417),
  from: z.coerce.number().int().min(0).max(MAX_SEQ).optional(),
})

function badRequest(message: string) {
  return Response.json(
    { error: { code: 'bad_request', message } },
    { status: 400, headers: { 'cache-control': 'no-store' } },
  )
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  if (url.search.length > 200) return badRequest('Query string too long.')
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
  const { scenario, hz, seed, from } = parsed.data

  const slot = acquire(clientKey(req), Date.now())
  if (!slot.ok) return rateLimited(slot.message, slot.retryAfter)

  const lastId = Number.parseInt(req.headers.get('last-event-id') ?? '', 10)
  const resumed = Number.isFinite(lastId) && lastId >= 0 && lastId < MAX_SEQ
  let seq = Math.max(from ?? 0, resumed ? lastId + 1 : 0)

  const enc = new TextEncoder()
  const def = SCENARIOS[scenario]
  let timers: Array<ReturnType<typeof setInterval>> = []
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return
        try { controller.enqueue(enc.encode(chunk)) } catch { stop() }
      }
      const stop = () => {
        if (closed) return
        closed = true
        timers.forEach(clearInterval)
        timers = []
        slot.release()
        try { controller.close() } catch { /* already closed */ }
      }

      send(`retry: ${RETRY_MS}\n`)
      send(`event: hello\ndata: ${JSON.stringify({
        scenario, hz, seed, startSeq: seq, resumed, rotateMs: ROTATE_MS,
        devices: def.devices, metrics: def.metrics.map((m) => m.id), serverTime: Date.now(),
      })}\n\n`)

      const emit = () => {
        const f = frame(scenario, seed, seq, hz, Date.now())
        send(`id: ${seq}\nevent: sample\ndata: ${JSON.stringify(f)}\n\n`)
        seq = Math.min(seq + 1, MAX_SEQ)
      }
      emit()
      timers.push(setInterval(emit, Math.round(1000 / hz)))
      timers.push(setInterval(() => send(`: ping ${Date.now()}\n\n`), PING_MS))
      timers.push(setInterval(() => {
        send(`event: rotate\ndata: ${JSON.stringify({ nextSeq: seq })}\n\n`)
        stop()
      }, ROTATE_MS))

      req.signal.addEventListener('abort', stop)
    },
    cancel() {
      closed = true
      timers.forEach(clearInterval)
      timers = []
      slot.release()
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  })
}
