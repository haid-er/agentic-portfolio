'use client'
/** State lanes, worker-slot timeline and the job inspector for the BullMQ demo. */
import { Badge, Button, EmptyState, Table, TableWrap, Td, Th, Tr, type Tone } from '@/components/ui'
import { cx } from '@/lib/utils'
import { fmtMs, type Job, type JobState, type Snapshot } from './engine'

export type Lane = 'delayed' | 'waiting' | 'active' | 'completed' | 'failed'
export const LANES: Array<{ id: Lane; label: string }> = [
  { id: 'delayed', label: 'Delayed' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
]
const LANE_CAP = 6

export const STATE_TONE: Record<JobState, Tone> = {
  delayed: 'warn', waiting: 'neutral', 'waiting-children': 'neutral', active: 'accent', completed: 'ok', failed: 'danger',
}

const laneOf = (s: JobState): Lane => (s === 'waiting-children' ? 'waiting' : s)

function laneJobs(snap: Snapshot, lane: Lane): Job[] {
  const jobs = snap.jobs.filter((j) => laneOf(j.state) === lane)
  if (lane === 'delayed') return jobs.sort((a, b) => (a.delayUntil ?? 0) - (b.delayUntil ?? 0))
  if (lane === 'active') return jobs.sort((a, b) => (a.work?.slot ?? 0) - (b.work?.slot ?? 0))
  if (lane === 'waiting') return jobs.sort((a, b) => Number(a.state === 'waiting-children') - Number(b.state === 'waiting-children') || a.id - b.id)
  return jobs.sort((a, b) => (b.finishedOn ?? 0) - (a.finishedOn ?? 0))
}

export function CountStrip({ snap, lane, onLane }: { snap: Snapshot; lane: Lane; onLane: (l: Lane) => void }) {
  return (
    <div className="grid grid-cols-5 gap-px bg-rule-soft border border-rule rounded-2 overflow-hidden strata:border-rule-soft" role="group" aria-label="Job counts by state">
      {LANES.map((l) => {
        const n = l.id === 'waiting' ? snap.counts.waiting + snap.counts['waiting-children'] : snap.counts[l.id]
        const on = l.id === lane
        return (
          <button
            key={l.id}
            type="button"
            aria-pressed={on}
            onClick={() => onLane(l.id)}
            className={cx('min-h-tap px-1 py-2 flex flex-col items-center gap-0 bg-surface', on && 'bg-bg-2 md:bg-surface')}
          >
            <span className={cx('display text-3 nums leading-none', l.id === 'failed' && n > 0 && 'text-danger', l.id === 'active' && n > 0 && 'text-accent')}>{n}</span>
            <span className={cx('font-mono text-[.625rem] xs:text-00 uppercase tracking-[.06em] text-ink-3', on && 'underline decoration-2 underline-offset-4 decoration-accent md:no-underline')}>{l.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Lanes({ snap, lane, selected, onSelect }: { snap: Snapshot; lane: Lane; selected: number | null; onSelect: (id: number) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-5 min-w-0">
      {LANES.map((l) => {
        const jobs = laneJobs(snap, l.id)
        return (
          <section key={l.id} aria-label={`${l.label} jobs`} className={cx('min-w-0', l.id === lane ? 'block' : 'hidden', 'md:block')}>
            <h4 className="mono !font-mono !normal-case !tracking-[.1em] text-ink-2 mb-2 flex justify-between">
              <span>{l.label}</span><span className="nums text-ink-3">{jobs.length}</span>
            </h4>
            {jobs.length ? (
              <ul className="m-0 p-0 list-none grid gap-2">
                {jobs.slice(0, LANE_CAP).map((j) => <JobCard key={j.id} job={j} now={snap.now} selected={selected === j.id} onSelect={onSelect} />)}
                {jobs.length > LANE_CAP ? <li className="mono text-ink-3 px-1">+{jobs.length - LANE_CAP} more</li> : null}
              </ul>
            ) : (
              <p className="m-0 p-2 border border-dashed border-rule-soft rounded-1 font-mono text-00 text-ink-3">empty</p>
            )}
          </section>
        )
      })}
    </div>
  )
}

function JobCard({ job: j, now, selected, onSelect }: { job: Job; now: number; selected: boolean; onSelect: (id: number) => void }) {
  const progress = j.work && !j.work.orphan ? 1 - j.work.left / j.work.total : 0
  let detail = ''
  if (j.state === 'delayed') detail = `${j.attemptsMade ? 'retry' : 'starts'} in ${fmtMs(Math.max(0, (j.delayUntil ?? now) - now))}`
  else if (j.state === 'waiting-children') detail = `waiting for children`
  else if (j.state === 'active') detail = j.work?.orphan ? 'orphaned: lock expiring' : `slot ${(j.work?.slot ?? 0) + 1}`
  else if (j.state === 'failed') detail = j.failedReason ?? 'failed'
  else if (j.state === 'completed') detail = j.attemptsMade > 1 ? `on attempt ${j.attemptsMade}` : 'first try'
  else if (j.attemptsMade) detail = `retry queued`
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(j.id)}
        aria-pressed={selected}
        className={cx(
          'w-full min-h-tap text-left px-2 py-1.5 border rounded-1 bg-surface grid gap-0.5',
          selected ? 'border-accent outline outline-1 outline-accent' : 'border-rule strata:border-rule-soft',
          j.state === 'failed' && 'border-l-4 border-l-danger',
          j.poison && 'border-dashed',
        )}
      >
        <span className="flex items-baseline gap-1 font-mono text-00 min-w-0">
          <span className="text-ink nums">#{j.id}</span>
          <span className="text-ink-2 truncate">{j.name}</span>
          <span className="ml-auto text-ink-3 nums whitespace-nowrap">{Math.min(j.attemptsMade + (j.state === 'active' ? 1 : 0), j.opts.attempts)}/{j.opts.attempts}</span>
        </span>
        <span className={cx('font-mono text-[.6875rem] leading-snug [overflow-wrap:anywhere]', j.state === 'failed' ? 'text-danger' : 'text-ink-3')}>
          {j.schedulerKey ? '↻ ' : ''}{j.parentId !== undefined ? `child of #${j.parentId} · ` : ''}{detail}{j.poison ? ' · poison' : ''}
        </span>
        {j.state === 'active' ? (
          <span className="block h-1 bg-bg-2 overflow-hidden" aria-hidden="true">
            <span className="block h-full bg-accent origin-left" style={{ transform: `scaleX(${progress})` }} />
          </span>
        ) : null}
      </button>
    </li>
  )
}

const WINDOW = 20000

/** Worker slots over the last 20 s: one row per concurrency slot, one bar per attempt. */
export function Timeline({ snap, onSelect }: { snap: Snapshot; onSelect: (id: number) => void }) {
  const from = snap.now - WINDOW
  const bars = snap.jobs.flatMap((j) => j.history.filter((a) => (a.end ?? snap.now) > from).map((a) => ({ job: j, a })))
  const rows = Math.max(snap.concurrency, ...bars.map((b) => b.a.slot + 1), 1)
  if (!bars.length) {
    return <EmptyState title="No work in the last 20 seconds">Each attempt a worker slot runs will draw a bar here: solid for success, hatched for a failure, dashed for a stall.</EmptyState>
  }
  return (
    <div className="grid gap-1 min-w-0">
      {Array.from({ length: rows }, (_, slot) => (
        <div key={slot} className="grid grid-cols-[3.5rem_1fr] items-center gap-2">
          <span className={cx('mono nums', slot >= snap.concurrency ? 'text-ink-3 line-through' : 'text-ink-3')}>slot {slot + 1}</span>
          <div className="relative h-8 bg-bg-2 border border-rule-soft rounded-0 overflow-hidden">
            {bars.filter((b) => b.a.slot === slot).map(({ job, a }) => {
              const start = Math.max(a.start, from)
              const end = a.end ?? snap.now
              const left = ((start - from) / WINDOW) * 100
              const width = Math.max(0.6, ((end - start) / WINDOW) * 100)
              const label = `#${job.id} ${job.name}, attempt ${a.n}: ${a.outcome}${a.error ? ` (${a.error})` : ''}`
              return (
                <button
                  key={`${job.id}-${a.n}-${a.start}`}
                  type="button"
                  tabIndex={-1}
                  title={label}
                  aria-label={label}
                  onClick={() => onSelect(job.id)}
                  className={cx(
                    'absolute top-1 bottom-1 min-w-[4px] overflow-hidden px-1 text-left font-mono text-[.625rem] leading-6 whitespace-nowrap rounded-0 border',
                    a.outcome === 'ok' && 'bg-accent text-on-accent border-accent',
                    a.outcome === 'running' && 'bg-surface text-ink border-accent',
                    a.outcome === 'fail' && 'text-ink border-danger bg-[repeating-linear-gradient(135deg,var(--danger)_0_3px,var(--surface)_3px_7px)]',
                    a.outcome === 'stalled' && 'bg-surface text-ink-2 border-dashed border-warn',
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  {width > 7 ? `#${job.id}` : ''}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[3.5rem_1fr] gap-2" aria-hidden="true">
        <span />
        <div className="flex justify-between font-mono text-[.625rem] text-ink-3 nums"><span>-20s</span><span>-15s</span><span>-10s</span><span>-5s</span><span>now</span></div>
      </div>
    </div>
  )
}

export function JobDetail({ snap, id, onSelect }: { snap: Snapshot; id: number | null; onSelect: (id: number) => void }) {
  const j = id === null ? undefined : snap.jobs.find((x) => x.id === id)
  if (!j) {
    return <EmptyState title="No job selected">Pick a job card or a timeline bar to see its attempts, backoff waits and flow links.</EmptyState>
  }
  const kids = snap.jobs.filter((k) => k.parentId === j.id)
  return (
    <div className="grid gap-3 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-0 text-ink">#{j.id} {j.name}</span>
        <Badge tone={STATE_TONE[j.state]}>{j.state}</Badge>
        {j.poison ? <Badge tone="danger">poison</Badge> : null}
        {j.schedulerKey ? <Badge tone="accent">↻ {j.schedulerKey}</Badge> : null}
      </div>
      <p className="m-0 font-mono text-00 text-ink-2">
        attempts {j.opts.attempts} · backoff {j.opts.backoff.type} {fmtMs(j.opts.backoff.delay)} · made {j.attemptsMade} · stalled {j.stalledCount}×
      </p>
      {j.failedReason ? <p className="m-0 text-0 text-danger [overflow-wrap:anywhere]">{j.state === 'failed' ? 'failedReason' : 'last error'}: {j.failedReason}</p> : null}
      {j.parentId !== undefined ? (
        <div><Button size="sm" variant="ghost" icon="arrow-up-right" onClick={() => onSelect(j.parentId as number)}>Parent #{j.parentId}</Button></div>
      ) : null}
      {kids.length ? (
        <div className="flex flex-wrap gap-2">
          {kids.map((k) => (
            <Button key={k.id} size="sm" variant="secondary" onClick={() => onSelect(k.id)}>#{k.id} {k.state}</Button>
          ))}
        </div>
      ) : null}
      {j.history.length ? (
        <TableWrap label={`Attempts of job ${j.id}`}>
          <Table>
            <thead><Tr><Th>#</Th><Th>Slot</Th><Th>Start</Th><Th>Ran</Th><Th>Outcome</Th><Th>Next wait</Th></Tr></thead>
            <tbody>
              {j.history.map((a) => (
                <Tr key={`${a.n}-${a.start}`}>
                  <Td>{a.n}</Td>
                  <Td>{a.slot + 1}</Td>
                  <Td>{(a.start / 1000).toFixed(1)}s</Td>
                  <Td>{fmtMs((a.end ?? snap.now) - a.start)}</Td>
                  <Td className={cx('font-mono text-00', a.outcome === 'fail' && 'text-danger', a.outcome === 'stalled' && 'text-warn', a.outcome === 'ok' && 'text-accent-ink')}>{a.outcome}</Td>
                  <Td className="font-mono text-00">{a.nextDelay !== undefined ? `+${fmtMs(a.nextDelay)}` : '—'}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      ) : (
        <p className="m-0 text-0 text-ink-3">Not started yet.</p>
      )}
    </div>
  )
}
