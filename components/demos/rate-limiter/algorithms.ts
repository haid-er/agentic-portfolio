/**
 * Rate-limiting algorithms, shared by the in-browser simulation and the edge route
 * (app/api/demos/limited). Pure TypeScript, no timers: callers pass `now` in milliseconds.
 */

export type AlgoKey = 'token-bucket' | 'sliding-window' | 'fixed-window'

export interface LimitDecision {
  allowed: boolean
  limit: number
  /** Requests still allowed right now (after this one). */
  remaining: number
  /** ms until the quota is fully restored. */
  resetMs: number
  /** ms until the next request would be allowed (0 when one is allowed now). */
  retryAfterMs: number
}

export interface Limiter {
  readonly key: AlgoKey
  take(now: number): LimitDecision
  /** Capacity left without consuming anything (for gauges). */
  peek(now: number): number
}

/**
 * Token bucket: holds up to `capacity` tokens, refilled continuously at capacity/window.
 * Allows bursts up to the capacity, then a steady average rate.
 */
export class TokenBucket implements Limiter {
  readonly key = 'token-bucket' as const
  private tokens: number
  private last: number | null = null
  private readonly perMs: number

  constructor(private readonly capacity: number, windowMs: number) {
    this.tokens = capacity
    this.perMs = capacity / windowMs
  }

  private refill(now: number) {
    if (this.last !== null && now > this.last) this.tokens = Math.min(this.capacity, this.tokens + (now - this.last) * this.perMs)
    if (this.last === null || now > this.last) this.last = now
  }

  peek(now: number): number {
    this.refill(now)
    return this.tokens
  }

  take(now: number): LimitDecision {
    this.refill(now)
    const allowed = this.tokens >= 1
    if (allowed) this.tokens -= 1
    const missing = this.capacity - this.tokens
    return {
      allowed,
      limit: this.capacity,
      remaining: Math.floor(this.tokens),
      resetMs: Math.ceil(missing / this.perMs),
      retryAfterMs: this.tokens >= 1 ? 0 : Math.ceil((1 - this.tokens) / this.perMs),
    }
  }
}

/**
 * Sliding window log: remembers the timestamps of accepted requests in the last `windowMs`
 * and allows a request if fewer than `limit` are in it. Exact; memory is O(limit).
 */
export class SlidingWindowLog implements Limiter {
  readonly key = 'sliding-window' as const
  private stamps: number[] = []

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  private prune(now: number) {
    const from = now - this.windowMs
    let i = 0
    while (i < this.stamps.length && (this.stamps[i] as number) <= from) i++
    if (i) this.stamps = this.stamps.slice(i)
  }

  peek(now: number): number {
    this.prune(now)
    return this.limit - this.stamps.length
  }

  take(now: number): LimitDecision {
    this.prune(now)
    const allowed = this.stamps.length < this.limit
    if (allowed) this.stamps.push(now)
    const oldest = this.stamps[0]
    const newest = this.stamps[this.stamps.length - 1]
    return {
      allowed,
      limit: this.limit,
      remaining: this.limit - this.stamps.length,
      resetMs: newest === undefined ? 0 : Math.max(0, newest + this.windowMs - now),
      retryAfterMs: this.stamps.length < this.limit || oldest === undefined ? 0 : Math.max(0, oldest + this.windowMs - now),
    }
  }
}

/**
 * Fixed window: a counter that resets at every window boundary. Cheap, but a client can
 * send `limit` at the end of one window and `limit` at the start of the next.
 */
export class FixedWindow implements Limiter {
  readonly key = 'fixed-window' as const
  private start = 0
  private count = 0

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  private roll(now: number) {
    const start = Math.floor(now / this.windowMs) * this.windowMs
    if (start !== this.start) {
      this.start = start
      this.count = 0
    }
  }

  peek(now: number): number {
    this.roll(now)
    return this.limit - this.count
  }

  take(now: number): LimitDecision {
    this.roll(now)
    const allowed = this.count < this.limit
    if (allowed) this.count += 1
    const reset = this.start + this.windowMs - now
    return { allowed, limit: this.limit, remaining: this.limit - this.count, resetMs: reset, retryAfterMs: allowed || this.count < this.limit ? 0 : reset }
  }
}

export function createLimiter(key: AlgoKey, limit: number, windowMs: number): Limiter {
  if (key === 'token-bucket') return new TokenBucket(limit, windowMs)
  if (key === 'sliding-window') return new SlidingWindowLog(limit, windowMs)
  return new FixedWindow(limit, windowMs)
}

/** IETF RateLimit header fields (draft-ietf-httpapi-ratelimit-headers) plus the widely used split form. */
export function rateLimitHeaders(d: LimitDecision, windowMs: number, policyName: string): Record<string, string> {
  const reset = Math.ceil(d.resetMs / 1000)
  const h: Record<string, string> = {
    'RateLimit-Policy': `"${policyName}";q=${d.limit};w=${Math.round(windowMs / 1000)}`,
    RateLimit: `"${policyName}";r=${Math.max(0, d.remaining)};t=${reset}`,
    'RateLimit-Limit': String(d.limit),
    'RateLimit-Remaining': String(Math.max(0, d.remaining)),
    'RateLimit-Reset': String(reset),
  }
  if (!d.allowed) h['Retry-After'] = String(Math.max(1, Math.ceil(d.retryAfterMs / 1000)))
  return h
}
