'use client'
/** SVG signal plot for one recording, with the overlays each pipeline step adds. */
import { cx } from '@/lib/utils'
import { G, RATE } from './data'
import { gravitySplit, impactIndex, magnitude, type Entry } from './pipeline'

export type PlotMode = 'magnitude' | 'gravity'

const W = 600
const H = 180

function path(values: number[], lo: number, hi: number) {
  if (!values.length) return ''
  const sx = W / Math.max(1, values.length - 1)
  const sy = (v: number) => H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 12)
  let d = ''
  // decimate to ~1 point per SVG unit
  const step = Math.max(1, Math.floor(values.length / W))
  for (let i = 0; i < values.length; i += step) d += `${i ? 'L' : 'M'}${(i * sx).toFixed(1)} ${sy(values[i]).toFixed(1)}`
  return d
}

export function Plot({ rows, mode, cutoff, windows, tailFrom, segment, threshold, removed, stageLabel }: {
  rows: number[][]
  mode: PlotMode
  cutoff: number
  /** Window spans in seconds (step 5+). */
  windows?: Array<{ start: number; end: number; label: string; active?: boolean }>
  /** Dropped tail start in seconds. */
  tailFrom?: number
  /** Impact segment + threshold (step 8, fall recordings). */
  segment?: { start: number; end: number } | null
  threshold?: number
  removed?: boolean
  stageLabel: string
}) {
  const n = rows.length
  const dur = n / RATE
  const x = (s: number) => (s / dur) * 100 // percent
  const mag = rows.map(magnitude)
  let lines: Array<{ d: string; cls: string; dash?: string; width: number }> = []
  let lo = 0, hi = 1
  let legend: Array<{ label: string; ink: string; dash?: string }> = []

  if (mode === 'magnitude') {
    hi = Math.max(2 * G, ...mag, threshold ?? 0) * 1.08
    lines = [{ d: path(mag, lo, hi), cls: 'stroke-data-1', width: 1.4 }]
    legend = [{ label: '|a| m/s²', ink: 'var(--data-1)' }]
  } else {
    const ay = rows.map((r) => r[2])
    const { gravity, body } = gravitySplit(ay, cutoff)
    const m = Math.max(G * 1.2, ...ay.map(Math.abs), ...body.map(Math.abs))
    lo = -m * 0.6; hi = m * 1.05
    lines = [
      { d: path(ay, lo, hi), cls: 'stroke-ink-3', width: 1 },
      { d: path(body, lo, hi), cls: 'stroke-data-2', width: 1.2, dash: '4 3' },
      { d: path(gravity, lo, hi), cls: 'stroke-data-1', width: 2.4 },
    ]
    legend = [
      { label: 'raw ay', ink: 'var(--ink-3)' },
      { label: 'gravity (low-pass)', ink: 'var(--data-1)' },
      { label: 'body = raw − gravity', ink: 'var(--data-2)', dash: '4 3' },
    ]
  }
  const yPct = (v: number) => (1 - (v - lo) / (hi - lo || 1)) * 100
  const peak = segment ? impactIndex(rows) : -1

  return (
    <figure className="m-0 grid gap-2">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className={cx('block w-full h-[180px] md:h-[220px] bg-bg rounded-1 border border-rule-soft', removed && 'opacity-45')}
          role="img"
          aria-label={`${stageLabel}: ${dur.toFixed(1)} s recording${windows?.length ? `, ${windows.length} windows` : ''}${segment ? ', impact segment marked' : ''}${removed ? ', removed at this step' : ''}.`}
        >
          {windows?.map((w, i) => (
            <rect
              key={i}
              x={(w.start / dur) * W} width={((w.end - w.start) / dur) * W} y={0} height={H}
              className={w.active ? 'fill-accent' : i % 2 ? 'fill-ink-3' : 'fill-bg-2'}
              opacity={w.active ? 0.14 : i % 2 ? 0.08 : 0.9}
            />
          ))}
          {tailFrom != null && tailFrom < dur ? (
            <rect x={(tailFrom / dur) * W} width={((dur - tailFrom) / dur) * W} y={0} height={H} className="fill-danger" opacity={0.1} />
          ) : null}
          {segment ? (
            <rect x={(segment.start / dur) * W} width={((segment.end - segment.start) / dur) * W} y={0} height={H} className="fill-data-2" opacity={0.16} />
          ) : null}
          {mode === 'magnitude' ? (
            <line x1={0} x2={W} y1={(yPct(G) / 100) * H} y2={(yPct(G) / 100) * H} className="stroke-rule-soft" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
          ) : null}
          {threshold != null && mode === 'magnitude' ? (
            <line x1={0} x2={W} y1={(yPct(threshold) / 100) * H} y2={(yPct(threshold) / 100) * H} className="stroke-danger" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
          ) : null}
          {lines.map((l, i) => (
            <path key={i} d={l.d} fill="none" className={l.cls} strokeWidth={l.width} strokeDasharray={l.dash} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          ))}
        </svg>
        {/* HTML labels so text never stretches with the SVG */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {windows?.map((w, i) => (
            <span key={i} className="absolute top-1 mono text-ink-3 px-1 bg-surface/80" style={{ left: `calc(${x(w.start)}% + 2px)` }}>
              {x(w.end) - x(w.start) > 9 ? w.label : ''}
            </span>
          ))}
          {tailFrom != null && tailFrom < dur && x(dur) - x(tailFrom) > 8 ? (
            <span className="absolute bottom-1 mono text-danger px-1 bg-surface" style={{ left: `calc(${x(tailFrom)}% + 2px)` }}>tail</span>
          ) : null}
          {threshold != null && mode === 'magnitude' ? (
            <span className="absolute right-1 mono text-danger px-1 bg-surface" style={{ top: `calc(${yPct(threshold)}% - 1.4em)` }}>{(threshold / G).toFixed(1)} g</span>
          ) : null}
          {peak >= 0 && segment ? (
            <span className="absolute bottom-1 mono text-ink px-1 bg-surface border border-rule" style={{ left: `clamp(0px, calc(${x(peak / RATE)}% - 3em), calc(100% - 7em))` }}>impact</span>
          ) : null}
          {mode === 'magnitude' ? (
            <span className="absolute left-1 mono text-ink-3 px-1 bg-surface" style={{ top: `calc(${yPct(G)}% + 0.2em)` }}>1 g</span>
          ) : null}
        </div>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 mono text-ink-3">
        <span className="flex flex-wrap gap-3">
          {legend.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <svg width="20" height="6" aria-hidden="true"><line x1="0" x2="20" y1="3" y2="3" strokeWidth="2" style={{ stroke: l.ink }} strokeDasharray={l.dash} /></svg>
              {l.label}
            </span>
          ))}
        </span>
        <span className="nums">{dur.toFixed(1)} s · {n} rows · {RATE} Hz</span>
      </figcaption>
    </figure>
  )
}

export function spansFor(entries: Entry[], source: string) {
  return entries.flatMap((e) => (e.source === source && e.span ? [{ key: e.key, kind: e.kind, ...e.span }] : []))
}
