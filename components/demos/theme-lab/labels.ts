/**
 * World labels from DemoProps.data (resolved on the server as `{ labels: themeLabels(getTheme()) }`),
 * so this client chunk never imports lib/content. Falls back to the world keys.
 */
import type { WorldLabel } from '@/lib/theme'
import { THEME_KEYS, type ThemeKey } from '@/lib/theme/keys'

export function labelsFromData(data: unknown): Record<ThemeKey, WorldLabel> {
  const raw = (data && typeof data === 'object' ? (data as { labels?: unknown }).labels : null) as Record<string, unknown> | null
  const pick = (k: ThemeKey): WorldLabel => {
    const v = (raw && typeof raw === 'object' ? raw[k] : null) as Partial<WorldLabel> | null
    const fallbackReads = k === 'strata' ? 'dark' : 'light'
    return {
      label: typeof v?.label === 'string' && v.label ? v.label : k,
      swapLabel: typeof v?.swapLabel === 'string' && v.swapLabel ? v.swapLabel : k,
      reads: v?.reads === 'light' || v?.reads === 'dark' ? v.reads : fallbackReads,
    }
  }
  return Object.fromEntries(THEME_KEYS.map((k) => [k, pick(k)])) as Record<ThemeKey, WorldLabel>
}
