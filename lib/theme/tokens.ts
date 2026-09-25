/**
 * Colour defaults of both worlds (server + client safe). Owner: seo-theme.
 *
 * These mirror the colour tokens in app/globals.css (DESIGN.md 2.1 / 2.2). They
 * are used where CSS cannot reach: the OG image, the web manifest and the
 * browser `theme-color`. Admin overrides from content/theme.json are merged on
 * top with `worldTokens()`, so a retuned world is retuned everywhere.
 */
import type { Theme, ThemeKey } from '@/lib/content/schema'

export type ColorToken =
  | '--bg' | '--bg-2' | '--surface'
  | '--ink' | '--ink-2' | '--ink-3'
  | '--accent' | '--accent-2' | '--accent-ink' | '--on-accent'
  | '--rule' | '--data-1' | '--data-2' | '--data-3' | '--data-4'

export type WorldColors = Record<ColorToken, string>

export const DEFAULT_COLORS: Record<ThemeKey, WorldColors> = {
  almanac: {
    '--bg': '#F2EADB',
    '--bg-2': '#E9DEC9',
    '--surface': '#F7F1E6',
    '--ink': '#1D2B22',
    '--ink-2': '#4A5448',
    '--ink-3': '#5A6356',
    '--accent': '#1F6B47',
    '--accent-2': '#D2462A',
    '--accent-ink': '#9E2F16',
    '--on-accent': '#F7F1E6',
    '--rule': '#1D2B22',
    '--data-1': '#1F6B47',
    '--data-2': '#D2462A',
    '--data-3': '#8F6414',
    '--data-4': '#1D2B22',
  },
  strata: {
    '--bg': '#16110D',
    '--bg-2': '#1F1813',
    '--surface': '#241C16',
    '--ink': '#EEE5D2',
    '--ink-2': '#BDB09A',
    '--ink-3': '#9C8F7B',
    '--accent': '#E0AE4C',
    '--accent-2': '#A9C98A',
    '--accent-ink': '#E0AE4C',
    '--on-accent': '#16110D',
    '--rule': '#8A7560',
    '--data-1': '#E0AE4C',
    '--data-2': '#A9C98A',
    '--data-3': '#E07A55',
    '--data-4': '#C9B79A',
  },
}

/** A literal colour we can hand to non-CSS consumers (no var(), no gradients). */
const LITERAL_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/a-z]+\))$/i

export function isLiteralColor(v: string): boolean {
  return LITERAL_COLOR.test(v.trim())
}

/** Defaults of one world with the admin's literal colour overrides applied. */
export function worldTokens(theme: Theme, key: ThemeKey): WorldColors {
  const out: WorldColors = { ...DEFAULT_COLORS[key] }
  for (const [name, value] of Object.entries(theme.themes[key].tokens)) {
    if (name in out && isLiteralColor(value)) out[name as ColorToken] = value.trim()
  }
  return out
}
