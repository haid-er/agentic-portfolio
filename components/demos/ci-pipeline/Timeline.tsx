'use client'
/**
 * Wall-clock timeline: one row per job, bars for time on a runner, hatching for time queued
 * (no free runner), dashed boxes for retry backoff. Parallel jobs line up vertically.
 */
import { cx } from '@/lib/utils'
import { fmt, type JobRun } from './engine'

function ticks(total: number): number[] {
  const steps = [15, 30, 60, 120, 300, 600]
  const step = steps.find((s) => total / s <= 6) ?? 900
  const out: number[] = []
  for (let t = 0; t <= total; t += step) out.push(t)
  return out
}

export function Timeline({ jobs, now }: { jobs: JobRun[]; now: number }) {
  const rows = jobs.filter((j) => !j.def.skipReason)
  const total = Math.max(60, Math.ceil(now / 30) * 30)
  const pct = (t: number) => `${(Math.min(t, total) / total) * 100}%`
  return (
    <figure className="m-0 grid gap-2">
      <figcaption className="sr-only">
        Timeline of each job over the run. Bars show time on a runner; hatched segments show time queued; dashed segments show retry backoff.
      </figcaption>
      <div className="grid gap-1" role="list">
        {rows.map((j) => (
          <div key={j.def.id} role="listitem" className="grid grid-cols-[6.5rem_minmax(0,1fr)] xs:grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-2">
            <span className="mono text-ink-2 truncate" title={j.def.name}>{j.def.name}</span>
            <span role="img" className="relative block h-5 border-b border-rule-soft" aria-label={spanSummary(j, now)}>
              {j.spans.map((s, i) => {
                const end = s.end ?? now
                return (
                  <span
                    key={i}
                    className={cx(
                      'absolute top-[3px] bottom-[3px] rounded-0',
                      s.kind === 'run' && (s.failed ? 'bg-danger' : s.end === null ? 'bg-accent' : j.status === 'cancelled' && i === j.spans.length - 1 ? 'bg-ink-3' : 'bg-data-1'),
                      s.kind === 'queued' && 'border border-rule-soft [background-image:repeating-linear-gradient(135deg,var(--rule-soft)_0_2px,transparent_2px_6px)]',
                      s.kind === 'backoff' && 'border border-dashed border-warn',
                    )}
                    style={{ left: pct(s.start), width: `max(2px, calc(${pct(end)} - ${pct(s.start)}))` }}
                  />
                )
              })}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] xs:grid-cols-[8.5rem_minmax(0,1fr)] gap-2" aria-hidden="true">
        <span />
        <span className="relative block h-4">
          {ticks(total).map((t) => (
            <span key={t} className="absolute top-0 mono text-ink-3 -translate-x-1/2 first:translate-x-0 nums" style={{ left: pct(t) }}>
              {t === 0 ? '0' : fmt(t)}
            </span>
          ))}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mono text-ink-3" aria-hidden="true">
        <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-2 bg-data-1" /> on a runner</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-2 border border-rule-soft [background-image:repeating-linear-gradient(135deg,var(--rule-soft)_0_2px,transparent_2px_6px)]" /> queued</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-2 border border-dashed border-warn" /> backoff</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block w-4 h-2 bg-danger" /> failed attempt</span>
      </div>
    </figure>
  )
}

function spanSummary(j: JobRun, now: number): string {
  const parts = j.spans.map((s) => {
    const d = fmt((s.end ?? now) - s.start)
    return s.kind === 'run' ? `${s.failed ? 'failed run' : 'run'} ${d}` : s.kind === 'queued' ? `queued ${d}` : `backoff ${d}`
  })
  return `${j.def.name}: ${parts.length ? parts.join(', ') : 'not started'}`
}
