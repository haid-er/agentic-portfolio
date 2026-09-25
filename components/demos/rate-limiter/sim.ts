/**
 * The side-by-side simulation: one stream of requests, three limiters with the same budget
 * (limit per window). Traffic comes from a seeded generator so runs are repeatable.
 */
import { seeded } from '@/lib/utils'
import { createLimiter, type AlgoKey, type Limiter } from './algorithms'

export type Pattern = 'steady' | 'bursty' | 'boundary' | 'manual'

export const PATTERNS: Record<Pattern, { label: string; hint: string }> = {
  steady: { label: 'Steady', hint: 'Random arrivals at about 1.3× the allowed average rate. All three settle near the limit.' },
  bursty: { label: 'Bursty', hint: 'Quiet periods, then bursts. The token bucket spends its saved tokens; the windows reject sooner.' },
  boundary: { label: 'Boundary', hint: 'A full quota just before a fixed-window boundary and another just after. Fixed window lets through twice the limit.' },
  manual: { label: 'Manual', hint: 'No generated traffic. Send requests yourself with the buttons.' },
}

export const LANES: readonly AlgoKey[] = ['token-bucket', 'sliding-window', 'fixed-window']

export const LANE_LABEL: Record<AlgoKey, string> = {
  'token-bucket': 'Token bucket',
  'sliding-window': 'Sliding window',
  'fixed-window': 'Fixed window',
}

export interface Hit { t: number; ok: boolean }
export interface LaneState {
  key: AlgoKey
  hits: Hit[]
  /** Remaining capacity sampled over time. */
  levels: { t: number; v: number }[]
  accepted: number
  rejected: number
  /** Most requests accepted inside any single window-length span so far. */
  worstBurst: number
}

export interface SimConfig { limit: number; windowMs: number; pattern: Pattern; seed?: number }

export class RateSim {
  now = 0
  readonly lanes: { limiter: Limiter; state: LaneState }[]
  private queue: number[] = []
  private genUntil = 0
  private rng: () => number
  private burstAt = 0
  private cycle = 0
  private readonly horizonMs: number

  constructor(readonly cfg: SimConfig) {
    this.rng = seeded(cfg.seed ?? 7)
    this.horizonMs = Math.max(30_000, cfg.windowMs * 3)
    this.lanes = LANES.map((key) => ({
      limiter: createLimiter(key, cfg.limit, cfg.windowMs),
      state: { key, hits: [], levels: [{ t: 0, v: cfg.limit }], accepted: 0, rejected: 0, worstBurst: 0 },
    }))
  }

  get horizon() { return this.horizonMs }

  private expo(ratePerMs: number) {
    return -Math.log(1 - this.rng()) / ratePerMs
  }

  /** Generate arrivals up to `until` for the current pattern. */
  private fill(until: number) {
    const { limit, windowMs, pattern } = this.cfg
    const avg = limit / windowMs // allowed requests per ms
    while (this.genUntil < until) {
      const from = this.genUntil
      const to = from + 1000
      if (pattern === 'steady') {
        let t = from + this.expo(avg * 1.3)
        while (t < to) { this.queue.push(t); t += this.expo(avg * 1.3) }
      } else if (pattern === 'bursty') {
        let t = from + this.expo(avg * 0.25)
        while (t < to) { this.queue.push(t); t += this.expo(avg * 0.25) }
        while (this.burstAt < to) {
          if (this.burstAt >= from) {
            const n = Math.ceil(limit * 1.6)
            for (let i = 0; i < n; i++) this.queue.push(this.burstAt + i * 70 + this.rng() * 30)
          }
          this.burstAt += windowMs * (1.1 + this.rng() * 0.6)
        }
      } else if (pattern === 'boundary') {
        // Every other boundary: `limit` requests in the 800ms before it and `limit` in the 800ms after.
        while ((this.cycle * 2 + 1) * windowMs - 800 < to) {
          const edge = (this.cycle * 2 + 1) * windowMs
          if (edge - 800 >= from) {
            for (let i = 0; i < limit; i++) this.queue.push(edge - 800 + (i * 780) / limit)
            for (let i = 0; i < limit; i++) this.queue.push(edge + 20 + (i * 760) / limit)
          }
          this.cycle += 1
        }
      }
      this.genUntil = to
    }
    this.queue.sort((a, b) => a - b)
  }

  /** Send one request to every lane at time `at`. */
  send(at = this.now) {
    for (const { limiter, state } of this.lanes) {
      const d = limiter.take(at)
      state.hits.push({ t: at, ok: d.allowed })
      state.levels.push({ t: at, v: limiter.peek(at) })
      if (d.allowed) {
        state.accepted += 1
        const from = at - this.cfg.windowMs
        let n = 0
        for (let i = state.hits.length - 1; i >= 0; i--) {
          const h = state.hits[i] as Hit
          if (h.t <= from) break
          if (h.ok) n++
        }
        state.worstBurst = Math.max(state.worstBurst, n)
      } else state.rejected += 1
    }
  }

  /** Queue `n` manual requests 40ms apart, starting now; they are processed in time order by step(). */
  enqueue(n: number) {
    for (let i = 0; i < n; i++) this.queue.push(this.now + 1 + i * 40)
    this.queue.sort((a, b) => a - b)
  }

  step(dtMs: number) {
    const to = this.now + dtMs
    if (this.cfg.pattern !== 'manual') this.fill(to + 1000)
    while (this.queue.length && (this.queue[0] as number) <= to) this.send(this.queue.shift() as number)
    this.now = to
    for (const { limiter, state } of this.lanes) {
      state.levels.push({ t: to, v: limiter.peek(to) })
      const cut = to - this.horizonMs
      if (state.hits.length && (state.hits[0] as Hit).t < cut) state.hits = state.hits.filter((h) => h.t >= cut)
      if (state.levels.length > 600) state.levels = thin(state.levels.filter((l) => l.t >= cut))
    }
  }
}

/** Keep every other sample (old part of the curve) so the level history stays small. */
function thin<T>(xs: T[]): T[] {
  const half = Math.floor(xs.length / 2)
  return [...xs.slice(0, half).filter((_, i) => i % 2 === 0), ...xs.slice(half)]
}
