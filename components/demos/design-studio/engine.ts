/**
 * Poster press engine: a seeded, deterministic poster model.
 *
 * Everything the poster shows is a list of vector items (SVG path data or text),
 * so the same model renders to inline SVG (screen + .svg export) and to a canvas
 * via Path2D (PNG export). Same seed + same settings = the same print.
 */
import { seeded } from '@/lib/utils'

export type Style = 'swiss' | 'bauhaus' | 'strata' | 'signal' | 'halftone'
export type Format = 'a-series' | 'square'
export type InkSet = 'world' | 'other' | 'single'
export type Ink = 'paper' | 'ink' | 'spot1' | 'spot2' | 'spot3'
export type Face = 'display' | 'body' | 'mono'

export interface PosterParams {
  seed: number
  style: Style
  format: Format
  cols: number
  headline: string
  subline: string
  grid: boolean
  misregister: boolean
  inks: InkSet
}

export interface PathItem {
  k: 'path'
  d: string
  fill?: Ink
  stroke?: Ink
  sw?: number
  /** 'spot' items print on the second drum: they can drift out of register. */
  layer: 'base' | 'spot'
  opacity?: number
}

export interface TextItem {
  k: 'text'
  x: number
  y: number
  size: number
  text: string
  face: Face
  weight: number
  fill: Ink
  anchor: 'start' | 'end'
  italic?: boolean
  tracking?: number
  /** Rotation in degrees around (x, y). */
  rot?: number
  layer: 'base' | 'spot'
}

export type Item = PathItem | TextItem

export interface Poster {
  w: number
  h: number
  margin: number
  colX: number[]
  colW: number
  rowY: number[]
  rowH: number
  gutter: number
  items: Item[]
  /** Spot-drum offset in px (0,0 when misregistration is off). */
  offset: { x: number; y: number }
  caption: string
}

/** Measures text width at a size; the client passes a canvas-backed version. */
export type Measure = (text: string, face: Face, size: number, weight: number) => number

/** Rough fallback: average glyph widths per face (em units). */
export const approxMeasure: Measure = (text, face, size) =>
  text.length * size * (face === 'mono' ? 0.62 : face === 'display' ? 0.56 : 0.5)

export const STYLES: { value: Style; label: string; blurb: string }[] = [
  { value: 'swiss', label: 'Swiss', blurb: 'Flush-left type on a strict column grid, blocks snapped to modules.' },
  { value: 'bauhaus', label: 'Bauhaus', blurb: 'A lattice of primitive shapes: quarter circles, halves, triangles.' },
  { value: 'strata', label: 'Strata', blurb: 'Seeded sediment bands with halftone beds, newest on top.' },
  { value: 'signal', label: 'Signal', blurb: 'Three sensor-like traces with a marked analysis window.' },
  { value: 'halftone', label: 'Halftone', blurb: 'A dot screen that swells toward a seeded focal point.' },
]

const f = (n: number) => Math.round(n * 10) / 10

/* ------------------------------------------------------------------ */
/* path helpers                                                        */
/* ------------------------------------------------------------------ */

const rect = (x: number, y: number, w: number, h: number) => `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}Z`

const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`

/** Pie wedge from angle a0 to a1 (radians, clockwise from +x). */
function wedge(cx: number, cy: number, r: number, a0: number, a1: number) {
  const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${f(cx)} ${f(cy)}L${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 ${large} 1 ${f(x1)} ${f(y1)}Z`
}

const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`
const line = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`

/** A halftone dot field inside a box; `rAt` returns the dot radius (0..1 of max) at a point. */
function dots(x: number, y: number, w: number, h: number, step: number, rAt: (px: number, py: number) => number) {
  let d = ''
  const max = step * 0.48
  for (let py = y + step / 2; py < y + h; py += step) {
    for (let px = x + step / 2; px < x + w; px += step) {
      const r = Math.max(0, Math.min(1, rAt(px, py))) * max
      if (r > 0.35) d += circle(px, py, r)
    }
  }
  return d
}

