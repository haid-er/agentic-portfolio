/** Gantt of the day: drive (hatched), wait (thin line) and job blocks per technician. */
import { cx } from '@/lib/utils'
import { inkFor } from './ink'
import { clock, DAY_END, DAY_START, type Plan } from './model'

const pct = (m: number) => `${((m - DAY_START) / (DAY_END - DAY_START)) * 100}%`
const width = (a: number, b: number) => `${(Math.max(0, b - a) / (DAY_END - DAY_START)) * 100}%`
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60)

export function Timeline({ plan, selected, onSelect }: { plan: Plan; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="grid gap-2 text-00">
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2" aria-hidden="true">
        <span />
        <div className="relative h-4">
          {HOURS.filter((_, i) => i % 2 === 0).map((h) => (
            <span key={h} className="absolute mono text-ink-3 -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: pct(h) }}>{clock(h).slice(0, 2)}</span>
          ))}
        </div>
      </div>
      {plan.routes.map((r, ti) => {
        const ink = inkFor(ti)
        let cursor = r.tech.shiftStart
        return (
          <div key={r.tech.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 items-center">
            <span className="flex items-center gap-1 min-w-0">
              <span aria-hidden="true" className={cx('inline-block size-2.5 shrink-0', ink.bg)} />
              <span className="truncate font-mono">{r.tech.name}</span>
            </span>
            <div className="relative h-9 overflow-hidden bg-bg-2 border border-rule-soft rounded-0"
              role="group" aria-label={`${r.tech.name}: shift ${clock(r.tech.shiftStart)} to ${clock(r.tech.shiftEnd)}, ${r.stops.length} jobs`}>
              {/* off-shift shading */}
              <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(90deg,var(--rule-soft)_0_1px,transparent_1px_4px)]" style={{ width: width(DAY_START, r.tech.shiftStart) }} />
              <span aria-hidden="true" className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(90deg,var(--rule-soft)_0_1px,transparent_1px_4px)]" style={{ width: width(r.tech.shiftEnd, DAY_END) }} />
              {r.stops.map((s) => {
                const driveFrom = cursor
                cursor = s.end
                const on = selected === s.job.id
                return (
                  <div key={s.job.id} className="contents">
                    <span aria-hidden="true" className="absolute top-[40%] h-[20%] bg-[repeating-linear-gradient(135deg,var(--ink-3)_0_1.5px,transparent_1.5px_4px)]"
                      style={{ left: pct(driveFrom), width: width(driveFrom, s.arrive) }} />
                    {s.wait > 1 ? <span aria-hidden="true" className="absolute top-1/2 h-px bg-ink-3" style={{ left: pct(s.arrive), width: width(s.arrive, s.start) }} /> : null}
                    <button type="button" onClick={() => onSelect(s.job.id)} aria-pressed={on}
                      aria-label={`${s.job.id} ${s.job.skill}, ${clock(s.start)} to ${clock(s.end)}${s.late > 0 ? `, ${Math.round(s.late)} minutes late` : ''}`}
                      className={cx('absolute inset-y-1 overflow-hidden px-0.5 text-left font-mono text-[10px] leading-none text-surface border',
                        ink.bg, s.late > 0 ? 'border-danger border-2' : 'border-ink', on && 'outline-2 outline-offset-1 outline-focus outline')}
                      style={{ left: pct(s.start), width: width(s.start, s.end) }}>
                      <span className="sr-only md:not-sr-only">{s.job.id}</span>
                    </button>
                  </div>
                )
              })}
              {r.stops.length ? (
                <span aria-hidden="true" className="absolute top-[40%] h-[20%] bg-[repeating-linear-gradient(135deg,var(--ink-3)_0_1.5px,transparent_1.5px_4px)]"
                  style={{ left: pct(cursor), width: width(cursor, r.returnAt) }} />
              ) : null}
              {r.overtime > 0 ? <span className="absolute top-0 right-0 mono text-danger bg-surface px-1">+{Math.round(r.overtime)}m<span className="sr-only"> overtime</span></span> : null}
            </div>
          </div>
        )
      })}
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-ink-3">
        <span className="flex items-center gap-1"><span aria-hidden="true" className="inline-block w-5 h-2 bg-[repeating-linear-gradient(135deg,var(--ink-3)_0_1.5px,transparent_1.5px_4px)]" /> driving</span>
        <span className="flex items-center gap-1"><span aria-hidden="true" className="inline-block w-5 h-px bg-ink-3" /> waiting for window</span>
        <span className="flex items-center gap-1"><span aria-hidden="true" className="inline-block w-4 h-3 border-2 border-danger" /> late</span>
        <span className="flex items-center gap-1"><span aria-hidden="true" className="inline-block w-5 h-3 bg-[repeating-linear-gradient(90deg,var(--rule-soft)_0_1px,transparent_1px_4px)] border border-rule-soft" /> off shift</span>
      </p>
    </div>
  )
}
