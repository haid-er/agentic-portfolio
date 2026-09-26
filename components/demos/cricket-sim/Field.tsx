'use client'
/**
 * Top-down field: boundary, 30-yard circle, the pitch with its hit zone, the
 * ball in flight (moved by the parent's rAF loop through `ballRef`) and a wagon
 * wheel of this innings' scoring shots. Colours come from tokens only.
 */
import type { RefObject } from 'react'
import type { Ball, Delivery, Pending } from './engine'

export const PITCH = { top: 72, bottom: 128 } // y of bowler's and batter's creases
export const ZONE = { from: 0.8, to: 0.92 } // share of the flight where timing is perfect-to-good

/** Where each delivery pitches (share of the flight; null = full toss) and its line (x at the batter). */
const LINE: Record<Delivery, { bounce: number | null; x: number; tag: string }> = {
  yorker: { bounce: 0.93, x: 100, tag: 'yorker' },
  good: { bounce: 0.58, x: 101, tag: 'length' },
  short: { bounce: 0.3, x: 100, tag: 'short' },
  full: { bounce: null, x: 100, tag: 'full toss' },
  wide: { bounce: 0.55, x: 107, tag: 'wide' },
}

const flightY = (p: number) => PITCH.top + (PITCH.bottom - PITCH.top) * p

/**
 * The ball at share `p` of its flight. A read delivery follows its own line and
 * climbs after pitching (bigger = higher, seen from above); a disguised one gives nothing away.
 */
export function ballAt(p: number, pending: Pending | null | undefined) {
  const line = pending?.read ? LINE[pending.delivery] : null
  const x = 100 + ((line?.x ?? 100) - 100) * Math.min(p, 1)
  const bounce = line?.bounce ?? null
  const rise = bounce === null || p < bounce ? 0 : (p - bounce) * (pending?.delivery === 'short' ? 3.2 : 0.8)
  return { x, y: flightY(p), r: 2.4 + Math.min(rise, 2) }
}

const shotEnd = (b: Ball) => {
  const runs = b.result.kind === 'runs' ? b.result.runs : b.result.kind === 'extra' ? b.result.runs - 1 : 0
  const len = runs >= 4 ? 90 : 26 + runs * 16
  const a = ((b.angle ?? 0) * Math.PI) / 180
  // Batter at the bottom crease facing up; leg side (positive angle) is to the left for a right-hander.
  return { x: 100 - Math.sin(a) * len, y: PITCH.bottom - 6 - Math.cos(a) * len, runs }
}

export function Field({ balls, ballRef, flying, showZone, pending, label }: {
  balls: Ball[]
  pending?: Pending | null
  ballRef: RefObject<SVGCircleElement | null>
  flying: boolean
  showZone: boolean
  label: string
}) {
  const shots = balls.filter((b) => b.angle !== null && b.result.kind !== 'wicket')
  const last = balls[balls.length - 1]
  const zoneY = flightY
  const read = pending?.read ? LINE[pending.delivery] : null
  return (
    <svg viewBox="0 0 200 200" className="block w-full max-w-[420px] mx-auto h-auto" role="img" aria-label={label}>
      <defs>
        <pattern id="cs-mow" width="200" height="16" patternUnits="userSpaceOnUse">
          <rect width="200" height="8" fill="var(--bg-2)" />
        </pattern>
      </defs>
      <circle cx="100" cy="100" r="96" fill="var(--surface)" stroke="var(--rule)" strokeWidth="1" />
      <circle cx="100" cy="100" r="95" fill="url(#cs-mow)" opacity="0.7" />
      <circle cx="100" cy="100" r="50" fill="none" stroke="var(--rule)" strokeWidth="0.6" strokeDasharray="2 3" opacity="0.8" />

      {/* wagon wheel */}
      {shots.map((b, i) => {
        const e = shotEnd(b)
        const isLast = b === last
        const color = e.runs >= 6 ? 'var(--data-2)' : e.runs === 4 ? 'var(--data-1)' : 'var(--ink-3)'
        return (
          <g key={i} opacity={isLast ? 1 : 0.75}>
            <line x1="100" y1={PITCH.bottom - 6} x2={e.x} y2={e.y} stroke={color} strokeWidth={isLast ? 2 : 1} strokeDasharray={e.runs >= 6 ? '4 2' : undefined} strokeLinecap="round" />
            {e.runs >= 4 ? <circle cx={e.x} cy={e.y} r={isLast ? 3 : 2} fill={color} /> : null}
          </g>
        )
      })}

      {/* pitch */}
      <rect x="92" y={PITCH.top - 8} width="16" height={PITCH.bottom - PITCH.top + 16} fill="var(--bg)" stroke="var(--rule)" strokeWidth="0.6" />
      {showZone ? (
        <g>
          <rect x="92" y={zoneY(ZONE.from)} width="16" height={zoneY(ZONE.to) - zoneY(ZONE.from)} fill="var(--accent)" opacity="0.28" />
          <text x="111" y={zoneY((ZONE.from + ZONE.to) / 2) + 2} className="font-mono" fontSize="5" fill="var(--ink-2)">hit zone</text>
        </g>
      ) : null}
      {read ? (
        <g aria-hidden="true">
          {read.bounce !== null ? (
            <circle cx={100 + (read.x - 100) * read.bounce} cy={zoneY(read.bounce)} r="3" fill="none" stroke="var(--accent-2)" strokeWidth="0.9" strokeDasharray="1.5 1" />
          ) : (
            <line x1={read.x} y1={PITCH.top + 2} x2={read.x} y2={PITCH.bottom - 10} stroke="var(--accent-2)" strokeWidth="0.7" strokeDasharray="1.5 1.5" />
          )}
          <text x="89" y={zoneY(read.bounce ?? 0.5) + 2} textAnchor="end" className="font-mono" fontSize="5" fill="var(--ink-2)">{read.tag}</text>
        </g>
      ) : null}
      <path d={`M90 ${PITCH.top}H110M90 ${PITCH.bottom}H110`} stroke="var(--ink)" strokeWidth="0.8" />
      {/* stumps */}
      <path d={`M98 ${PITCH.top - 3}v3M100 ${PITCH.top - 3}v3M102 ${PITCH.top - 3}v3M98 ${PITCH.bottom}v3M100 ${PITCH.bottom}v3M102 ${PITCH.bottom}v3`} stroke="var(--ink)" strokeWidth="0.9" />
      {/* batter + bowler marks */}
      <rect x="101.5" y={PITCH.bottom - 8} width="4" height="6" rx="1" fill="var(--ink)" />
      <circle cx="100" cy={PITCH.top - 10} r="2.5" fill="var(--ink-2)" />

      {/* the ball: positioned by the parent's animation loop */}
      <circle ref={ballRef} cx="100" cy={PITCH.top} r="2.4" fill="var(--accent-2)" stroke="var(--ink)" strokeWidth="0.5" opacity={flying ? 1 : 0} />
    </svg>
  )
}
