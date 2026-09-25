/** Seismograph-style strip chart for the last 10 s of xyz, with 5 s windows marked. */
import { G, HZ, WIN } from './signal'
import type { SampleBuffer } from './stream'

export const VIEW_S = 10
const VIEW = VIEW_S * HZ
const RANGE = 20 // m/s^2 either side of zero

export interface Inks {
  x: string; y: string; z: string
  ink3: string; rule: string; soft: string; accent: string; surface: string; mono: string
}

export const INK_TOKENS = ['--data-1', '--data-2', '--data-3', '--ink-3', '--rule', '--rule-soft', '--accent', '--surface', '--font-mono'] as const

export function inksFrom(t: Record<(typeof INK_TOKENS)[number], string>): Inks {
  return {
    x: t['--data-1'] || '#1F6B47', y: t['--data-2'] || '#D2462A', z: t['--data-3'] || '#8F6414',
    ink3: t['--ink-3'] || '#5A6356', rule: t['--rule'] || '#1D2B22', soft: t['--rule-soft'] || 'rgba(0,0,0,.2)',
    accent: t['--accent'] || '#1F6B47', surface: t['--surface'] || '#F7F1E6', mono: t['--font-mono'] || 'ui-monospace, monospace',
  }
}

export const AXIS_DASH: Record<'x' | 'y' | 'z', number[]> = { x: [], y: [7, 4], z: [2, 3] }

export function drawStrip(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  buf: SampleBuffer,
  inks: Inks,
  labels: Map<number, string>,
  frac = 0,
) {
  ctx.clearRect(0, 0, w, h)
  const top = 22
  const bottom = h - 6
  const mid = (top + bottom) / 2
  const yOf = (v: number) => mid - (v / RANGE) * ((bottom - top) / 2)
  const end = buf.count + frac
  const px = w / VIEW
  const xOf = (i: number) => w - (end - i) * px
  const font = (size: number) => `${size}px ${inks.mono}`

  // graticule: zero, ±g, 1 s ticks
  ctx.lineWidth = 1
  ctx.strokeStyle = inks.soft
  ctx.setLineDash([])
  for (const v of [-G, 0, G]) {
    ctx.beginPath(); ctx.moveTo(0, yOf(v) + 0.5); ctx.lineTo(w, yOf(v) + 0.5); ctx.stroke()
  }
  const firstSec = Math.ceil((end - VIEW) / HZ)
  for (let s = firstSec; s * HZ <= end; s++) {
    const x = Math.round(xOf(s * HZ)) + 0.5
    ctx.beginPath(); ctx.moveTo(x, bottom - 4); ctx.lineTo(x, bottom); ctx.stroke()
  }
  ctx.fillStyle = inks.ink3
  ctx.font = font(10)
  ctx.textBaseline = 'middle'
  ctx.fillText('+g', 4, yOf(G) - 7)
  ctx.fillText('0', 4, yOf(0) - 7)
  ctx.fillText('−g', 4, yOf(-G) - 7)

  // 5 s windows: boundaries, labels, the one being filled
  const firstWin = Math.floor(Math.max(0, end - VIEW) / WIN)
  for (let k = firstWin; k * WIN <= end; k++) {
    const start = k * WIN
    const x0 = xOf(start)
    const x1 = xOf(start + WIN)
    const filling = start + WIN > buf.count
    if (filling) {
      ctx.save()
      ctx.globalAlpha = 0.08
      ctx.fillStyle = inks.accent
      ctx.fillRect(Math.max(0, x0), top, Math.min(w, xOf(end)) - Math.max(0, x0), bottom - top)
      ctx.restore()
    }
    if (x0 >= 0) {
      ctx.strokeStyle = inks.rule
      ctx.setLineDash([3, 3])
      ctx.beginPath(); ctx.moveTo(Math.round(x0) + 0.5, 0); ctx.lineTo(Math.round(x0) + 0.5, bottom); ctx.stroke()
      ctx.setLineDash([])
    }
    const full = filling ? `W${k + 1} · filling ${((buf.count - start) / HZ).toFixed(1)} s` : labels.get(start) ?? `W${k + 1}`
    const lx = Math.max(4, x0 + 6)
    const limit = Math.min(w, filling ? xOf(end) : x1) - 4
    ctx.font = font(11)
    // fall back to the short label when the long one does not fit its window
    const label = [full, `W${k + 1}`].find((t) => lx + ctx.measureText(t).width < limit)
    if (label) {
      const tw = ctx.measureText(label).width
      ctx.fillStyle = inks.surface
      ctx.fillRect(lx - 3, 3, tw + 6, 16)
      ctx.fillStyle = filling ? inks.ink3 : inks.rule
      ctx.fillText(label, lx, 11)
    }
  }

  // traces
  const from = Math.max(buf.first, Math.floor(end - VIEW) - 1)
  const axes: Array<['x' | 'y' | 'z', number, string]> = [['x', 0, inks.x], ['y', 1, inks.y], ['z', 2, inks.z]]
  ctx.lineWidth = 1.6
  ctx.lineJoin = 'round'
  for (const [name, k, color] of axes) {
    ctx.strokeStyle = color
    ctx.setLineDash(AXIS_DASH[name])
    ctx.beginPath()
    for (let i = from; i < buf.count; i++) {
      const v = Math.max(-RANGE, Math.min(RANGE, buf.axis(i, k)))
      const x = xOf(i + 1)
      if (i === from) ctx.moveTo(x, yOf(v))
      else ctx.lineTo(x, yOf(v))
    }
    ctx.stroke()
  }
  ctx.setLineDash([])
}
