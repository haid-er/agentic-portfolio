/**
 * Gateway settings: admin config (content/ai.json) + server-only env keys.
 * Keys are read here and nowhere else; they never leave the server.
 */
import 'server-only'
import { getAiConfig, getPlayground, PROVIDER_IDS, type ProviderId } from '@/lib/content'
import type { DemoSlug } from '@/lib/demos/slugs'

/** Router order is fixed by BRIEF 4: free providers first, the paid one last. */
export const ROUTER_ORDER: readonly ProviderId[] = PROVIDER_IDS

/** DeepSeek is paid: every request is capped here regardless of admin maxTokens. */
export const DEEPSEEK_HARD_MAX_TOKENS = 512

/** Per-attempt timeouts (ms). Streams fail over only before the first visible token. */
export const TIMEOUTS = {
  /** Whole non-streaming call. */
  complete: 20_000,
  /** Until the first visible streamed token. */
  firstToken: 12_000,
  /** Max silence between streamed chunks. */
  idle: 15_000,
  /** Whole request across every provider. */
  overall: 50_000,
} as const

const ENV_KEYS: Record<ProviderId, string> = {
  groq: 'GROQ_API_KEY',
  gemini: 'GEMINI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
}

export function apiKey(id: ProviderId): string | undefined {
  const v = process.env[ENV_KEYS[id]]?.trim()
  return v ? v : undefined
}

export interface ProviderSettings {
  id: ProviderId
  enabled: boolean
  /** Raw admin value; may list alternates: "gemini-3.8-flash, gemini-3.5-flash-lite". */
  model: string
  visionModel?: string
  key?: string
}

/**
 * A model field may list alternates separated by commas; the router tries them in order
 * (useful when a free model is overloaded or retired).
 */
export function modelList(value: string | undefined): string[] {
  return (value ?? '').split(',').map((m) => m.trim()).filter(Boolean).slice(0, 4)
}

export function aiConfig() {
  return getAiConfig()
}

export function providerSettings(id: ProviderId): ProviderSettings {
  const p = getAiConfig().providers[id]
  return { id, enabled: p.enabled, model: p.model, visionModel: p.visionModel || undefined, key: apiKey(id) }
}

/** Admin can hide a demo in content/playground.json; hidden demos cannot spend AI quota. */
export function isDemoAllowed(slug: DemoSlug): boolean {
  const o = getPlayground().demos.find((d) => d.slug === slug)
  return o ? o.enabled : true
}

/** Output cap for one request on one provider. */
export function clampMaxTokens(requested: number | undefined, provider: ProviderId): number {
  const cap = getAiConfig().maxTokens
  const want = requested && requested > 0 ? Math.min(requested, cap) : cap
  return provider === 'deepseek' ? Math.min(want, DEEPSEEK_HARD_MAX_TOKENS) : want
}