/* ------------------------------------------------------------------ */
/* type setting                                                        */
/* ------------------------------------------------------------------ */

/** Break a headline into lines that fit `width`, sizing the type so the longest word fits. */
function setHeadline(text: string, width: number, maxSize: number, maxLines: number, maxH: number, measure: Measure, weight: number) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return { lines: [] as string[], size: 0 }
  let size = maxSize
  for (let guard = 0; guard < 40; guard++) {
    const lines: string[] = []
    let cur = ''
    let fits = true
    for (const w of words) {
      if (measure(w, 'display', size, weight) > width) { fits = false; break }
      const next = cur ? `${cur} ${w}` : w
      if (measure(next, 'display', size, weight) <= width) cur = next
      else { lines.push(cur); cur = w }
    }
    if (cur) lines.push(cur)
    if (fits && lines.length <= maxLines && (lines.length - 1) * size * 0.9 + size <= maxH) return { lines, size }
    size *= 0.92
  }
  return { lines: [words.join(' ')], size: size }
}

/* ------------------------------------------------------------------ */
/* the press                                                           */
/* ------------------------------------------------------------------ */

const SPOTS: Ink[] = ['spot1', 'spot2', 'spot3']

export function makePoster(p: PosterParams, measure: Measure = approxMeasure): Poster {
  const rnd = seeded(p.seed * 2654435761 + p.style.length * 97 + p.cols)
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)] as T
  const w = 420
  const h = p.format === 'square' ? 420 : 594
  const margin = Math.round(w * 0.07)
  const gutter = Math.round(w * 0.018)
  const cols = Math.max(3, Math.min(12, Math.round(p.cols)))
  const colW = (w - 2 * margin - gutter * (cols - 1)) / cols
  const colX = Array.from({ length: cols }, (_, i) => margin + i * (colW + gutter))
  const rows = Math.max(3, Math.round((cols * (h - 2 * margin)) / (w - 2 * margin)))
  const rowH = (h - 2 * margin - gutter * (rows - 1)) / rows
  const rowY = Array.from({ length: rows }, (_, i) => margin + i * (rowH + gutter))
  const inner = { x: margin, y: margin, w: w - 2 * margin, h: h - 2 * margin }

  const items: Item[] = []
  const add = (it: Item) => items.push(it)
  const spot = () => pick(SPOTS)
  const span = (c0: number, n: number) => ({ x: colX[c0] ?? margin, w: n * colW + (n - 1) * gutter })

  /* ---- type block first: shapes get the space the type leaves ---- */
  const typeCols = p.style === 'swiss' ? Math.max(2, Math.round(cols * (0.66 + rnd() * 0.34))) : cols
  const typeBottom = p.style === 'bauhaus' || p.style === 'halftone'
  const tw = typeCols * colW + (typeCols - 1) * gutter
  const weight = 800
  const set = setHeadline(p.headline, tw, w * 0.24, p.style === 'swiss' ? 4 : 3, inner.h * (p.format === 'square' ? 0.34 : 0.4), measure, weight)
  const lead = set.size * 0.9
  const subSize = Math.max(11, w * 0.032)
  const subGap = p.subline ? subSize * 1.9 : 0
  const metaSize = 8.5
  const metaY = h - margin * 0.45
  const metaTop = metaY - metaSize * 1.9
  const cap = set.size * 0.78
  const linesH = set.lines.length ? (set.lines.length - 1) * lead + cap : 0
  let base0: number
  let region: { top: number; bottom: number }
  if (typeBottom) {
    const lastBase = metaTop - gutter * 1.5 - subGap
    base0 = lastBase - Math.max(0, set.lines.length - 1) * lead
    region = { top: inner.y, bottom: base0 - cap - gutter * 1.5 }
  } else {
    base0 = inner.y + cap
    region = { top: inner.y + linesH + subGap + (set.size ? set.size * 0.25 : 0) + gutter * 2, bottom: metaTop - gutter }
  }
  const rTop = region.top, rBot = region.bottom, rH = Math.max(40, rBot - rTop)
  const rowsIn = rowY.map((_, i) => i).filter((i) => (rowY[i] ?? 0) >= rTop - 0.5 && (rowY[i] ?? 0) + rowH <= rBot + 0.5)

  switch (p.style) {
    case 'swiss': {
      const blocks = 3 + Math.floor(rnd() * 4)
      const first = rowsIn[0] ?? rows - 2
      const avail = rowsIn.length || 2
      for (let i = 0; i < blocks; i++) {
        const c = Math.floor(rnd() * cols)
        const n = 1 + Math.floor(rnd() * Math.min(4, cols - c))
        const r = first + Math.floor(rnd() * avail)
        const m = 1 + Math.floor(rnd() * Math.min(3, first + avail - r))
        const a = span(c, n)
        const y = rowY[Math.min(r, rows - 1)] ?? rTop
        add({ k: 'path', d: rect(a.x, y, a.w, m * rowH + (m - 1) * gutter), fill: spot(), layer: 'spot' })
      }
      const r = first + Math.floor(rnd() * avail)
      const cy = (rowY[Math.min(r, rows - 1)] ?? rTop) + rowH / 2
      const R = Math.min((colW + gutter) * (1.5 + rnd() * Math.min(3, cols / 3)), cy - rTop)
      if (R > 8) add({ k: 'path', d: circle(colX[Math.floor(rnd() * cols)] ?? margin, cy, R), fill: 'spot2', layer: 'spot' })
      for (let i = 0; i < 3; i++) {
        const y = (rowY[first + Math.floor(rnd() * avail)] ?? rTop) - gutter / 2
        add({ k: 'path', d: line([[inner.x, y], [inner.x + inner.w, y]]), stroke: 'ink', sw: 1, layer: 'base' })
      }
      break
    }
    case 'bauhaus': {
      const cell = Math.max(1, Math.round(cols / 4))
      const s = cell * colW + (cell - 1) * gutter
      const gc = Math.max(2, Math.floor(cols / cell))
      const gr = Math.max(1, Math.floor((rH + gutter) / (s + gutter)))
      const size = Math.min(s, (rH - (gr - 1) * gutter) / gr)
      for (let i = 0; i < gc; i++) {
        for (let j = 0; j < gr; j++) {
          const x = span(i * cell, 1).x
          const y = rTop + j * (size + gutter)
          const fill: Ink = rnd() < 0.3 ? 'ink' : spot()
          const layer = fill === 'ink' ? 'base' : 'spot'
          switch (Math.floor(rnd() * 6)) {
            case 0: {
              const q = Math.floor(rnd() * 4)
              const corners: [number, number][] = [[x, y], [x + size, y], [x + size, y + size], [x, y + size]]
              const [cx, cy] = corners[q] ?? [x, y]
              const a0 = ((q + 0) * Math.PI) / 2
              add({ k: 'path', d: wedge(cx, cy, size, a0, a0 + Math.PI / 2), fill, layer })
              break
            }
            case 1: add({ k: 'path', d: circle(x + size / 2, y + size / 2, size / 2), fill, layer }); break
            case 2: { const a0 = rnd() < 0.5 ? 0 : Math.PI; add({ k: 'path', d: wedge(x + size / 2, y + size / 2, size / 2, a0, a0 + Math.PI), fill, layer }); break }
            case 3: add({ k: 'path', d: poly(rnd() < 0.5 ? [[x, y + size], [x + size / 2, y], [x + size, y + size]] : [[x, y], [x + size, y], [x, y + size]]), fill, layer }); break
            case 4: { let d = ''; const n = 5; for (let k = 0; k < n; k++) d += rect(x, y + (k * size) / n, size, size / n / 2); add({ k: 'path', d, fill, layer }); break }
            default: add({ k: 'path', d: circle(x + size / 2, y + size / 2, size / 2 - 3), stroke: fill, sw: Math.max(2, size / 14), layer })
          }
        }
      }
      break
    }
    case 'strata': {
      const bands = 5 + Math.floor(rnd() * 4)
      const top = rTop + 14
      const bh = (metaTop - top) / bands
      const phase = rnd() * 10
      for (let i = 0; i < bands; i++) {
        const y0 = top + i * bh
        const amp = Math.min(bh * 0.45, 4 + rnd() * 10)
        const freq = 1.5 + rnd() * 2.5
        const pts: [number, number][] = []
        for (let x = 0; x <= w; x += 10) {
          const t = x / w
          pts.push([x, y0 + Math.sin(t * Math.PI * freq + phase + i) * amp + Math.sin(t * 17 + i * 3) * amp * 0.25])
        }
        const d = `${line(pts)}L${w} ${h}L0 ${h}Z`
        const fill: Ink = i % 3 === 2 ? 'ink' : spot()
        const layer = fill === 'ink' ? 'base' : 'spot'
        if (rnd() < 0.4 && fill !== 'ink') {
          add({ k: 'path', d, fill: 'paper', layer: 'base' })
          add({ k: 'path', d: dots(0, y0 - amp, w, h - y0 + amp, 7, (_, py) => 0.35 + ((py - y0) / bh) * 0.6), fill, layer })
          add({ k: 'path', d: line(pts), stroke: fill, sw: 1.5, layer })
        } else {
          // Paper under each spot band, so bands overprint the paper and not each other.
          if (layer === 'spot') add({ k: 'path', d, fill: 'paper', layer: 'base' })
          add({ k: 'path', d, fill, layer })
        }
      }
      // The drill line: a thin core sample down one column.
      const cx = colX[Math.floor(rnd() * cols)] ?? margin
      add({ k: 'path', d: line([[cx, top - 12], [cx, h]]), stroke: 'ink', sw: 1.5, layer: 'base' })
      add({ k: 'path', d: circle(cx, top - 12, 3), fill: 'ink', layer: 'base' })
      break
    }
    case 'signal': {
      const top = rTop + 8
      const lane = (rBot - top) / 3
      const win0 = inner.x + inner.w * (0.2 + rnd() * 0.4)
      const winW = inner.w * 0.22
      add({ k: 'path', d: rect(win0, top, winW, lane * 3), fill: 'spot3', layer: 'spot', opacity: 0.28 })
      for (let a = 0; a < 3; a++) {
        const mid = top + lane * a + lane / 2
        const f1 = 2 + rnd() * 5, f2 = 9 + rnd() * 14, ph = rnd() * 6
        const burst = inner.x + inner.w * rnd()
        const pts: [number, number][] = []
        for (let x = inner.x; x <= inner.x + inner.w; x += 2) {
          const t = (x - inner.x) / inner.w
          const env = 1 + 1.6 * Math.exp(-(((x - burst) / (inner.w * 0.08)) ** 2))
          const v = Math.sin(t * Math.PI * f1 + ph) * 0.55 + Math.sin(t * Math.PI * f2 + ph * 2) * 0.25 + (rnd() - 0.5) * 0.3
          pts.push([x, mid + Math.max(-0.48, Math.min(0.48, v * env * 0.28)) * lane])
        }
        add({ k: 'path', d: line([[inner.x, mid], [inner.x + inner.w, mid]]), stroke: 'ink', sw: 0.5, layer: 'base', opacity: 0.5 })
        add({ k: 'path', d: line(pts), stroke: SPOTS[a] ?? 'spot1', sw: 1.6, layer: 'spot' })
      }
      let ticks = ''
      for (let x = inner.x; x <= inner.x + inner.w + 0.1; x += inner.w / 20) ticks += `M${f(x)} ${f(rBot)}v-6`
      add({ k: 'path', d: ticks, stroke: 'ink', sw: 1, layer: 'base' })
      add({ k: 'path', d: `M${f(win0)} ${f(top - 4)}V${f(rBot)}M${f(win0 + winW)} ${f(top - 4)}V${f(rBot)}`, stroke: 'ink', sw: 1, layer: 'base' })
      break
    }
    case 'halftone': {
      const fx = inner.x + inner.w * (0.2 + rnd() * 0.6)
      const fy = rTop + rH * (0.3 + rnd() * 0.4)
      const reach = Math.hypot(w, rBot) * (0.45 + rnd() * 0.25)
      const step = 6 + Math.floor(rnd() * 5)
      add({ k: 'path', d: dots(0, 0, w, rBot, step, (px, py) => 1 - Math.hypot(px - fx, py - fy) / reach), fill: spot(), layer: 'spot' })
      const R = Math.min(inner.w * (0.14 + rnd() * 0.16), (rBot - fy) * 0.95, fy * 0.9)
      add({ k: 'path', d: circle(fx, fy, R), fill: 'paper', layer: 'base' })
      add({ k: 'path', d: circle(fx, fy, R * 0.55), fill: 'ink', layer: 'base' })
      break
    }
  }

  /* ---- type ------------------------------------------------------- */
  set.lines.forEach((ln, i) => {
    add({ k: 'text', x: inner.x, y: base0 + i * lead, size: set.size, text: ln, face: 'display', weight, fill: 'ink', anchor: 'start', tracking: -0.02, layer: 'base' })
  })
  if (p.subline) {
    const y = set.lines.length ? base0 + (set.lines.length - 1) * lead + subSize * 1.9 : base0
    add({ k: 'text', x: inner.x, y, size: subSize, text: p.subline, face: 'body', weight: 500, fill: 'ink', anchor: 'start', italic: true, layer: 'base' })
  }

  /* ---- colophon row ---------------------------------------------- */
  const no = String(p.seed).padStart(4, '0')
  const styleLabel = STYLES.find((s) => s.value === p.style)?.label ?? p.style
  add({ k: 'path', d: rect(0, metaTop, w, h - metaTop), fill: 'paper', layer: 'base' })
  add({ k: 'path', d: line([[inner.x, metaTop], [inner.x + inner.w, metaTop]]), stroke: 'ink', sw: 0.6, layer: 'base' })
  add({ k: 'text', x: inner.x, y: metaY, size: metaSize, text: `No. ${no} · ${styleLabel} · ${cols} col`.toUpperCase(), face: 'mono', weight: 500, fill: 'ink', anchor: 'start', tracking: 0.12, layer: 'base' })
  add({ k: 'text', x: inner.x + inner.w, y: metaY, size: metaSize, text: 'PRINTED IN THE BROWSER', face: 'mono', weight: 500, fill: 'ink', anchor: 'end', tracking: 0.12, layer: 'base' })
  // Registration marks in the top corners, printed by both drums.
  const reg = (cx: number, cy: number) => `${circle(cx, cy, 4)}M${cx - 7} ${cy}h14M${cx} ${cy - 7}v14`
  const regs = reg(margin / 2, margin / 2) + reg(w - margin / 2, margin / 2)
  add({ k: 'path', d: regs, stroke: 'ink', sw: 0.7, layer: 'base' })
  add({ k: 'path', d: regs, stroke: 'spot1', sw: 0.7, layer: 'spot' })

  const offset = p.misregister ? { x: f((rnd() - 0.5) * 5), y: f((rnd() - 0.5) * 5) } : { x: 0, y: 0 }
  return { w, h, margin, colX, colW, rowY, rowH, gutter, items, offset, caption: `seed ${no}` }
}

/** Random seed in the 4-digit range printed on the poster. */
export const randomSeed = () => 1 + Math.floor(Math.random() * 9998)
