/**
 * Colour maths for the theme lab: parsing, WCAG 2.x contrast, HSL moves and
 * a minimal-change fixer that nudges one colour's lightness until a pair passes.
 */

export interface Rgb { r: number; g: number; b: number }

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))

/** Parse #rgb, #rrggbb, #rrggbbaa, rgb() and rgba(); alpha is ignored. */
export function parseColor(input: string): Rgb | null {
  const s = input.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3,8})$/.exec(s)?.[1]
  if (hex) {
    const full = hex.length === 3 || hex.length === 4 ? [...hex.slice(0, 3)].map((c) => c + c).join('') : hex.slice(0, 6)
    if (full.length !== 6) return null
    const n = parseInt(full, 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s)
  if (m) return { r: clamp(Number(m[1]), 0, 255), g: clamp(Number(m[2]), 0, 255), b: clamp(Number(m[3]), 0, 255) }
  return null
}

export const toHex = ({ r, g, b }: Rgb) =>
  `#${[r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`.toUpperCase()

/** Normalise any parseable colour to #RRGGBB (or null). */
export const normalize = (s: string) => {
  const c = parseColor(s)
  return c ? toHex(c) : null
}

const lin = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export const luminance = ({ r, g, b }: Rgb) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

/** WCAG 2.x contrast ratio, or null if either colour cannot be parsed. */
export function contrast(a: string, b: string): number | null {
  const x = parseColor(a), y = parseColor(b)
  if (!x || !y) return null
  const la = luminance(x), lb = luminance(y)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/* ------------------------------------------------------------------ */
/* HSL                                                                 */
/* ------------------------------------------------------------------ */

export interface Hsl { h: number; s: number; l: number }

export function toHsl({ r, g, b }: Rgb): Hsl {
  const R = r / 255, G = g / 255, B = b / 255
  const max = Math.max(R, G, B), min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return { h: h * 60, s, l }
}

export function fromHsl({ h, s, l }: Hsl): Rgb {
  const hh = (((h % 360) + 360) % 360) / 360
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return { r: f(hh + 1 / 3) * 255, g: f(hh) * 255, b: f(hh - 1 / 3) * 255 }
}

/** Rotate a colour's hue by `deg` (neutral greys barely move, by design). */
export function rotateHue(hex: string, deg: number): string {
  const c = parseColor(hex)
  if (!c) return hex
  const hsl = toHsl(c)
  return toHex(fromHsl({ ...hsl, h: hsl.h + deg }))
}

/**
 * Smallest lightness move of `fg` that makes it pass `min` against `bg`.
 * Moves away from the background (darker on paper, lighter on dark ground).
 * Returns null when no lightness passes (the background must move instead).
 */
export function fixForeground(fg: string, bg: string, min: number): string | null {
  const f = parseColor(fg), b = parseColor(bg)
  if (!f || !b) return null
  const target = min + 0.05 // a hair of headroom so rounding never shows 4.49
  if ((contrast(fg, bg) ?? 0) >= target) return toHex(f)
  const hsl = toHsl(f)
  const dir = luminance(b) > 0.18 ? -1 : 1
  for (let i = 1; i <= 200; i++) {
    const l = clamp(hsl.l + dir * i * 0.005)
    const cand = toHex(fromHsl({ ...hsl, l }))
    if ((contrast(cand, bg) ?? 0) >= target) return cand
    if (l === 0 || l === 1) break
  }
  return null
}

/** WCAG label for a text pair. Colour is never the only signal: this is printed. */
export function grade(ratio: number, min: number): { label: string; pass: boolean } {
  if (min < 4.5) return ratio >= min ? { label: `${min}:1 OK`, pass: true } : { label: 'Fails', pass: false }
  if (ratio >= 7) return { label: 'AAA', pass: true }
  if (ratio >= 4.5) return { label: 'AA', pass: true }
  if (ratio >= 3) return { label: 'Large only', pass: false }
  return { label: 'Fails', pass: false }
}
