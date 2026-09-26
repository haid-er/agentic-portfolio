'use client'
/**
 * One strip chart per metric, drawn in real pixels (the width is measured) so markers stay
 * round and hairlines stay crisp. Devices differ by ink AND dash pattern; threshold breaches
 * are marked with triangles, so colour is never the only signal.
 */
import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { cx } from '@/lib/utils'
import { isBreach, type MetricDef } from './generator'
import type { Sample } from './useTelemetry'

export const DEVICE_STROKE = ['stroke-data-1', 'stroke-data-2', 'stroke-data-3'] as const
export const DEVICE_FILL = ['fill-data-1', 'fill-data-2', 'fill-data-3'] as const
export const DEVICE_DASH = [undefined, '7 4', '2 3'] as const

const H = 150
const PAD = { top: 10, right: 8, bottom: 18, left: 40 }

function useWidth<T extends Element>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [w, setW] = useState(320)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => { if (e) setW(Math.max(200, Math.round(e.contentRect.width))) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

export function Chart({ metric, metricIndex, samples, span, windowSec, threshold, hidden, devices, hoverSeq, onHover }: {
  metric: MetricDef
  metricIndex: number
  samples: Sample[]
  /** Number of sample slots across the chart (window seconds × hz). */
  span: number
  windowSec: number
  threshold: number
  hidden: boolean[]
  devices: string[]
  hoverSeq: number | null
  onHover: (seq: number | null) => void
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const innerW = width - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const last = samples[samples.length - 1]
  const endSeq = last ? last.seq : 0
  const startSeq = endSeq - span + 1
  const x = (seq: number) => PAD.left + ((seq - startSeq) / Math.max(1, span - 1)) * innerW
  const y = (v: number) => PAD.top + (1 - (v - metric.min) / (metric.max - metric.min)) * innerH
  const ty = y(threshold)

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!samples.length) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    const seq = Math.round(startSeq + ((px - PAD.left) / innerW) * (span - 1))
    const first = samples[0] as Sample
    onHover(Math.min(endSeq, Math.max(first.seq, seq)))
  }

  const hover = hoverSeq !== null ? samples.find((s) => s.seq === hoverSeq) : undefined
  const shown = hover ?? last
  const breachZone = metric.dir === 'above' ? { y: PAD.top, h: Math.max(0, ty - PAD.top) } : { y: ty, h: Math.max(0, PAD.top + innerH - ty) }

  return (
    <figure className="m-0 grid gap-1 min-w-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="mono text-ink-2">{metric.label} · {metric.unit}</span>
        <span className="mono text-ink-3 nums">
          {metric.dir === 'above' ? 'alert above' : 'alert below'} {threshold.toFixed(metric.decimals)}
        </span>
      </figcaption>
      <div ref={ref} className="min-w-0">
        <svg
          width={width}
          height={H}
          viewBox={`0 0 ${width} ${H}`}
          className="block max-w-full font-mono touch-pan-y"
          role="img"
          aria-label={`${metric.label} chart. ${shown ? devices.map((d, i) => `${d} ${shown.values[i]?.[metricIndex]} ${metric.unit}`).join(', ') : 'No data yet'}.`}
          onPointerMove={onMove}
          onPointerLeave={() => onHover(null)}
        >
          <rect x={PAD.left} y={breachZone.y} width={innerW} height={breachZone.h} className="fill-danger" opacity={0.07} />
          {[0, 0.5, 1].map((f) => {
            const v = metric.min + f * (metric.max - metric.min)
            return (
              <g key={f}>
                <line x1={PAD.left} x2={PAD.left + innerW} y1={y(v)} y2={y(v)} className="stroke-rule-soft" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(v) + 4} fontSize={10} textAnchor="end" className="fill-ink-3">{v.toFixed(metric.decimals > 1 ? 1 : 0)}</text>
              </g>
            )
          })}
          <line x1={PAD.left} x2={PAD.left + innerW} y1={ty} y2={ty} className="stroke-danger" strokeWidth={1.5} strokeDasharray="5 4" />
          {devices.map((_, d) => {
            if (hidden[d]) return null
            const pts = samples.filter((s) => s.seq >= startSeq).map((s) => `${x(s.seq).toFixed(1)},${y(s.values[d]?.[metricIndex] ?? metric.min).toFixed(1)}`)
            if (pts.length < 2) return null
            return <polyline key={d} points={pts.join(' ')} fill="none" className={DEVICE_STROKE[d]} strokeWidth={1.75} strokeDasharray={DEVICE_DASH[d]} strokeLinejoin="round" />
          })}
          {devices.map((_, d) => hidden[d] ? null : samples.filter((s) => s.seq >= startSeq && isBreach(metric, s.values[d]?.[metricIndex] ?? 0, threshold)).map((s) => {
            const cx0 = x(s.seq)
            const cy0 = y(s.values[d]?.[metricIndex] ?? 0)
            const up = metric.dir === 'above' ? -1 : 1
            return <path key={`${d}-${s.seq}`} d={`M${cx0 - 4},${cy0} L${cx0 + 4},${cy0} L${cx0},${cy0 + up * 7} Z`} className={cx(DEVICE_FILL[d], 'stroke-ink')} strokeWidth={0.75} />
          }))}
          {hover ? <line x1={x(hover.seq)} x2={x(hover.seq)} y1={PAD.top} y2={PAD.top + innerH} className="stroke-ink" strokeWidth={1} /> : null}
          <text x={PAD.left} y={H - 4} fontSize={10} className="fill-ink-3">-{windowSec}s</text>
          <text x={PAD.left + innerW} y={H - 4} fontSize={10} textAnchor="end" className="fill-ink-3">now</text>
        </svg>
      </div>
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 font-mono text-00 text-ink-2 nums" aria-hidden="true">
        {shown ? devices.map((dname, d) => {
          const v = shown.values[d]?.[metricIndex]
          if (hidden[d] || v === undefined) return null
          const bad = isBreach(metric, v, threshold)
          return (
            <span key={dname} className={cx(bad && 'text-danger')}>
              {dname} {v.toFixed(metric.decimals)}{bad ? (metric.dir === 'above' ? ' ▲ alert' : ' ▼ alert') : ''}
            </span>
          )
        }) : <span className="text-ink-3">waiting for data</span>}
        {hover ? <span className="text-ink-3">at seq {hover.seq}</span> : null}
      </p>
    </figure>
  )
}

