/**
 * WCAG 2.x contrast for the theme editor (DESIGN.md 2: text pairs need 4.5:1,
 * UI and graphic pairs 3:1).
 *
 * Pure maths, no DOM, so the server render and the browser agree. It reads the
 * literal forms the site itself accepts for colour tokens (lib/theme
 * isLiteralColor): hex (3/4/6/8 digits), rgb()/rgba() and hsl()/hsla(), in
 * comma or space syntax, with percentages and alpha. Anything else (named
 * colours, oklch(), var()) returns null; the theme check treats that as a
 * blocking "use a literal colour" issue rather than letting it through.
 */
export type Rgb = [number, number, number]
/** Channels 0–255, alpha 0–1. */
export type Rgba = [number, number, number, number]

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

/** "50%" -> 0.5 * scale, "128" -> 128. NaN when not a number. */
function num(s: string, scale: number): number {
  return s.endsWith('%') ? (Number(s.slice(0, -1)) / 100) * scale : Number(s)
}

/** "rgb(1 2 3 / 50%)" or "rgb(1, 2, 3, .5)" -> ["1","2","3","50%"]. */
function args(v: string, fn: string): string[] | null {
  const m = new RegExp(`^${fn}a?\\(([^()]*)\\)$`).exec(v)
  if (!m) return null
  const parts = m[1]!.trim().split(/\s*[,/]\s*|\s+/).filter(Boolean)
  return parts.length === 3 || parts.length === 4 ? parts : null
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

export function parseColorAlpha(input: string): Rgba | null {
  const v = input.trim().toLowerCase()

  const hex = /^#([0-9a-f]{3,8})$/.exec(v)
  if (hex) {
    let h = hex[1]!
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a]
  }

  const rgb = args(v, 'rgb')
  if (rgb) {
    const [r, g, b] = rgb.slice(0, 3).map((p) => num(p, 255)) as Rgb
    const a = rgb[3] === undefined ? 1 : num(rgb[3], 1)
    if (![r, g, b, a].every(Number.isFinite)) return null
    return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255), clamp(a, 0, 1)]
  }

  const hsl = args(v, 'hsl')
  if (hsl) {
    const h = Number(hsl[0]!.replace(/deg$/, ''))
    const s = num(hsl[1]!, 1)
    const l = num(hsl[2]!, 1)
    const a = hsl[3] === undefined ? 1 : num(hsl[3], 1)
    if (![h, s, l, a].every(Number.isFinite)) return null
    const [r, g, b] = hslToRgb(((h % 360) + 360) % 360, clamp(s, 0, 1), clamp(l, 0, 1))
    return [r, g, b, clamp(a, 0, 1)]
  }

  return null
}

/** Opaque channels (alpha ignored). */
export function parseColor(input: string): Rgb | null {
  const c = parseColorAlpha(input)
  return c ? [c[0], c[1], c[2]] : null
}

/** "#aabbcc" for the native colour input (which only accepts 6-digit hex). */
export function toHex6(input: string): string | null {
  const rgb = parseColor(input)
  if (!rgb) return null
  return `#${rgb.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`
}

/** Paint `top` over an opaque `under`. */
function over([r, g, b, a]: Rgba, under: Rgb): Rgb {
  return [r * a + under[0] * (1 - a), g * a + under[1] * (1 - a), b * a + under[2] * (1 - a)]
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/**
 * Contrast ratio (1–21), or null when either colour is not a readable literal.
 * Translucent colours are composited first: `bg` over `page` (the world's
 * --bg; white if that is missing or translucent too), then `fg` over the result.
 */
export function contrast(fg: string, bg: string, page?: string): number | null {
  const x = parseColorAlpha(fg)
  const y = parseColorAlpha(bg)
  if (!x || !y) return null
  const p = page ? parseColorAlpha(page) : null
  const ground = over(p ?? [255, 255, 255, 1], [255, 255, 255])
  const back = over(y, ground)
  const front = over(x, back)
  const [hi, lo] = [luminance(front), luminance(back)].sort((a, b) => b - a) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
