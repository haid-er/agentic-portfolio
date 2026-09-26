'use client'
/**
 * Top-down field: boundary, 30-yard circle, the pitch with its hit zone, the
 * ball in flight (moved by the parent's rAF loop through `ballRef`) and a wagon
 * wheel of this innings' scoring shots. Colours come from tokens only.
 */
import type { RefObject } from 'react'
import type { Ball } from './engine'

export const PITCH = { top: 72, bottom: 128 } // y of bowler's and batter's creases
export const ZONE = { from: 0.8, to: 0.92 } // share of the flight where timing is perfect-to-good

const shotEnd = (b: Ball) => {
  const runs = b.result.kind === 'runs' ? b.result.runs : b.result.kind === 'extra' ? b.result.runs - 1 : 0
  const len = runs >= 4 ? 90 : 26 + runs * 16
  const a = ((b.angle ?? 0) * Math.PI) / 180
  // Batter at the bottom crease facing up; leg side (positive angle) is to the left for a right-hander.
  return { x: 100 - Math.sin(a) * len, y: PITCH.bottom - 6 - Math.cos(a) * len, runs }
}

export function Field({ balls, ballRef, flying, showZone, label }: {
  balls: Ball[]
  ballRef: RefObject<SVGCircleElement | null>
  flying: boolean
  showZone: boolean
  label: string
}) {
  const shots = balls.filter((b) => b.angle !== null && b.result.kind !== 'wicket')
  const last = balls[balls.length - 1]
  const zoneY = (p: number) => PITCH.top + (PITCH.bottom - PITCH.top) * p
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
