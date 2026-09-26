/**
 * Per-instance provider health: cooldowns after 429/5xx/auth errors, and the DeepSeek
 * token budget (BRIEF 4: DeepSeek is paid, so it gets a hard per-instance budget).
 * All in memory; a cold start resets it, which is fine for a capped demo gateway.
 */
import 'server-only'
import type { ProviderId } from '@/lib/content'
import type { AiUsage } from '../types'

/** Health is tracked per provider + model ("gemini/gemini-3.5-flash-lite"). */
export type HealthKey = `${ProviderId}/${string}`
export const healthKey = (id: ProviderId, model: string): HealthKey => `${id}/${model}`

const cooldownUntil = new Map<HealthKey, number>()
let deepseekSpent = 0

export function coolingFor(key: HealthKey, now = Date.now()): number {
  const until = cooldownUntil.get(key) ?? 0
  return until > now ? Math.ceil((until - now) / 1000) : 0
}

export function markFailure(key: HealthKey, cooldownSec?: number, now = Date.now()) {
  if (cooldownSec && cooldownSec > 0) cooldownUntil.set(key, now + cooldownSec * 1000)
}

export function markSuccess(key: HealthKey) {
  cooldownUntil.delete(key)
}

/* ---------------- DeepSeek budget ---------------- */

export function deepseekLeft(budget: number): number {
  return Math.max(0, budget - deepseekSpent)
}

/** Can this request fit? Reserve worst case: estimated input + full output cap. */
export function deepseekCanAfford(budget: number, estInput: number, maxTokens: number): boolean {
  return estInput + maxTokens <= deepseekLeft(budget)
}

/** Reserve before the call (so parallel requests cannot overspend), settle after. */
export function deepseekReserve(tokens: number): () => void {
  deepseekSpent += tokens
  let settled = false
  return () => {
    if (settled) return
    settled = true
    deepseekSpent -= tokens
  }
}

export function deepseekCharge(usage: AiUsage) {
  deepseekSpent += usage.inputTokens + usage.outputTokens
}
