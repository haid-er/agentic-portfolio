/**
 * Reference price sheet (USD per 1M tokens, standard tier, short-context rates).
 * Read from each provider's public pricing page on PRICES_CHECKED. Prices change often,
 * so every number is editable in the lab and the sheet says when it was read.
 */
export type ProviderId = 'openai' | 'anthropic' | 'google' | 'deepseek'
export type Tier = 'small' | 'mid' | 'large'

export interface ModelPrice {
  id: string
  provider: ProviderId
  tier: Tier
  /** $ per 1M uncached input tokens. */
  input: number
  /** $ per 1M output tokens. */
  output: number
  /** $ per 1M cached input tokens read; null = no cache price listed (no caching saving assumed). */
  cacheRead: number | null
  /** $ per 1M input tokens written to cache; null = writes cost the normal input price. */
  cacheWrite: number | null
  /** Price multiplier for batch jobs (0.5 = half price); null = no batch tier listed. */
  batch: number | null
  note?: string
}

export const PRICES_CHECKED = '2026-09-25'

export const PROVIDERS: Record<ProviderId, { label: string; url: string }> = {
  openai: { label: 'OpenAI', url: 'https://developers.openai.com/api/docs/pricing' },
  anthropic: { label: 'Anthropic', url: 'https://platform.claude.com/docs/en/about-claude/pricing' },
  google: { label: 'Google', url: 'https://ai.google.dev/gemini-api/docs/pricing' },
  deepseek: { label: 'DeepSeek', url: 'https://api-docs.deepseek.com/quick_start/pricing' },
}

export const MODELS: readonly ModelPrice[] = [
  { id: 'gpt-6-astra', provider: 'openai', tier: 'large', input: 10, output: 50, cacheRead: 1, cacheWrite: null, batch: 0.5 },
  { id: 'gpt-6-sol', provider: 'openai', tier: 'mid', input: 2, output: 10, cacheRead: 0.2, cacheWrite: null, batch: 0.5 },
  { id: 'gpt-5.4-mini', provider: 'openai', tier: 'small', input: 0.75, output: 4.5, cacheRead: 0.075, cacheWrite: null, batch: 0.5 },
  { id: 'gpt-6-luna', provider: 'openai', tier: 'small', input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: null, batch: 0.5 },

  { id: 'claude-opus-5', provider: 'anthropic', tier: 'large', input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25, batch: 0.5, note: 'Cache writes cost 1.25x input (5-minute cache).' },
  { id: 'claude-sonnet-5', provider: 'anthropic', tier: 'mid', input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5, batch: 0.5 },
  { id: 'claude-haiku-4-5', provider: 'anthropic', tier: 'small', input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25, batch: 0.5 },

  { id: 'gemini-3.1-pro-preview', provider: 'google', tier: 'large', input: 2, output: 12, cacheRead: 0.2, cacheWrite: null, batch: 0.5, note: 'Explicit caches also bill storage per hour (not modelled).' },
  { id: 'gemini-3.8-flash', provider: 'google', tier: 'mid', input: 0.75, output: 3.75, cacheRead: 0.075, cacheWrite: null, batch: 0.5, note: 'Listed price runs through Dec 31, 2026.' },
  { id: 'gemini-3.5-flash-lite', provider: 'google', tier: 'small', input: 0.3, output: 2.5, cacheRead: null, cacheWrite: null, batch: 0.5 },

  { id: 'deepseek-v4-pro', provider: 'deepseek', tier: 'mid', input: 0.66, output: 1.98, cacheRead: 0.022, cacheWrite: null, batch: null, note: 'Off-peak rates; peak hours (weekdays UTC) cost double.' },
  { id: 'deepseek-flash', provider: 'deepseek', tier: 'small', input: 0.15, output: 0.6, cacheRead: 0.003, cacheWrite: null, batch: null, note: 'Off-peak rates; peak hours (weekdays UTC) cost double.' },
]

/** Price edits a visitor made, keyed by model id. */
export type PriceOverrides = Record<string, Partial<Pick<ModelPrice, 'input' | 'output' | 'cacheRead'>>>

export function applyOverrides(models: readonly ModelPrice[], o: PriceOverrides): ModelPrice[] {
  return models.map((m) => ({ ...m, ...(o[m.id] ?? {}) }))
}
