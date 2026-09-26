'use client'
/** Stage columns with job cards. Colour is never the only signal: every status has an icon and a word. */
import { Icon, type IconName } from '@/components/ui'
import { cx } from '@/lib/utils'
import { STAGES, fmt, type JobRun, type JobStatus } from './engine'

export const STATUS_META: Record<JobStatus, { label: string; icon: IconName; cls: string }> = {
  waiting: { label: 'waiting', icon: 'flat', cls: 'text-ink-3 border-rule-soft' },
  queued: { label: 'queued', icon: 'pause', cls: 'text-ink-2 border-rule' },
  running: { label: 'running', icon: 'register', cls: 'text-accent-ink border-accent' },
  retrying: { label: 'backoff', icon: 'refresh', cls: 'text-warn border-warn' },
  approval: { label: 'needs approval', icon: 'lock', cls: 'text-warn border-warn' },
  success: { label: 'passed', icon: 'check', cls: 'text-ok border-ok' },
  failed: { label: 'failed', icon: 'alert', cls: 'text-danger border-danger' },
  skipped: { label: 'skipped', icon: 'minus', cls: 'text-ink-3 border-rule-soft' },
  cancelled: { label: 'cancelled', icon: 'close', cls: 'text-ink-3 border-rule' },
}

export function StatusTag({ status, idle }: { status: JobStatus; idle?: boolean }) {
  const m = idle && status === 'waiting' ? { ...STATUS_META.waiting, label: 'not started' } : STATUS_META[status]
  return (
    <span className={cx('mono inline-flex items-center gap-1 px-2 py-[2px] border rounded-pill bg-surface whitespace-nowrap', m.cls)}>
      <Icon
        name={m.icon}
        size={13}
        className={status === 'running' ? 'motion-safe:animate-[spin-reg_2.4s_linear_infinite]' : undefined}
      />
      {m.label}
    </span>
  )
}

function jobProgress(j: JobRun): number {
  if (j.status === 'success') return 1
  if (j.status !== 'running' && j.status !== 'failed') return 0
  const cur = j.steps[j.stepIndex]
  const frac = cur ? Math.min(1, j.stepElapsed / Math.max(cur.dur, 0.001)) : 0
  return Math.min(1, (j.stepIndex + frac) / j.steps.length)
}

function jobElapsed(j: JobRun): number {
  return j.spans.reduce((t, s) => t + (s.kind === 'run' && s.end !== null ? s.end - s.start : 0), 0)
}

export function Board({ jobs, now, idle, selected, onSelect }: {
  jobs: JobRun[]
  now: number
  idle: boolean
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <ol className="m-0 p-0 list-none grid gap-4 lg:grid-cols-5 lg:gap-3" aria-label="Pipeline stages">
      {STAGES.map((stage, si) => {
        const stageJobs = jobs.filter((j) => j.def.stage === stage.id)
        return (
          <li key={stage.id} className="relative min-w-0 grid content-start gap-2">
            <p className="m-0 flex items-baseline gap-2 border-b border-rule pb-1">
              <span className="display text-2 text-accent-ink nums">{String(si + 1).padStart(2, '0')}</span>
              <span className="mono text-ink-2">{stage.label}</span>
              {si < STAGES.length - 1 ? <span aria-hidden="true" className="ml-auto mono text-ink-3 hidden lg:inline">→</span> : null}
            </p>
            <ul className="m-0 p-0 list-none grid gap-2 xs:grid-cols-2 lg:grid-cols-1">
              {stageJobs.map((j) => (
                <li key={j.def.id} className="min-w-0">
                  <JobCard job={j} now={now} idle={idle} selected={selected === j.def.id} onSelect={() => onSelect(j.def.id)} />
                </li>
              ))}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}

function JobCard({ job: j, now, idle, selected, onSelect }: { job: JobRun; now: number; idle: boolean; selected: boolean; onSelect: () => void }) {
  const p = jobProgress(j)
  const running = j.status === 'running'
  const openSpan = j.spans[j.spans.length - 1]
  const elapsed = jobElapsed(j) + (running && openSpan && openSpan.end === null ? now - openSpan.start : 0)
  const cache = j.steps.find((s) => s.cache)?.cache
  const skippedByIf = Boolean(j.def.skipReason)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${j.def.name}: ${idle && j.status === 'waiting' ? 'not started' : STATUS_META[j.status].label}. Show logs.`}
      className={cx(
        'w-full min-h-tap text-left grid gap-2 p-3 border rounded-1 bg-bg transition-colors duration-[var(--dur-fast)]',
        selected ? 'border-ink ring-1 ring-ink' : 'border-rule-soft hover:border-rule',
        skippedByIf && 'border-dashed opacity-80',
      )}
    >
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-0 [overflow-wrap:anywhere]">{j.def.name}</span>
        <StatusTag status={j.status} idle={idle} />
      </span>
      {!skippedByIf ? (
        <span aria-hidden="true" className="block h-[4px] bg-bg-2 rounded-pill overflow-hidden">
          <span
            className={cx(
              'block h-full origin-left rounded-pill',
              j.status === 'failed' ? 'bg-danger' : j.status === 'success' ? 'bg-ok' : 'bg-accent',
            )}
            style={{ transform: `scaleX(${j.status === 'failed' ? Math.max(p, 0.08) : p})` }}
          />
        </span>
      ) : null}
      <span className="mono text-ink-3 flex flex-wrap gap-x-2">
        {skippedByIf ? <span>if: false</span> : null}
        {elapsed > 0 ? <span className="nums">{fmt(elapsed)}</span> : null}
        {j.attempt > 1 ? <span className="text-warn">try {j.attempt}</span> : null}
        {cache ? <span className={cache === 'hit' ? 'text-ok' : undefined}>cache {cache}</span> : null}
        {running ? <span className="truncate max-w-full">{j.steps[j.stepIndex]?.name}</span> : null}
      </span>
    </button>
  )
}
