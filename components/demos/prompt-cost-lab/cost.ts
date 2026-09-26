/** Cost model: baseline vs prompt caching vs batching, per request, day and month. */
import type { ModelPrice } from './prices'

export interface Workload {
  /** Static prefix (system prompt, tools, few-shot) sent with every request. */
  prefixTokens: number
  /** Variable part (the user's input) per request. */
  inputTokens: number
  outputTokens: number
  requestsPerDay: number
  /** 0..1 share of requests whose prefix is served from cache. */
  cacheHitRate: number
  /** 0..1 share of requests that can wait for the batch tier. */
  batchShare: number
}

export interface Cost {
  baseline: number
  withCache: number
  optimised: number
  /** Savings in $ per request. */
  cacheSaving: number
  batchSaving: number
}

const M = 1_000_000

/** $ per request for one model. */
export function requestCost(m: ModelPrice, w: Workload): Cost {
  const uncachedIn = ((w.prefixTokens + w.inputTokens) * m.input) / M
  const out = (w.outputTokens * m.output) / M
  const baseline = uncachedIn + out

  let withCache = baseline
  if (m.cacheRead != null) {
    const hit = (w.prefixTokens * m.cacheRead) / M
    const miss = (w.prefixTokens * (m.cacheWrite ?? m.input)) / M
    const prefix = w.cacheHitRate * hit + (1 - w.cacheHitRate) * miss
    withCache = prefix + (w.inputTokens * m.input) / M + out
  }
  const mult = m.batch == null ? 1 : 1 - w.batchShare * (1 - m.batch)
  const optimised = withCache * mult
  return { baseline, withCache, optimised, cacheSaving: baseline - withCache, batchSaving: withCache - optimised }
}

export const DAYS_PER_MONTH = 30

export function formatUsd(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a === 0) return '$0'
  if (a < 0.001) return `$${v.toFixed(6)}`
  if (a < 1) return `$${v.toFixed(4)}`
  if (a < 1000) return `$${v.toFixed(2)}`
  return `$${Math.round(v).toLocaleString('en-US')}`
}
