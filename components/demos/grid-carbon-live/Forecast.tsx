'use client'
/**
 * 48-hour intensity chart in SVG, drawn at the container's real pixel width (no scaling of text).
 * Bars take the index band's ink AND the readout names the band, so colour is never the only signal.
 * Pointer hover or arrow keys move a cursor; the readout above the chart reports that half hour.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { BAND_INK, bandOf, ukTime, type Point, type Window } from './api'

const H = 210
const M = { top: 26, right: 8, bottom: 26, left: 38 }

export function ForecastChart({ series, nowIdx, best, bestLabel }: {
  series: Point[]
  nowIdx: number
  best: Window | null
  bestLabel: string
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const [cursor, setCursor] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = series.length
  const max = Math.max(...series.map((p) => p.value), 50)
  const yMax = Math.ceil((max * 1.1) / 50) * 50
  const innerW = Math.max(0, w - M.left - M.right)
  const innerH = H - M.top - M.bottom
  const bw = n ? innerW / n : 0
  const x = (i: number) => M.left + i * bw
  const y = (v: number) => M.top + innerH - (v / yMax) * innerH
  const ticks = [0, yMax / 2, yMax]

  const shown = cursor ?? nowIdx
  const p = series[shown]

  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.floor((e.clientX - r.left - M.left) / bw)
    if (i >= 0 && i < n) setCursor(i)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = cursor ?? nowIdx
    let next = cur
    if (e.key === 'ArrowRight') next = Math.min(n - 1, cur + 1)
    else if (e.key === 'ArrowLeft') next = Math.max(0, cur - 1)
    else if (e.key === 'PageDown') next = Math.min(n - 1, cur + 12)
    else if (e.key === 'PageUp') next = Math.max(0, cur - 12)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else if (e.key === 'Escape') { setCursor(null); return }
    else return
    e.preventDefault()
    setCursor(next)
  }

  return (
    <div className="grid gap-2">
      <p className="m-0 min-h-[1.5em] flex flex-wrap items-baseline gap-x-2 text-0" aria-live={cursor === null ? 'off' : 'polite'}>
        {p ? (
          <>
            <span className="mono text-ink-3">{cursor === null || cursor === nowIdx ? 'Now' : ukTime(p.from, true)}</span>
            <span className="nums font-semibold text-ink">{p.value} g/kWh</span>
            <span className="mono text-ink-2">{p.index}</span>
            <span className="mono text-ink-3">· {p.actual ? 'measured' : 'forecast'} · {ukTime(p.from)}–{ukTime(p.to)} UK</span>
          </>
        ) : null}
      </p>
      <div
        ref={wrap}
        tabIndex={0}
        role="group"
        aria-roledescription="chart"
        aria-label={`48-hour carbon intensity forecast, ${n} half-hour slots. Arrow keys step through them, Page Up and Page Down jump six hours.`}
        onKeyDown={onKey}
        onBlur={() => setCursor(null)}
        className="relative w-full rounded-0"
      >
        {w > 0 && n > 0 ? (
          <svg width={w} height={H} className="block touch-pan-y" onPointerMove={fromPointer} onPointerDown={fromPointer} onPointerLeave={() => setCursor(null)} aria-hidden="true">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={w - M.right} y1={y(t)} y2={y(t)} stroke="var(--rule-soft)" />
                <text x={M.left - 6} y={y(t) + 4} textAnchor="end" className="font-mono" fontSize={12} fill="var(--ink-3)">{t}</text>
              </g>
            ))}
            {best ? (
              <g>
                <rect x={x(best.start)} y={M.top - 4} width={(best.end - best.start + 1) * bw} height={innerH + 4} fill="var(--bg-2)" />
                <path
                  d={`M${x(best.start) + 1} ${M.top - 2} V${M.top - 8} H${x(best.end + 1) - 1} V${M.top - 2}`}
                  fill="none" stroke="var(--accent)" strokeWidth={2}
                />
                <text
                  x={Math.min(Math.max(x(best.start), M.left), w - M.right - 90)}
                  y={M.top - 12}
                  className="font-mono" fontSize={12} fill="var(--accent-ink)"
                >
                  {bestLabel}
                </text>
              </g>
            ) : null}
            {series.map((pt, i) => (
              <rect
                key={pt.from}
                x={x(i) + (bw > 4 ? 0.5 : 0)}
                y={y(pt.value)}
                width={Math.max(1, bw - (bw > 4 ? 1 : 0))}
                height={Math.max(1, y(0) - y(pt.value))}
                fill={BAND_INK[bandOf(pt.index)]}
                opacity={pt.actual ? 1 : i === shown ? 1 : 0.78}
              />
            ))}
            <line x1={x(nowIdx)} x2={x(nowIdx)} y1={M.top - 4} y2={y(0)} stroke="var(--ink)" strokeDasharray="3 3" />
            {cursor !== null && cursor !== nowIdx ? (
              <line x1={x(cursor) + bw / 2} x2={x(cursor) + bw / 2} y1={M.top} y2={y(0)} stroke="var(--ink)" strokeWidth={1.5} />
            ) : null}
            {series.map((pt, i) => {
              const d = new Date(pt.from)
              const hh = ukTime(pt.from)
              const label = hh === '00:00' ? new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/London' }).format(d) : hh
              const every = w < 520 ? 12 : 6
              if (!['00:00', '06:00', '12:00', '18:00'].includes(hh) || (every === 12 && !['00:00', '12:00'].includes(hh))) return null
              return (
                <g key={`t${pt.from}`}>
                  <line x1={x(i)} x2={x(i)} y1={y(0)} y2={y(0) + 4} stroke="var(--rule)" />
                  <text x={x(i)} y={H - 8} textAnchor="middle" className="font-mono" fontSize={12} fill={hh === '00:00' ? 'var(--ink)' : 'var(--ink-3)'}>{label}</text>
                </g>
              )
            })}
            <line x1={M.left} x2={w - M.right} y1={y(0)} y2={y(0)} stroke="var(--rule)" />
          </svg>
        ) : <div style={{ height: H }} />}
      </div>
      <ul className="m-0 p-0 list-none flex flex-wrap gap-x-4 gap-y-1 text-00 text-ink-2" aria-label="Legend">
        {(['low', 'moderate', 'high'] as const).map((b) => (
          <li key={b} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block size-3 border border-rule" style={{ background: BAND_INK[b] }} />
            {b === 'low' ? 'Low / very low' : b === 'moderate' ? 'Moderate' : 'High / very high'}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block w-4 border-t border-dashed border-ink" /> Now
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-3 bg-bg-2 border-t-2 border-accent" /> Best window
        </li>
      </ul>
    </div>
  )
}
