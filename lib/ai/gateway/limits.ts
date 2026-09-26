/**
 * Per-IP rate limiting and input caps.
 *
 * The limiter is an in-memory sliding window per server instance (no database, BRIEF 1).
 * On Vercel several instances may run, so the real ceiling is a small multiple of
 * perIpPerMinute; the providers' own free-tier limits are the backstop.
 */
import 'server-only'
import { AI_LIMITS, type AiMessage, type AiTextRequest, type AiToolDef } from '../types'
import { badRequest, GatewayError, tooLarge } from './errors'

const WINDOW_MS = 60_000
const MAX_TRACKED_IPS = 5_000
/** Instance-wide ceiling so one burst of IPs cannot drain the free tiers. */
const GLOBAL_FACTOR = 10

const hits = new Map<string, number[]>()
let globalHits: number[] = []

export interface RateState {
  limit: number
  remaining: number
  /** Seconds until the oldest hit leaves the window. */
  resetSec: number
}

function prune(list: number[], now: number): number[] {
  let i = 0
  while (i < list.length && now - list[i] >= WINDOW_MS) i++
  return i ? list.slice(i) : list
}

function state(list: number[], limit: number, now: number): RateState {
  const oldest = list[0]
  return {
    limit,
    remaining: Math.max(0, limit - list.length),
    resetSec: oldest === undefined ? 0 : Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)),
  }
}

function evictIfFull(now: number) {
  if (hits.size < MAX_TRACKED_IPS) return
  for (const [ip, list] of hits) {
    const kept = prune(list, now)
    if (kept.length) hits.set(ip, kept)
    else hits.delete(ip)
  }
  // Still full: drop the oldest-inserted entries (Map keeps insertion order).
  for (const ip of hits.keys()) {
    if (hits.size < MAX_TRACKED_IPS) break
    hits.delete(ip)
  }
}

/** Read the current window for an IP without spending a request (used by /status). */
export function peekRate(ip: string, limit: number, now = Date.now()): RateState {
  return state(prune(hits.get(ip) ?? [], now), limit, now)
}

/** Spend one request for this IP or throw 429 with Retry-After. */
export function takeRate(ip: string, limit: number, now = Date.now()): RateState {
  globalHits = prune(globalHits, now)
  const globalLimit = limit * GLOBAL_FACTOR
  if (globalHits.length >= globalLimit) {
    const g = state(globalHits, globalLimit, now)
    throw new GatewayError('rate_limited', 'The demos are busy right now. Try again in a moment.', 429, g.resetSec)
  }

  const list = prune(hits.get(ip) ?? [], now)
  if (list.length >= limit) {
    hits.set(ip, list)
    const s = state(list, limit, now)
    throw new GatewayError('rate_limited', `Easy there: ${limit} AI requests per minute. Try again in ${s.resetSec}s.`, 429, s.resetSec)
  }
  evictIfFull(now)
  list.push(now)
  hits.delete(ip) // re-insert to keep Map order ~ recency
  hits.set(ip, list)
  globalHits.push(now)
  return state(list, limit, now)
}

/** Test hook. */
export function resetRateLimits() {
  hits.clear()
  globalHits = []
}

/* ------------------------------------------------------------------ */
/* input caps                                                          */
/* ------------------------------------------------------------------ */

export interface InputStats {
  chars: number
  images: number
  /** Rough prompt size for budgeting: 4 chars per token, ~1k tokens per image. */
  estTokens: number
}

function decodedBytes(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1).replace(/\s/g, '')
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - pad
}

function messageStats(m: AiMessage, acc: InputStats) {
  if (typeof m.content === 'string') {
    acc.chars += m.content.length
    return
  }
  for (const p of m.content) {
    if (p.type === 'text') acc.chars += p.text.length
    else {
      acc.images++
      const bytes = decodedBytes(p.dataUrl)
      if (bytes > AI_LIMITS.maxImageBytes) {
        throw tooLarge(`Image is ${(bytes / 1048576).toFixed(1)} MB; the limit is ${AI_LIMITS.maxImageBytes / 1048576} MB. Downscale it first (imageToDataUrl does this).`)
      }
    }
  }
}

/**
 * Enforce maxInputChars, the image cap and the vision flag.
 * `extra` covers developer-sent text that still costs tokens (JSON schema, tool specs).
 */
export function checkInput(req: AiTextRequest, maxInputChars: number, extra: { schema?: unknown; tools?: AiToolDef[] } = {}): InputStats {
  const acc: InputStats = { chars: (req.system ?? '').length, images: 0, estTokens: 0 }
  for (const m of req.messages) messageStats(m, acc)

  if (acc.chars > maxInputChars) {
    throw tooLarge(`Input is ${acc.chars.toLocaleString('en')} characters; the demo limit is ${maxInputChars.toLocaleString('en')}.`)
  }
  if (acc.images > AI_LIMITS.maxImages) throw tooLarge(`At most ${AI_LIMITS.maxImages} images per request.`)
  if (acc.images && !req.vision) throw badRequest('Images need `vision: true` so the router picks a vision model.')

  const specChars = (extra.schema ? JSON.stringify(extra.schema).length : 0) + (extra.tools ? JSON.stringify(extra.tools).length : 0)
  if (specChars > AI_LIMITS.maxSchemaChars) {
    throw tooLarge(`Schema/tool definitions are ${specChars} characters; the limit is ${AI_LIMITS.maxSchemaChars}.`)
  }
  if (!req.messages.some((m) => m.role === 'user')) throw badRequest('At least one user message is required.')

  acc.estTokens = Math.ceil((acc.chars + specChars) / 4) + acc.images * 1000
  return acc
}
