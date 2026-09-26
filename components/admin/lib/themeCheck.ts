/**
 * Theme contrast gate (DESIGN.md 2), shared by the theme editor (live, blocks Save)
 * and the server save route (lib/admin/save.ts), so a hand-crafted request cannot
 * bypass it. Pure TypeScript: no React, no DOM.
 */
import type { Theme } from '@/lib/content/schema'
import { DEFAULT_COLORS, isSafeTokenValue, type ColorToken } from '@/lib/theme'
import { THEME_KEYS, type ThemeKey } from '@/lib/theme/keys'
import type { Path } from './path'
import { contrast, parseColor } from './contrast'

export interface ThemeIssue { path: Path; message: string }

export const GROUPS: { title: string; tokens: { name: ColorToken; label: string }[] }[] = [
  { title: 'Paper', tokens: [{ name: '--bg', label: 'Background' }, { name: '--bg-2', label: 'Inset sheet' }, { name: '--surface', label: 'Surface (cards)' }] },
  { title: 'Ink', tokens: [{ name: '--ink', label: 'Ink' }, { name: '--ink-2', label: 'Secondary ink' }, { name: '--ink-3', label: 'Meta ink' }] },
  { title: 'Accents', tokens: [{ name: '--accent', label: 'Accent' }, { name: '--accent-2', label: 'Second accent' }, { name: '--accent-ink', label: 'Accent for small text' }, { name: '--on-accent', label: 'Text on accent' }] },
  { title: 'Rules and data', tokens: [{ name: '--rule', label: 'Rule / control border' }, { name: '--data-1', label: 'Data 1' }, { name: '--data-2', label: 'Data 2' }, { name: '--data-3', label: 'Data 3' }, { name: '--data-4', label: 'Data 4' }] },
]
export const COLOR_NAMES = new Set<string>(GROUPS.flatMap((g) => g.tokens.map((t) => t.name)))

/**
 * Status and focus inks live under "Other tokens" but are colours the site uses
 * for text and outlines, so they are contrast-checked too. Defaults mirror
 * app/globals.css.
 */
export type StatusToken = '--danger' | '--warn' | '--ok' | '--focus'
export type Tok = ColorToken | StatusToken
export const STATUS_DEFAULTS: Record<ThemeKey, Record<StatusToken, string>> = {
  almanac: { '--focus': '#1F6B47', '--ok': '#1F6B47', '--warn': '#7A5300', '--danger': '#9E2F16' },
  strata: { '--focus': '#A9C98A', '--ok': '#A9C98A', '--warn': '#E0AE4C', '--danger': '#E07A55' },
}
export const CHECKED = new Set<string>([...COLOR_NAMES, ...Object.keys(STATUS_DEFAULTS.almanac)])

/** Pairs that must stay readable. `min` 4.5 = text, 3 = UI / graphics. */
export const PAIRS: { fg: Tok; bg: Tok; min: number; use: string }[] = [
  { fg: '--ink', bg: '--bg', min: 4.5, use: 'Body text' },
  { fg: '--ink', bg: '--surface', min: 4.5, use: 'Text on cards' },
  { fg: '--ink-2', bg: '--bg', min: 4.5, use: 'Secondary text' },
  { fg: '--ink-2', bg: '--bg-2', min: 4.5, use: 'Secondary on inset' },
  { fg: '--ink-2', bg: '--surface', min: 4.5, use: 'Card ledes' },
  { fg: '--ink-3', bg: '--bg', min: 4.5, use: 'Meta, folios' },
  { fg: '--ink-3', bg: '--bg-2', min: 4.5, use: 'Meta on inset' },
  { fg: '--ink-3', bg: '--surface', min: 4.5, use: 'Meta on cards' },
  { fg: '--accent', bg: '--bg', min: 4.5, use: 'Links, emphasis' },
  { fg: '--accent-ink', bg: '--bg', min: 4.5, use: 'Small accent text' },
  { fg: '--accent-ink', bg: '--bg-2', min: 4.5, use: 'Folios on inset' },
  { fg: '--accent-ink', bg: '--surface', min: 4.5, use: 'Small accent text on cards' },
  { fg: '--on-accent', bg: '--accent', min: 4.5, use: 'Text on accent' },
  { fg: '--rule', bg: '--bg', min: 3, use: 'Control borders' },
  { fg: '--rule', bg: '--surface', min: 3, use: 'Borders on cards' },
  { fg: '--accent-2', bg: '--bg', min: 3, use: 'Decoration, graphics' },
  { fg: '--data-1', bg: '--surface', min: 3, use: 'Chart ink 1' },
  { fg: '--data-2', bg: '--surface', min: 3, use: 'Chart ink 2' },
  { fg: '--data-3', bg: '--surface', min: 3, use: 'Chart ink 3' },
  { fg: '--data-4', bg: '--surface', min: 3, use: 'Chart ink 4' },
  { fg: '--danger', bg: '--bg', min: 4.5, use: 'Error text' },
  { fg: '--danger', bg: '--surface', min: 4.5, use: 'Error text on cards' },
  { fg: '--warn', bg: '--bg', min: 4.5, use: 'Warning text' },
  { fg: '--warn', bg: '--surface', min: 4.5, use: 'Warning text on cards' },
  { fg: '--ok', bg: '--bg', min: 4.5, use: 'Success text' },
  { fg: '--ok', bg: '--surface', min: 4.5, use: 'Success text on cards' },
  { fg: '--focus', bg: '--bg', min: 3, use: 'Focus outline' },
]

export const effective = (theme: Theme, key: ThemeKey, name: Tok): string =>
  theme.themes[key].tokens[name] ?? (DEFAULT_COLORS[key] as Record<string, string>)[name] ?? STATUS_DEFAULTS[key][name as StatusToken]

/** Ratio of one pair, with translucent colours composited over the world's --bg. */
export const ratioOf = (theme: Theme, key: ThemeKey, p: { fg: Tok; bg: Tok }) =>
  contrast(effective(theme, key, p.fg), effective(theme, key, p.bg), effective(theme, key, '--bg'))

/** Contrast failures block the save; the issue points at the token that was changed. */
export const themeCheck = (raw: unknown): ThemeIssue[] => {
  const theme = raw as Theme
  const out: ThemeIssue[] = []
  if (!theme?.themes) return out
  for (const key of THEME_KEYS) {
    const tokens = theme.themes[key]?.tokens ?? {}
    // Colour tokens must be literals we can measure; otherwise the gate could be bypassed.
    for (const [name, value] of Object.entries(tokens)) {
      if (CHECKED.has(name) && isSafeTokenValue(value) && parseColor(value) === null) {
        out.push({ path: ['themes', key, 'tokens', name], message: 'Use a literal colour (hex, rgb() or hsl()) so contrast can be checked.' })
      }
    }
    for (const p of PAIRS) {
      const ratio = ratioOf(theme, key, p)
      if (ratio === null || ratio >= p.min) continue
      const at = tokens[p.fg] !== undefined ? p.fg : tokens[p.bg] !== undefined ? p.bg : null
      if (!at) continue // the shipped defaults are checked in DESIGN.md
      out.push({ path: ['themes', key, 'tokens', at], message: `${p.use}: ${p.fg} on ${p.bg} is ${ratio.toFixed(2)}:1; needs ${p.min}:1.` })
    }
    for (const [name, value] of Object.entries(tokens)) {
      if (!isSafeTokenValue(value)) out.push({ path: ['themes', key, 'tokens', name], message: 'Not a usable CSS value.' })
    }
  }
  return out
}

