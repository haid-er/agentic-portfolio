/** The editable colour tokens, the pairs that must stay readable, and output formats. */
import type { ThemeKey } from '@/lib/content/schema'
import { DEFAULT_COLORS, type ColorToken, type WorldColors } from '@/lib/theme'
import { contrast, fixForeground, rotateHue } from './color'

export type Palette = WorldColors
export type Edits = Partial<Record<ColorToken, string>>

export const GROUPS: { title: string; tokens: { name: ColorToken; label: string }[] }[] = [
  { title: 'Paper', tokens: [{ name: '--bg', label: 'Background' }, { name: '--bg-2', label: 'Inset sheet' }, { name: '--surface', label: 'Cards' }] },
  { title: 'Ink', tokens: [{ name: '--ink', label: 'Ink' }, { name: '--ink-2', label: 'Secondary' }, { name: '--ink-3', label: 'Meta' }] },
  { title: 'Accents', tokens: [{ name: '--accent', label: 'Accent' }, { name: '--accent-2', label: 'Second accent' }, { name: '--accent-ink', label: 'Small accent text' }, { name: '--on-accent', label: 'Text on accent' }] },
  { title: 'Rules and data', tokens: [{ name: '--rule', label: 'Control border' }, { name: '--data-1', label: 'Data 1' }, { name: '--data-2', label: 'Data 2' }, { name: '--data-3', label: 'Data 3' }, { name: '--data-4', label: 'Data 4' }] },
]

export const TOKENS: ColorToken[] = GROUPS.flatMap((g) => g.tokens.map((t) => t.name))

export interface Pair { fg: ColorToken; bg: ColorToken; min: number; use: string }

/** min 4.5 = text (WCAG 1.4.3), 3 = UI boundaries and graphics (1.4.11). Mirrors DESIGN.md 2. */
export const PAIRS: Pair[] = [
  { fg: '--ink', bg: '--bg', min: 4.5, use: 'Body text' },
  { fg: '--ink', bg: '--surface', min: 4.5, use: 'Text on cards' },
  { fg: '--ink-2', bg: '--bg', min: 4.5, use: 'Secondary text' },
  { fg: '--ink-2', bg: '--bg-2', min: 4.5, use: 'Secondary on inset' },
  { fg: '--ink-3', bg: '--bg', min: 4.5, use: 'Meta, folios' },
  { fg: '--ink-3', bg: '--bg-2', min: 4.5, use: 'Meta on inset' },
  { fg: '--ink-3', bg: '--surface', min: 4.5, use: 'Meta on cards' },
  { fg: '--accent', bg: '--bg', min: 4.5, use: 'Links, emphasis' },
  { fg: '--accent-ink', bg: '--bg', min: 4.5, use: 'Small accent text' },
  { fg: '--accent-ink', bg: '--bg-2', min: 4.5, use: 'Folios on inset' },
  { fg: '--on-accent', bg: '--accent', min: 4.5, use: 'Text on accent' },
  { fg: '--rule', bg: '--bg', min: 3, use: 'Control borders' },
  { fg: '--rule', bg: '--surface', min: 3, use: 'Borders on cards' },
  { fg: '--accent-2', bg: '--bg', min: 3, use: 'Decoration, graphics' },
  { fg: '--data-1', bg: '--surface', min: 3, use: 'Chart ink 1' },
  { fg: '--data-2', bg: '--surface', min: 3, use: 'Chart ink 2' },
  { fg: '--data-3', bg: '--surface', min: 3, use: 'Chart ink 3' },
  { fg: '--data-4', bg: '--surface', min: 3, use: 'Chart ink 4' },
]

export const MATRIX_FG: ColorToken[] = ['--ink', '--ink-2', '--ink-3', '--accent', '--accent-ink', '--accent-2']
export const MATRIX_BG: ColorToken[] = ['--bg', '--bg-2', '--surface']

export const ratioOf = (p: Palette, pair: Pair) => contrast(p[pair.fg], p[pair.bg]) ?? 0
export const failures = (p: Palette) => PAIRS.filter((pair) => ratioOf(p, pair) < pair.min)

/** Fix every failing pair by moving the foreground; two passes settle shared tokens. */
export function fixAll(p: Palette): Palette {
  const out = { ...p }
  for (let pass = 0; pass < 2; pass++) {
    for (const pair of PAIRS) {
      if (ratioOf(out, pair) >= pair.min) continue
      const next = fixForeground(out[pair.fg], out[pair.bg], pair.min)
      if (next) out[pair.fg] = next
    }
  }
  return out
}

export const rotatePalette = (p: Palette, deg: number): Palette =>
  Object.fromEntries(TOKENS.map((t) => [t, rotateHue(p[t], deg)])) as Palette

/** Tokens that differ from `base` (case-insensitive hex compare). */
export function diff(p: Palette, base: Palette): Edits {
  const out: Edits = {}
  for (const t of TOKENS) if (p[t].toUpperCase() !== base[t].toUpperCase()) out[t] = p[t]
  return out
}

export function cssBlock(world: ThemeKey, p: Palette, only?: Edits): string {
  const names = only ? TOKENS.filter((t) => t in only) : TOKENS
  if (!names.length) return `/* No changes yet: every token matches the shipped ${world} defaults. */`
  return `[data-theme="${world}"] {\n${names.map((t) => `  ${t}: ${p[t]};`).join('\n')}\n}`
}

/** The `tokens` object for content/theme.json: overrides on top of the shipped defaults. */
export function themeJsonTokens(world: ThemeKey, p: Palette): string {
  return JSON.stringify(diff(p, DEFAULT_COLORS[world]), null, 2)
}
