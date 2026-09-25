/**
 * Seeded poster geometry for specimen previews (DESIGN.md 10). Pure functions:
 * the same slug always draws the same poster on server and client. Colours are
 * token references only, so posters re-ink when the world changes.
 */
import { seeded } from '@/lib/utils'
import type { GlyphId } from '@/lib/demos/registry'
import { hash } from './slug'

export const W = 320
export const H = 200

export interface Shape {
  d: string
  stroke?: string
  fill?: string
  width?: number
  dash?: string
  opacity?: number
  /** Drawn again in the overprint ink on hover (misregistration). */
  print?: boolean
}

export interface Poster {
  shapes: Shape[]
  /** Shapes that scroll in the live trace (one period of width W). */
  loop?: Shape[]
}

const INK = ['var(--data-1)', 'var(--data-2)', 'var(--data-3)', 'var(--data-4)'] as const
const f = (n: number) => (Math.round(n * 10) / 10).toString()
const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`
const line = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('')

/* ---------------- waveforms ---------------- */

/** A periodic (seamless over W) IMU-like trace: integer-cycle sines + repeated noise + spikes. */
function periodicTrace(rnd: () => number, y0: number, amp: number): [number, number][] {
  const step = 4
  const n = W / step
  const noise = Array.from({ length: n }, () => (rnd() - 0.5) * amp * 0.5)
  const c1 = 1 + Math.floor(rnd() * 3)
  const c2 = 4 + Math.floor(rnd() * 5)
  const p1 = rnd() * Math.PI * 2
  const spikes = new Set(Array.from({ length: 3 }, () => Math.floor(rnd() * n)))
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const x = i * step
    const t = (x / W) * Math.PI * 2
    let y = Math.sin(t * c1 + p1) * amp * 0.55 + Math.sin(t * c2) * amp * 0.25 + (noise[i % n] ?? 0)
    if (spikes.has(i % n)) y -= amp * 0.9
    pts.push([x, y0 + y])
  }
  return pts
}

function pulse(rnd: () => number): Poster {
  const loop: Shape[] = [48, 100, 152].map((y, i) => ({
    d: line(periodicTrace(rnd, y, 22)),
    stroke: INK[i],
    width: 1.6,
    print: i === 0,
  }))
  // The marked 5-second window.
  const shapes: Shape[] = [
    { d: `M204 14V186M300 14V186`, stroke: 'var(--accent-ink)', width: 1, dash: '3 3' },
    { d: `M204 14h96`, stroke: 'var(--accent-ink)', width: 2 },
  ]
  return { shapes, loop }
}

function sine(rnd: () => number): Poster {
  const shapes: Shape[] = []
  for (let k = 0; k < 3; k++) {
    const freq = 1.5 + k + rnd()
    const ph = rnd() * 6
    const y0 = 55 + k * 45
    const pts: [number, number][] = []
    for (let x = 0; x <= W; x += 4) pts.push([x, y0 + Math.sin((x / W) * Math.PI * 2 * freq + ph) * 18])
    shapes.push({ d: line(pts), stroke: INK[k], width: 1.5, print: k === 1 })
    if (k === 2) {
      // sampled points with stems (the pipeline's windowing)
      let stems = ''
      let dots = ''
      for (let x = 12; x < W; x += 24) {
        const y = y0 + Math.sin((x / W) * Math.PI * 2 * freq + ph) * 18
        stems += `M${x} ${y0}V${f(y)}`
        dots += circle(x, y, 2.6)
      }
      shapes.push({ d: stems, stroke: 'var(--ink-3)', width: 1 })
      shapes.push({ d: dots, fill: INK[k] })
    }
  }
  return { shapes }
}

function square(rnd: () => number): Poster {
  const shapes: Shape[] = []
  // square wave on top
  let d = 'M0 44'
  let x = 0
  let hi = false
  while (x < W) {
    const w = 16 + Math.floor(rnd() * 3) * 16
    d += `H${Math.min(W, x + w)}`
    x += w
    hi = !hi
    if (x < W) d += `V${hi ? 22 : 44}`
  }
  shapes.push({ d, stroke: INK[0], width: 1.8, print: true })
  // three queue lanes of messages flowing to a consumer bar
  for (let lane = 0; lane < 3; lane++) {
    const y = 80 + lane * 38
    shapes.push({ d: `M8 ${y + 10}H268`, stroke: 'var(--rule-soft)', width: 1 })
    let blocks = ''
    let bx = 12 + rnd() * 30
    while (bx < 240) {
      blocks += `M${f(bx)} ${y}h18v20h-18Z`
      bx += 22 + rnd() * 40
    }
    shapes.push({ d: blocks, fill: INK[(lane + 1) % 4], opacity: 0.9 })
    shapes.push({ d: `M258 ${y + 4}l8 6-8 6`, stroke: 'var(--ink-2)', width: 1.5 })
  }
  shapes.push({ d: 'M280 72h24v116h-24Z', stroke: 'var(--ink)', width: 1.5 })
  shapes.push({ d: 'M286 84h12M286 94h12M286 104h12', stroke: 'var(--ink-3)', width: 1 })
  return { shapes }
}

function saw(rnd: () => number): Poster {
  const shapes: Shape[] = []
  const n = 18
  const bw = (W - 40) / n
  let bars = ''
  let hot = ''
  const pick = new Set([Math.floor(rnd() * n), Math.floor(rnd() * n)])
  for (let i = 0; i < n; i++) {
    // mostly sorted with a few out of place, like a sort mid-pass
    const base = 30 + (i / n) * 120
    const h = pick.has(i) ? 30 + rnd() * 130 : base + (rnd() - 0.5) * 18
    const r = `M${f(20 + i * bw + 1.5)} ${f(178 - h)}h${f(bw - 3)}v${f(h)}h${f(-(bw - 3))}Z`
    if (pick.has(i)) hot += r
    else bars += r
  }
  shapes.push({ d: bars, fill: INK[0], opacity: 0.85 })
  shapes.push({ d: hot, fill: INK[1], print: true })
  shapes.push({ d: 'M14 178H306', stroke: 'var(--ink)', width: 1.5 })
  // sawtooth reading along the top
  const pts: [number, number][] = []
  for (let x = 0; x <= W; x += 40) pts.push([x, 34], [x + 39, 14])
  shapes.push({ d: line(pts), stroke: INK[2], width: 1.4 })
  return { shapes }
}

/* ---------------- category glyphs ---------------- */

function leaf(rnd: () => number): Poster {
  const shapes: Shape[] = []
  const centres = [
    [90 + rnd() * 60, 80 + rnd() * 40],
    [220 + rnd() * 60, 110 + rnd() * 40],
  ] as const
  centres.forEach(([cx, cy], c) => {
    const wob = Array.from({ length: 5 }, () => rnd() * Math.PI * 2)
    for (let k = 1; k <= 6; k++) {
      const r = k * (c ? 13 : 16)
      const pts: [number, number][] = []
      for (let a = 0; a <= 40; a++) {
        const t = (a / 40) * Math.PI * 2
        const rr = r * (1 + 0.14 * Math.sin(t * 3 + (wob[0] ?? 0)) + 0.08 * Math.sin(t * 5 + (wob[k % 5] ?? 0)))
        pts.push([cx + Math.cos(t) * rr * 1.25, cy + Math.sin(t) * rr * 0.8])
      }
      shapes.push({
        d: `${line(pts)}Z`,
        stroke: k === 3 ? INK[1] : INK[0],
        width: k === 3 ? 1.8 : 1,
        opacity: k === 3 ? 1 : 0.75,
        print: k === 3,
      })
    }
  })
  // scope strip along the bottom
  const parts = [0.2 + rnd() * 0.15, 0.25 + rnd() * 0.15]
  const w1 = 280 * parts[0]!
  const w2 = 280 * parts[1]!
  shapes.push({ d: `M20 176h${f(w1)}v10h${f(-w1)}Z`, fill: INK[0] })
  shapes.push({ d: `M${f(22 + w1)} 176h${f(w2)}v10h${f(-w2)}Z`, fill: INK[1] })
  shapes.push({ d: `M${f(24 + w1 + w2)} 176H300v10H${f(24 + w1 + w2)}Z`, fill: INK[2] })
  return { shapes }
}

function broadsheet(rnd: () => number): Poster {
  const cx = 110 + rnd() * 100
  const cy = 70 + rnd() * 50
  const r = 46 + rnd() * 20
  const shapes: Shape[] = [
    { d: circle(cx, cy, r), fill: INK[1], opacity: 0.9, print: true },
    { d: `M${f(cx - 10)} ${f(cy - 20)}h${f(90 + rnd() * 40)}v${f(70 + rnd() * 30)}h${f(-(90 + rnd() * 40))}Z`, fill: INK[0], opacity: 0.8 },
    { d: 'M24 150h140M24 162h110M24 174h128', stroke: 'var(--ink)', width: 4 },
    { d: 'M200 150h96v30h-96Z', stroke: 'var(--ink)', width: 1.5 },
  ]
  // register marks in the corners
  for (const [x, y] of [[16, 16], [304, 16], [16, 184], [304, 184]] as const) {
    shapes.push({ d: `${circle(x, y, 5)}M${x - 9} ${y}h18M${x} ${y - 9}v18`, stroke: 'var(--ink-3)', width: 1 })
  }
  return { shapes }
}

function nodes(rnd: () => number): Poster {
  const pts: [number, number][] = Array.from({ length: 8 }, (_, i) => [
    30 + (i % 4) * 82 + (rnd() - 0.5) * 40,
    50 + Math.floor(i / 4) * 90 + (rnd() - 0.5) * 36,
  ])
  let edges = ''
  let hot = ''
  pts.forEach(([x, y], i) => {
    pts.forEach(([x2, y2], j) => {
      if (j <= i) return
      const dist = Math.hypot(x2 - x, y2 - y)
      if (dist < 120) edges += `M${f(x)} ${f(y)}L${f(x2)} ${f(y2)}`
    })
  })
  // a highlighted route (planner -> worker -> reviewer)
  const route = [0, 5, 2, 7].map((k) => pts[k]!)
  hot = line(route)
  const dots = pts.map(([x, y]) => circle(x, y, 9)).join('')
  const core = route.map(([x, y]) => circle(x, y, 4)).join('')
  return {
    shapes: [
      { d: edges, stroke: 'var(--ink-3)', width: 1 },
      { d: hot, stroke: INK[1], width: 2.2, print: true },
      { d: dots, fill: 'var(--surface)', stroke: 'var(--ink)', width: 1.5 },
      { d: core, fill: INK[0] },
    ],
  }
}

function strata(rnd: () => number): Poster {
  const shapes: Shape[] = []
  const layers = 5
  let prev: [number, number][] = []
  for (let k = 0; k <= layers; k++) {
    const y0 = 24 + k * 32
    const ph = rnd() * 6
    const pts: [number, number][] = []
    for (let x = 0; x <= W; x += 10) pts.push([x, y0 + Math.sin(x / 38 + ph) * 5 + Math.sin(x / 13 + ph * 2) * 2])
    if (k > 0) {
      const band = `${line(prev)}${line([...pts].reverse()).replace(/^M/, 'L')}Z`
      shapes.push({ d: band, fill: INK[(k - 1) % 4], opacity: k % 2 ? 0.85 : 0.45 })
    }
    shapes.push({ d: line(pts), stroke: 'var(--ink)', width: k === 0 ? 2 : 1, print: k === 0 })
    prev = pts
  }
  // the drill line
  const dx = 60 + rnd() * 200
  shapes.push({ d: `M${f(dx)} 8V192`, stroke: 'var(--ink)', width: 1.2, dash: '4 3' })
  return { shapes }
}

function scatter(rnd: () => number): Poster {
  const shapes: Shape[] = []
  const centres = Array.from({ length: 3 }, () => [50 + rnd() * 220, 40 + rnd() * 120] as const)
  centres.forEach(([cx, cy], c) => {
    let dots = ''
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2
      const r = Math.sqrt(rnd()) * 34
      dots += circle(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r, 2.8)
    }
    shapes.push({ d: dots, fill: INK[c], opacity: 0.9 })
  })
  // a query point and its top-k links
  const [qx, qy] = [60 + rnd() * 200, 50 + rnd() * 100]
  const near = centres[0]!
  shapes.push({ d: `M${f(qx)} ${f(qy)}L${f(near[0])} ${f(near[1])}`, stroke: 'var(--ink)', width: 1, dash: '3 3' })
  shapes.push({ d: `${circle(qx, qy, 6)}M${f(qx - 10)} ${f(qy)}h20M${f(qx)} ${f(qy - 10)}v20`, stroke: 'var(--ink)', width: 1.5, print: true })
  shapes.push({ d: 'M20 184H300M20 184V16', stroke: 'var(--ink-3)', width: 1 })
  return { shapes }
}

function columns(rnd: () => number): Poster {
  const shapes: Shape[] = []
  const cols = 4
  const cw = 64
  for (let c = 0; c < cols; c++) {
    const x = 18 + c * (cw + 12)
    shapes.push({ d: `M${x} 22h${cw}`, stroke: INK[c % 4], width: 4 })
    let cards = ''
    let y = 34
    const n = 1 + Math.floor(rnd() * 4)
    for (let i = 0; i < n; i++) {
      const h = 18 + Math.floor(rnd() * 3) * 8
      cards += `M${x} ${y}h${cw}v${h}h${-cw}Z`
      y += h + 8
    }
    shapes.push({ d: cards, fill: 'var(--surface)', stroke: 'var(--ink)', width: 1.2, print: c === 1 })
  }
  // one card mid-drag
  const dx = 60 + rnd() * 160
  shapes.push({ d: `M${f(dx)} 140h64v26h-64Z`, fill: INK[1], opacity: 0.9 })
  return { shapes }
}

function flow(rnd: () => number): Poster {
  const shapes: Shape[] = []
  const n = 4
  const bw = 52
  const gap = (W - 36 - n * bw) / (n - 1)
  let boxes = ''
  let arrows = ''
  const ys: number[] = []
  for (let i = 0; i < n; i++) {
    const x = 18 + i * (bw + gap)
    const y = 60 + Math.floor(rnd() * 3) * 22
    ys.push(y)
    boxes += `M${f(x)} ${y}h${bw}v34h${-bw}Z`
    if (i > 0) {
      const px = 18 + (i - 1) * (bw + gap) + bw
      const py = (ys[i - 1] ?? y) + 17
      arrows += `M${f(px)} ${py}C${f(px + gap / 2)} ${py} ${f(x - gap / 2)} ${y + 17} ${f(x - 4)} ${y + 17}m-5-4 5 4-5 4`
    }
  }
  shapes.push({ d: arrows, stroke: INK[1], width: 1.8, print: true })
  shapes.push({ d: boxes, fill: 'var(--surface)', stroke: 'var(--ink)', width: 1.5 })
  // a log strip underneath
  let log = ''
  for (let i = 0; i < 4; i++) log += `M20 ${160 + i * 8}h${f(60 + rnd() * 200)}`
  shapes.push({ d: log, stroke: 'var(--ink-3)', width: 2 })
  shapes.push({ d: ys.map((y, i) => circle(18 + i * (bw + gap) + 10, y + 17, 3.5)).join(''), fill: INK[0] })
  return { shapes }
}

function mark(): Poster {
  return {
    shapes: [
      { d: `${circle(160, 100, 40)}M100 100h120M160 40v120`, stroke: 'var(--ink)', width: 1.5, print: true },
      { d: circle(160, 100, 12), fill: INK[1] },
    ],
  }
}

/** Poster families: the category glyphs plus a few generic compositions. */
export type PosterKind = GlyphId | 'scatter' | 'columns' | 'flow'

export function makePoster(slug: string, glyph: PosterKind): Poster {
  const rnd = seeded(hash(slug))
  switch (glyph) {
    case 'scatter': return scatter(rnd)
    case 'columns': return columns(rnd)
    case 'flow': return flow(rnd)
    case 'pulse': return pulse(rnd)
    case 'sine': return sine(rnd)
    case 'square': return square(rnd)
    case 'saw': return saw(rnd)
    case 'leaf': return leaf(rnd)
    case 'broadsheet': return broadsheet(rnd)
    case 'nodes': return nodes(rnd)
    case 'strata': return strata(rnd)
    default: return mark()
  }
}

/** Short mono caption for the preview's bottom-left corner. */
export function posterCaption(slug: string, glyph: PosterKind): string {
  if (glyph === 'pulse') return 'synthetic trace · 5 s window'
  return `seed ${String(hash(slug) % 10000).padStart(4, '0')}`
}
