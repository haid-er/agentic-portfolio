'use client'
/**
 * 2-D scatter of the projected vectors (SVG, token inks, shape per topic).
 * Points are a roving-focus group: Tab in, arrow keys move, Enter searches from that point.
 * Positions glide when the embedder changes (static under reduced motion).
 */
import { useRef, type KeyboardEvent } from 'react'
import { cx } from '@/lib/utils'
import { topicStyle, type Shape, type Topic } from './corpus'

export interface Pt {
  id: string
  text: string
  topic: Topic
  x: number
  y: number
  /** 1-based rank in the current top-k, when it is a hit. */
  rank?: number
  /** Excluded by the metadata filter. */
  muted?: boolean
}

const W = 400
const H = 260

export function Mark({ shape, r, fill, stroke, strokeWidth = 1 }: { shape: Shape; r: number; fill: string; stroke?: string; strokeWidth?: number }) {
  const common = { fill, stroke, strokeWidth }
  switch (shape) {
    case 'circle': return <circle r={r} {...common} />
    case 'square': return <rect x={-r * 0.85} y={-r * 0.85} width={r * 1.7} height={r * 1.7} {...common} />
    case 'triangle': return <path d={`M0 ${-r * 1.1}L${r} ${r * 0.75}H${-r}Z`} {...common} />
    case 'diamond': return <path d={`M0 ${-r * 1.15}L${r * 1.05} 0L0 ${r * 1.15}L${-r * 1.05} 0Z`} {...common} />
    case 'star': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = (Math.PI / 5) * i - Math.PI / 2
        const rr = i % 2 ? r * 0.5 : r * 1.2
        return `${(Math.cos(a) * rr).toFixed(2)} ${(Math.sin(a) * rr).toFixed(2)}`
      })
      return <path d={`M${pts.join('L')}Z`} {...common} />
    }
  }
}

export function Scatter({ points, query, activeId, onActive, onPick, reduced, busy }: {
  points: Pt[]
  query: { x: number; y: number } | null
  activeId: string | null
  onActive: (id: string | null) => void
  onPick: (id: string) => void
  reduced: boolean
  busy?: boolean
}) {
  const refs = useRef(new Map<string, SVGGElement>())
  // Keyboard order follows the reading direction: left to right, then top to bottom.
  const order = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const focusId = activeId && points.some((p) => p.id === activeId) ? activeId : order[0]?.id
  const glide = reduced ? undefined : 'transform var(--dur-slow) var(--ease-out), opacity var(--dur-med) var(--ease-out)'
  const hits = points.filter((p) => p.rank).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))

  const onKey = (e: KeyboardEvent, id: string) => {
    const i = order.findIndex((p) => p.id === id)
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (d) {
      e.preventDefault()
      const next = order[(i + d + order.length) % order.length]
      if (next) { onActive(next.id); refs.current.get(next.id)?.focus() }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onPick(id)
    } else if (e.key === 'Escape') onActive(null)
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cx('block w-full h-auto bg-bg rounded-1 border border-rule-soft touch-manipulation', busy && 'opacity-60')}
      aria-label="Two-dimensional projection of the sentence vectors. Use arrow keys to move between sentences and Enter to search with one."
      role="group"
    >
      {/* graticule */}
      <g aria-hidden="true" stroke="var(--rule-soft)" strokeWidth="1">
        {[0.25, 0.5, 0.75].map((f) => (
          <g key={f}>
            <line x1={W * f} x2={W * f} y1={0} y2={H} strokeDasharray={f === 0.5 ? undefined : '2 4'} />
            <line y1={H * f} y2={H * f} x1={0} x2={W} strokeDasharray={f === 0.5 ? undefined : '2 4'} />
          </g>
        ))}
      </g>
      <text x={W - 6} y={H / 2 - 5} textAnchor="end" className="font-mono" fontSize="9" fill="var(--ink-3)" aria-hidden="true">PC1</text>
      <text x={W / 2 + 5} y={11} className="font-mono" fontSize="9" fill="var(--ink-3)" aria-hidden="true">PC2</text>

      {/* query -> hit threads */}
      {query ? (
        <g aria-hidden="true">
          {hits.map((p) => (
            <line
              key={p.id}
              x1={query.x * W}
              y1={query.y * H}
              x2={p.x * W}
              y2={p.y * H}
              stroke="var(--accent)"
              strokeWidth={p.rank === 1 ? 1.8 : 1}
              strokeDasharray={p.rank === 1 ? undefined : '3 3'}
              opacity={1 - ((p.rank ?? 1) - 1) * 0.1}
            />
          ))}
        </g>
      ) : null}

      {points.map((p) => {
        const s = topicStyle(p.topic)
        const on = p.id === activeId
        return (
          <g
            key={p.id}
            ref={(el) => { if (el) refs.current.set(p.id, el); else refs.current.delete(p.id) }}
            role="button"
            tabIndex={p.id === focusId ? 0 : -1}
            aria-label={`${s.label}: ${p.text}${p.rank ? `. Rank ${p.rank}` : ''}${p.muted ? '. Filtered out' : ''}`}
            onPointerEnter={() => onActive(p.id)}
            onPointerLeave={() => onActive(null)}
            onFocus={() => onActive(p.id)}
            onClick={() => onPick(p.id)}
            onKeyDown={(e) => onKey(e, p.id)}
            className="cursor-pointer outline-none [&:focus-visible>.ring]:opacity-100"
            style={{ transform: `translate(${p.x * W}px, ${p.y * H}px)`, transition: glide, opacity: p.muted ? 0.28 : 1 }}
          >
            <circle r="14" fill="transparent" />
            <circle className="ring opacity-0" r="11" fill="none" stroke="var(--focus)" strokeWidth="2" />
            {on ? <circle r="10" fill="none" stroke="var(--ink)" strokeWidth="1" /> : null}
            <Mark shape={s.shape} r={p.rank ? 6 : 4.6} fill={s.ink} stroke={p.rank ? 'var(--ink)' : 'var(--surface)'} strokeWidth={p.rank ? 1.4 : 1} />
            {p.rank ? (
              <text x="8" y="-7" className="font-mono" fontSize="10" fontWeight="600" fill="var(--ink)" aria-hidden="true">{p.rank}</text>
            ) : null}
          </g>
        )
      })}

      {query ? (
        <g aria-hidden="true" style={{ transform: `translate(${query.x * W}px, ${query.y * H}px)`, transition: glide }}>
          <circle r="9" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.6" />
          <path d="M-13 0H13M0 -13V13" stroke="var(--accent)" strokeWidth="1.2" />
          <circle r="2.4" fill="var(--accent)" />
        </g>
      ) : null}
    </svg>
  )
}
