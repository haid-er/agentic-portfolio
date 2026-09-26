/** Service-area map: bases, job pins and each technician's route, drawn in the world's inks. */
import type { CSSProperties, KeyboardEvent } from 'react'
import { cx } from '@/lib/utils'
import { inkFor, markerPath } from './ink'
import { clock, type Job, type Plan, type Tech } from './model'

const U = 10 // svg units per km
const SIZE = 200

export function MapView({ techs, jobs, plan, selected, onSelect, animate, drawKey }: {
  techs: Tech[]
  jobs: Job[]
  plan: Plan
  selected: string | null
  onSelect: (id: string) => void
  animate: boolean
  drawKey: string
}) {
  const where = new Map<string, { ti: number; n: number }>()
  plan.routes.forEach((r, ti) => r.stops.forEach((s, n) => where.set(s.job.id, { ti, n: n + 1 })))

  const key = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id) }
  }

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block w-full h-auto max-w-[560px] mx-auto bg-bg-2 border border-rule rounded-1"
      role="group" aria-label="Service area map. Job pins are buttons; the job list below has the same actions.">
      {/* ground: 2 km graticule, two arterials and a river, all decorative */}
      <g aria-hidden="true">
        {Array.from({ length: 11 }, (_, i) => i * 20).map((v) => (
          <g key={v} className="stroke-rule-soft" strokeWidth={0.4}>
            <line x1={v} y1={0} x2={v} y2={SIZE} />
            <line x1={0} y1={v} x2={SIZE} y2={v} />
          </g>
        ))}
        <path d="M0 120 C 50 110, 80 140, 120 118 S 180 90, 200 98" className="stroke-rule-soft fill-none" strokeWidth={5} strokeLinecap="round" />
        <line x1={96} y1={0} x2={104} y2={SIZE} className="stroke-rule-soft" strokeWidth={2} />
        <line x1={0} y1={62} x2={SIZE} y2={70} className="stroke-rule-soft" strokeWidth={2} />
        <text x={4} y={SIZE - 4} className="fill-ink-3 font-mono" fontSize={5}>2 km grid</text>
      </g>

      {/* routes */}
      <g aria-hidden="true">
        {plan.routes.map((r, ti) => {
          if (r.stops.length === 0) return null
          const pts = [r.tech, ...r.stops.map((s) => s.job), r.tech].map((p) => `${(p.x * U).toFixed(1)},${(p.y * U).toFixed(1)}`).join(' ')
          return (
            <polyline key={`${drawKey}-${r.tech.id}`} points={pts} pathLength={1}
              className={cx('fill-none', inkFor(ti).stroke, animate && 'motion-safe:animate-[drill_var(--dur-slow)_var(--ease-out)_both]')}
              strokeWidth={1.6} strokeLinejoin="round"
              style={animate ? ({ strokeDasharray: 1, '--drill-len': 1 } as CSSProperties) : undefined} />
          )
        })}
      </g>

      {/* bases */}
      {techs.map((t, ti) => (
        <g key={t.id} aria-hidden="true">
          <rect x={t.x * U - 6} y={t.y * U - 6} width={12} height={12} className={cx('stroke-ink', inkFor(ti).fill)} strokeWidth={0.8} />
          <text x={t.x * U} y={t.y * U + 2.4} textAnchor="middle" fontSize={7} className="fill-surface font-mono font-bold">{t.id}</text>
        </g>
      ))}

      {/* job pins */}
      {jobs.map((j) => {
        const w = where.get(j.id)
        const ink = w ? inkFor(w.ti) : null
        const x = j.x * U
        const y = j.y * U
        const on = selected === j.id
        const label = `${j.id}, ${j.skill}, window ${clock(j.windowStart)} to ${clock(j.windowEnd)}${j.urgent ? ', urgent' : ''}. ${w ? `Technician ${techs[w.ti]?.name}, stop ${w.n}` : 'Unassigned'}`
        return (
          <g key={j.id} role="button" tabIndex={0} aria-label={label} aria-pressed={on}
            onClick={() => onSelect(j.id)} onKeyDown={key(j.id)}
            className="cursor-pointer outline-none [&:focus-visible>.ring]:opacity-100">
            <circle cx={x} cy={y} r={13} className="fill-transparent" />
            <circle cx={x} cy={y} r={10} className={cx('ring fill-none stroke-focus', on ? 'opacity-100' : 'opacity-0')} strokeWidth={1.6} />
            <path d={markerPath(ink?.shape ?? 'circle', x, y, 5.5)}
              className={cx(ink ? ink.fill : 'fill-surface', 'stroke-ink')}
              strokeWidth={ink ? 0.8 : 1} strokeDasharray={ink ? undefined : '2 1.4'} />
            {j.urgent ? <circle cx={x + 6} cy={y - 6} r={2.4} className="fill-danger stroke-surface" strokeWidth={0.6} /> : null}
            <text x={x} y={y - 8.5} textAnchor="middle" fontSize={5.2} className="fill-ink font-mono" paintOrder="stroke" stroke="var(--bg-2)" strokeWidth={1.6}>
              {w ? `${techs[w.ti]?.id}${w.n}` : j.id}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
