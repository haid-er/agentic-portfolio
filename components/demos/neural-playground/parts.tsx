'use client'
/** SVG loss curve and network diagram for the neural playground. */
import type { Net } from './mlp'

export interface LossPoint { epoch: number; train: number; test?: number }

export function LossChart({ history, hasTest }: { history: LossPoint[]; hasTest: boolean }) {
  const W = 320, H = 120, P = 6
  if (history.length < 2) {
    return <div className="h-[120px] grid place-items-center bg-bg border border-rule-soft rounded-1 text-0 text-ink-3">The loss curve draws once training starts.</div>
  }
  const max = Math.max(1e-3, ...history.map((h) => Math.max(h.train, h.test ?? 0)))
  const last = history[history.length - 1].epoch || 1
  const first = history[0].epoch
  const x = (e: number) => P + ((e - first) / Math.max(1, last - first)) * (W - 2 * P)
  // square-root scale keeps the long, flat tail readable
  const y = (v: number) => H - P - Math.sqrt(v / max) * (H - 2 * P)
  const line = (key: 'train' | 'test') => history
    .filter((h) => h[key] != null)
    .map((h, i) => `${i ? 'L' : 'M'}${x(h.epoch).toFixed(1)} ${y(h[key] as number).toFixed(1)}`)
    .join('')
  return (
    <figure className="m-0 grid gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[120px] bg-bg border border-rule-soft rounded-1" role="img"
        aria-label={`Loss over ${last} epochs: train ${history[history.length - 1].train.toFixed(4)}`}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={P} x2={W - P} y1={y(max * f * f)} y2={y(max * f * f)} className="stroke-rule-soft" vectorEffect="non-scaling-stroke" />)}
        {hasTest ? <path d={line('test')} fill="none" className="stroke-data-2" strokeWidth={1.6} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" /> : null}
        <path d={line('train')} fill="none" className="stroke-data-1" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="flex flex-wrap gap-3 mono text-ink-3">
        <span className="inline-flex items-center gap-1.5"><svg width="18" height="6" aria-hidden="true"><line x1="0" x2="18" y1="3" y2="3" strokeWidth="2" style={{ stroke: 'var(--data-1)' }} /></svg>train</span>
        {hasTest ? <span className="inline-flex items-center gap-1.5"><svg width="18" height="6" aria-hidden="true"><line x1="0" x2="18" y1="3" y2="3" strokeWidth="2" strokeDasharray="5 3" style={{ stroke: 'var(--data-2)' }} /></svg>held out</span> : null}
        <span>√ scale</span>
      </figcaption>
    </figure>
  )
}

/** Nodes per layer; edge width = |weight|, solid = positive, dashed = negative. */
export function NetDiagram({ net, inputs }: { net: Net; inputs: string[] }) {
  const W = 320
  const widest = Math.max(...net.sizes)
  const H = Math.max(150, widest * 13 + 12)
  const r = Math.min(5.5, H / (widest + 1) / 2.6)
  const cols = net.sizes.length
  const xs = (l: number) => 24 + (l / Math.max(1, cols - 1)) * (W - 48)
  const ys = (n: number, k: number) => (H / (n + 1)) * (k + 1)
  let maxW = 1e-6
  net.W.forEach((w) => w.forEach((v) => { maxW = Math.max(maxW, Math.abs(v)) }))
  const edges: Array<{ x1: number; y1: number; x2: number; y2: number; w: number }> = []
  for (let l = 0; l < net.W.length; l++) {
    const nin = net.sizes[l], nout = net.sizes[l + 1]
    for (let o = 0; o < nout; o++) for (let i = 0; i < nin; i++) {
      edges.push({ x1: xs(l), y1: ys(nin, i), x2: xs(l + 1), y2: ys(nout, o), w: net.W[l][o * nin + i] })
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
      aria-label={`Network ${net.sizes.join(' → ')}. Solid lines are positive weights, dashed are negative; thickness is magnitude.`}>
      {edges.map((e, k) => (
        <line key={k} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          className={e.w >= 0 ? 'stroke-data-1' : 'stroke-data-2'}
          strokeWidth={0.3 + (Math.abs(e.w) / maxW) * 3}
          strokeDasharray={e.w >= 0 ? undefined : '3 2'}
          opacity={0.25 + (Math.abs(e.w) / maxW) * 0.7}
        />
      ))}
      {net.sizes.map((n, l) => Array.from({ length: n }, (_, k) => (
        <circle key={`${l}-${k}`} cx={xs(l)} cy={ys(n, k)} r={r} className="fill-surface stroke-ink" strokeWidth={1.4} />
      )))}
      {inputs.map((t, k) => (
        <text key={t} x={xs(0) - 10} y={ys(inputs.length, k) + 4} textAnchor="end" className="fill-ink-3 font-mono" fontSize="11">{t}</text>
      ))}
      <text x={xs(cols - 1) + 10} y={H / 2 + 4} className="fill-ink-3 font-mono" fontSize="11">ŷ</text>
    </svg>
  )
}
