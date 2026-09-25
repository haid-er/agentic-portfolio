/** Canvas rendering of the plane: decision field + 0.5 contour, or the regression curve, and the points. */
import type { Pt } from './datasets'
import { predict, type Net, type Task } from './mlp'

export interface Inks { a: string; b: string; surface: string; ink: string; ink3: string; soft: string; mono: string }
export const INK_TOKENS = ['--data-1', '--data-2', '--surface', '--ink', '--ink-3', '--rule-soft', '--font-mono'] as const

export function inksFrom(t: Record<(typeof INK_TOKENS)[number], string>): Inks {
  return {
    a: t['--data-1'] || '#1F6B47', b: t['--data-2'] || '#D2462A', surface: t['--surface'] || '#F7F1E6',
    ink: t['--ink'] || '#1D2B22', ink3: t['--ink-3'] || '#5A6356', soft: t['--rule-soft'] || 'rgba(0,0,0,.2)',
    mono: t['--font-mono'] || 'ui-monospace, monospace',
  }
}

/** '#rgb', '#rrggbb' or 'rgb(a)(…)' -> [r, g, b]. */
export function rgb(c: string): [number, number, number] {
  const s = c.trim()
  if (s.startsWith('#')) {
    const h = s.length === 4 ? s.slice(1).split('').map((x) => x + x).join('') : s.slice(1, 7)
    const n = parseInt(h, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const m = s.match(/[\d.]+/g)
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128]
}

const RES = 64
let field: HTMLCanvasElement | null = null

/** Probability grid (row-major, y from top) for the classification field. */
function grid(net: Net): Float32Array {
  const g = new Float32Array((RES + 1) * (RES + 1))
  for (let j = 0; j <= RES; j++) {
    const y = 1 - (2 * j) / RES
    for (let i = 0; i <= RES; i++) g[j * (RES + 1) + i] = predict(net, [-1 + (2 * i) / RES, y])
  }
  return g
}

export function drawPlane(
  ctx: CanvasRenderingContext2D,
  size: number,
  net: Net | null,
  task: Task,
  pts: Pt[],
  inks: Inks,
  cursor: { x: number; y: number } | null,
  showField: boolean,
) {
  const px = (x: number) => ((x + 1) / 2) * size
  const py = (y: number) => ((1 - y) / 2) * size
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = inks.surface
  ctx.fillRect(0, 0, size, size)

  // axes
  ctx.strokeStyle = inks.soft
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(size / 2 + 0.5, 0); ctx.lineTo(size / 2 + 0.5, size)
  ctx.moveTo(0, size / 2 + 0.5); ctx.lineTo(size, size / 2 + 0.5)
  ctx.stroke()

  if (net && task === 'classification' && showField) {
    const g = grid(net)
    const A = rgb(inks.a), B = rgb(inks.b), S = rgb(inks.surface)
    field ??= document.createElement('canvas')
    field.width = RES + 1
    field.height = RES + 1
    const fctx = field.getContext('2d')
    if (fctx) {
      const img = fctx.createImageData(RES + 1, RES + 1)
      for (let k = 0; k < g.length; k++) {
        const p = g[k]
        const strength = Math.min(1, Math.abs(p - 0.5) * 2) * 0.42
        const C = p >= 0.5 ? B : A
        for (let c = 0; c < 3; c++) img.data[k * 4 + c] = S[c] + (C[c] - S[c]) * strength
        img.data[k * 4 + 3] = 255
      }
      fctx.putImageData(img, 0, 0)
      ctx.save()
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(field, 0, 0, size, size)
      ctx.restore()
    }
    contour(ctx, g, size, inks.ink)
  }

  if (net && task === 'regression') {
    ctx.strokeStyle = inks.b
    ctx.lineWidth = 2.5
    ctx.beginPath()
    for (let i = 0; i <= 120; i++) {
      const x = -1 + (2 * i) / 120
      const y = Math.max(-1.2, Math.min(1.2, predict(net, [x])))
      if (i === 0) ctx.moveTo(px(x), py(y))
      else ctx.lineTo(px(x), py(y))
    }
    ctx.stroke()
  }

  // points: class 0 circles, class 1 squares; held-out points hollow
  const r = Math.max(3.5, size / 110)
  for (const p of pts) {
    const color = task === 'regression' ? inks.a : p.label ? inks.b : inks.a
    const x = px(p.x), y = py(p.y)
    ctx.beginPath()
    if (task === 'classification' && p.label) ctx.rect(x - r, y - r, r * 2, r * 2)
    else ctx.arc(x, y, r, 0, Math.PI * 2)
    if (p.test) {
      ctx.lineWidth = 2
      ctx.strokeStyle = color
      ctx.fillStyle = inks.surface
      ctx.fill(); ctx.stroke()
    } else {
      ctx.fillStyle = color
      ctx.lineWidth = 1.2
      ctx.strokeStyle = inks.surface
      ctx.fill(); ctx.stroke()
    }
  }

  if (cursor) {
    const x = px(cursor.x), y = py(cursor.y)
    ctx.strokeStyle = inks.ink
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(x - 10, y); ctx.lineTo(x - 4, y); ctx.moveTo(x + 4, y); ctx.lineTo(x + 10, y)
    ctx.moveTo(x, y - 10); ctx.lineTo(x, y - 4); ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 10)
    ctx.stroke()
  }
}

/** Marching squares for the p = 0.5 decision boundary. */
function contour(ctx: CanvasRenderingContext2D, g: Float32Array, size: number, ink: string) {
  const N = RES + 1
  const cell = size / RES
  const at = (i: number, j: number) => g[j * N + i] - 0.5
  ctx.strokeStyle = ink
  ctx.lineWidth = 1.8
  ctx.beginPath()
  for (let j = 0; j < RES; j++) {
    for (let i = 0; i < RES; i++) {
      const v = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]
      const corners: Array<[number, number]> = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]]
      const hits: Array<[number, number]> = []
      for (let e = 0; e < 4; e++) {
        const a = v[e], b = v[(e + 1) % 4]
        if ((a < 0) !== (b < 0)) {
          const t = a / (a - b)
          const [x0, y0] = corners[e], [x1, y1] = corners[(e + 1) % 4]
          hits.push([(x0 + (x1 - x0) * t) * cell, (y0 + (y1 - y0) * t) * cell])
        }
      }
      for (let h = 0; h + 1 < hits.length; h += 2) {
        ctx.moveTo(hits[h][0], hits[h][1])
        ctx.lineTo(hits[h + 1][0], hits[h + 1][1])
      }
    }
  }
  ctx.stroke()
}
