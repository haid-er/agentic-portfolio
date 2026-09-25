/**
 * Small in-memory rate limiter for admin routes. Owner: admin-core.
 *
 * State lives per server instance (no database, zero cost). That is enough
 * to turn a password brute force from "thousands per second" into "a handful
 * per quarter hour per instance"; the password itself must still be strong.
 */

interface Bucket {
  /** Timestamps (ms) of counted events inside the window. */
  hits: number[]
  /** Lockout end (ms) once the limit was hit. */
  lockedUntil: number
}

export interface LimitRule {
  limit: number
  windowMs: number
  /** How long to refuse after the limit is reached (default: the window). */
  lockMs?: number
}

export interface LimitState {
  allowed: boolean
  remaining: number
  retryAfterSec: number
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>()
  private rule: LimitRule

  constructor(rule: LimitRule) {
    this.rule = rule
  }

  /** Read without counting. */
  peek(key: string, now = Date.now()): LimitState {
    const b = this.bucket(key, now)
    if (b.lockedUntil > now) return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((b.lockedUntil - now) / 1000) }
    return { allowed: true, remaining: Math.max(0, this.rule.limit - b.hits.length), retryAfterSec: 0 }
  }

  /** Count one event (e.g. a failed login) and return the new state. */
  hit(key: string, now = Date.now()): LimitState {
    const b = this.bucket(key, now)
    b.hits.push(now)
    if (b.hits.length >= this.rule.limit) b.lockedUntil = now + (this.rule.lockMs ?? this.rule.windowMs)
    this.buckets.set(key, b)
    this.sweep(now)
    return this.peek(key, now)
  }

  reset(key: string) {
    this.buckets.delete(key)
  }

  private bucket(key: string, now: number): Bucket {
    const b = this.buckets.get(key) ?? { hits: [], lockedUntil: 0 }
    b.hits = b.hits.filter((t) => now - t < this.rule.windowMs)
    if (b.lockedUntil <= now && b.lockedUntil !== 0) {
      b.lockedUntil = 0
      b.hits = []
    }
    return b
  }

  /** Keep memory bounded on long-lived instances. */
  private sweep(now: number) {
    if (this.buckets.size < 500) return
    for (const [k, b] of this.buckets) {
      if (b.lockedUntil <= now && b.hits.every((t) => now - t >= this.rule.windowMs)) this.buckets.delete(k)
    }
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return fwd || headers.get('x-real-ip') || 'local'
}

/* Shared limiters (module singletons survive between requests on a warm instance). */

/** Failed logins: 5 per IP per 15 minutes, then a 15 minute lockout. */
export const loginFailures = new RateLimiter({ limit: 5, windowMs: 15 * 60_000 })
/** Failed logins from anywhere: a ceiling against distributed guessing. */
export const loginFailuresGlobal = new RateLimiter({ limit: 60, windowMs: 15 * 60_000 })
/** Writes (content saves + uploads) per session IP: generous, just a runaway-loop guard. */
export const writes = new RateLimiter({ limit: 40, windowMs: 60_000 })
