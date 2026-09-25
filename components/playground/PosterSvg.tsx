/**
 * The poster drawing itself (server + client safe, no hooks). Draws the seeded
 * shapes, then the "print" shapes again in the overprint ink, slightly out of
 * register; the overprint shows while the parent card (`group`) is hovered or focused.
 */
import type { Ref } from 'react'
import { H, makePoster, W, type PosterKind, type Shape } from './posters'

function Shapes({ shapes, overprint }: { shapes: Shape[]; overprint?: boolean }) {
  return (
    <>
      {shapes.map((s, i) => {
        if (overprint && !s.print) return null
        const ink = overprint ? 'var(--overprint)' : undefined
        return (
          <path
            key={i}
            d={s.d}
            fill={s.fill ? (ink ?? s.fill) : 'none'}
            stroke={s.stroke ? (ink ?? s.stroke) : undefined}
            strokeWidth={s.width}
            strokeDasharray={s.dash}
            opacity={s.opacity}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </>
  )
}

function Graticule() {
  const v = Array.from({ length: 9 }, (_, i) => `M${(i + 1) * 32} 0V${H}`).join('')
  const h = Array.from({ length: 4 }, (_, i) => `M0 ${(i + 1) * 40}H${W}`).join('')
  return <path d={v + h} stroke="var(--rule-soft)" strokeWidth={1} fill="none" />
}

export function PosterSvg({ slug, glyph, trackRef, className }: {
  slug: string
  glyph: PosterKind
  /** Live traces: the scrolling group (two copies of one period side by side). */
  trackRef?: Ref<SVGGElement>
  className?: string
}) {
  const poster = makePoster(slug, glyph)
  const loop = poster.loop ?? []
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" className={className}>
      <Graticule />
      {loop.length ? (
        <g ref={trackRef}>
          <Shapes shapes={loop} />
          <g transform={`translate(${W} 0)`}><Shapes shapes={loop} /></g>
          <g className="opacity-0 transition-opacity duration-[var(--dur-med)] group-hover:opacity-100 group-focus-within:opacity-100" transform="translate(2 1.5)">
            <Shapes shapes={loop} overprint />
            <g transform={`translate(${W} 0)`}><Shapes shapes={loop} overprint /></g>
          </g>
        </g>
      ) : null}
      <Shapes shapes={poster.shapes} />
      <g className="opacity-0 transition-opacity duration-[var(--dur-med)] group-hover:opacity-100 group-focus-within:opacity-100" transform="translate(2 1.5)">
        <Shapes shapes={poster.shapes} overprint />
      </g>
    </svg>
  )
}
