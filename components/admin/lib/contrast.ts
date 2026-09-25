/**
 * WCAG 2.x contrast for the theme editor (DESIGN.md 2: text pairs need 4.5:1,
 * UI and graphic pairs 3:1). Only literal colours can be checked; anything
 * else (var(), gradients) is reported as "not checkable" rather than guessed.
 */
export type Rgb = [number, number, number]

export function parseColor(input: string): Rgb | null {
  const v = input.trim().toLowerCase()
  let m = /^#([0-9a-f]{3,8})$/.exec(v)
  if (m) {
    let h = m[1]!
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map((c) => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(v)
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])].map((n) => Math.max(0, Math.min(255, n))) as Rgb
  return null
}

/** "#aabbcc" for the native colour input (which only accepts 6-digit hex). */
export function toHex6(input: string): string | null {
  const rgb = parseColor(input)
  if (!rgb) return null
  return `#${rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** Contrast ratio (1–21), or null when either colour is not a literal. */
export function contrast(a: string, b: string): number | null {
  const x = parseColor(a)
  const y = parseColor(b)
  if (!x || !y) return null
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
