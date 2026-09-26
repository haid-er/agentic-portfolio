'use client'
/**
 * BullMQ job queue: add jobs, delayed jobs, flows and job schedulers, then watch one worker
 * with configurable concurrency process them, retry with fixed or exponential backoff,
 * and recover stalled jobs after a crash. Deterministic, simulated time, fully in-browser.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, Button, DemoGrid, DemoPanel, DemoToolbar, EmptyState, ErrorState, Segmented } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useInView, useLocalStorage, usePageVisible, useReducedMotion } from '@/lib/hooks'
import { CountStrip, JobDetail, Lanes, Timeline, type Lane } from './board'
import { JobQueue, QUEUE_NAME, type Snapshot } from './engine'
import { AddJobPanel, CodePanel, LogPanel, WorkerPanel, type Draft } from './panels'

export { notes } from './notes'

type Speed = '0.5' | '1' | '2' | '4'
const SPEEDS = [{ value: '0.5', label: '½×' }, { value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '4', label: '4×' }] as const
const DEFAULT_DRAFT: Draft = { name: 'compute-totals', opts: { attempts: 4, backoff: { type: 'exponential', delay: 1000 }, delay: 0 } }

export default function Demo(_props: DemoProps) {
  const reduced = useReducedMotion()
  const visible = usePageVisible()
  const [viewRef, inView] = useInView<HTMLDivElement>({ rootMargin: '120px' })
  const queue = useRef<JobQueue | null>(null)
  if (!queue.current) queue.current = new JobQueue()
  const [snap, setSnap] = useState<Snapshot>(() => (queue.current as JobQueue).snapshot())
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useLocalStorage<Speed>('bullmq-jobs:speed', '1')
  const [draft, setDraft] = useLocalStorage<Draft>('bullmq-jobs:draft', DEFAULT_DRAFT)
  const [lane, setLane] = useState<Lane>('waiting')
  const [selected, setSelected] = useState<number | null>(null)
  const [announce, setAnnounce] = useState('')
  const [crash, setCrash] = useState<string | null>(null)

  const refresh = useCallback(() => setSnap((queue.current as JobQueue).snapshot()), [])
  const act = useCallback((fn: (q: JobQueue) => void, say?: string) => {
    try {
      fn(queue.current as JobQueue)
      refresh()
      if (say) setAnnounce(say)
    } catch (e) {
      setCrash(e instanceof Error ? e.message : 'The queue simulation stopped unexpectedly.')
    }
  }, [refresh])

  // Clock: 10 Hz (4 Hz under reduced motion). Stops when paused, hidden or scrolled away.
  useEffect(() => {
    if (!running || !visible || !inView || crash) return
    const period = reduced ? 250 : 100
    const factor = Number(speed) || 1
    const id = window.setInterval(() => {
      try {
        const q = queue.current as JobQueue
        q.step(period * factor)
        setSnap(q.snapshot())
      } catch (e) {
        setCrash(e instanceof Error ? e.message : 'The queue simulation stopped unexpectedly.')
      }
    }, period)
    return () => window.clearInterval(id)
  }, [running, visible, inView, speed, reduced, crash])

  const opts = safeDraft(draft).opts
  const name = safeDraft(draft).name

  const sample = () => act((q) => {
    q.concurrency = 3
    q.failPct = 20
    for (let i = 0; i < 5; i++) q.add(i % 2 ? 'extract-rows' : 'compute-totals', opts)
    q.add('send-email', { ...opts, delay: 4000 })
    q.addFlow(opts)
    q.upsertScheduler('ingest-upload', 5000, opts)
  }, 'Sample workload added: five jobs, a delayed job, a flow and a job scheduler.')

  const reset = () => {
    queue.current = new JobQueue()
    setSelected(null)
    setCrash(null)
    refresh()
    setAnnounce('Queue reset.')
  }

  if (crash) {
    return (
      <ErrorState title="The queue simulation stopped" action={<Button variant="secondary" icon="refresh" onClick={reset}>Reset queue</Button>}>
        <p className="m-0">{crash}</p>
        <p className="m-0">Nothing ran outside your browser.</p>
      </ErrorState>
    )
  }

  const empty = snap.counts.total === 0 && snap.schedulers.length === 0

  return (
    <div ref={viewRef} className="grid gap-4 min-w-0">
      <p className="sr-only" aria-live="polite">{announce}</p>
      <DemoToolbar>
        <Segmented label="Speed" options={SPEEDS} value={speed} onChange={setSpeed} />
        <div className="flex flex-wrap gap-2">
          <Button icon={running ? 'pause' : 'play'} onClick={() => { setRunning((r) => !r); setAnnounce(running ? 'Clock paused.' : 'Clock running.') }}>
            {running ? 'Pause' : 'Run'}
          </Button>
          <Button variant="secondary" icon="step" disabled={running} onClick={() => act((q) => q.step(500))} aria-label="Advance 500 milliseconds">Step</Button>
          <Button variant="ghost" icon="refresh" onClick={reset}>Reset</Button>
        </div>
        <span className="mono text-ink-3 nums self-center">t = {(snap.now / 1000).toFixed(1)}s</span>
        {!running ? <Badge tone="warn">paused</Badge> : null}
      </DemoToolbar>

      <DemoGrid
        aside={
          <>
            <AddJobPanel
              draft={{ name, opts }}
              onDraft={setDraft}
              snap={snap}
              onAdd={() => act((q) => { const j = q.add(name, opts); setSelected(j.id) }, `Job ${name} added.`)}
              onAddMany={(n) => act((q) => { for (let i = 0; i < n; i++) q.add(name, opts) }, `${n} ${name} jobs added.`)}
              onFlow={() => act((q) => { const p = q.addFlow(opts); setSelected(p.id) }, 'Flow added: a parent and three children.')}
              onScheduler={(every) => act((q) => q.upsertScheduler(name, every, opts), `Scheduler for ${name} every ${every / 1000} seconds.`)}
              onRemoveScheduler={(key) => act((q) => q.removeScheduler(key), 'Scheduler removed.')}
            />
            <WorkerPanel
              snap={snap}
              onConcurrency={(n) => act((q) => { q.concurrency = n })}
              onFailPct={(n) => act((q) => { q.failPct = n })}
              onPoison={(v) => act((q) => { q.poisonNext = v }, v ? 'The next job added will be poison.' : 'Poison cleared.')}
              onKill={() => act((q) => { const n = q.killWorker(); setAnnounce(`Worker crashed with ${n} active jobs.`) })}
              onStart={() => act((q) => q.startWorker(), 'Worker started.')}
              onRetryFailed={() => act((q) => { const n = q.retryFailed(); setAnnounce(`${n} failed jobs retried.`) })}
              onClean={() => act((q) => q.clean(), 'Finished jobs cleaned.')}
            />
          </>
        }
      >
        <DemoPanel title={`Queue · ${QUEUE_NAME}`} meta={`${snap.counts.total} jobs`}>
          {empty ? (
            <EmptyState title="The queue is empty" action={<Button icon="plus" onClick={sample}>Add sample workload</Button>}>
              Add jobs with the producer form, or load a sample workload: plain jobs, a delayed job, a flow and a repeating scheduler.
            </EmptyState>
          ) : (
            <div className="grid gap-4">
              <CountStrip snap={snap} lane={lane} onLane={setLane} />
              <Lanes snap={snap} lane={lane} selected={selected} onSelect={setSelected} />
            </div>
          )}
        </DemoPanel>
        <DemoPanel title="Worker slots · last 20 s" meta={`concurrency ${snap.concurrency}`}>
          <Timeline snap={snap} onSelect={setSelected} />
          <ul className="m-0 mt-3 p-0 list-none flex flex-wrap gap-x-4 gap-y-1 font-mono text-00 text-ink-2" aria-label="Timeline legend">
            <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block w-5 h-3 bg-accent border border-accent" />completed attempt</li>
            <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block w-5 h-3 border border-danger bg-[repeating-linear-gradient(135deg,var(--danger)_0_3px,var(--surface)_3px_7px)]" />failed attempt</li>
            <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block w-5 h-3 border border-dashed border-warn bg-surface" />stalled</li>
            <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block w-5 h-3 border border-accent bg-surface" />running</li>
          </ul>
        </DemoPanel>
        <DemoPanel title="Job inspector" meta={selected !== null ? `#${selected}` : undefined}>
          <JobDetail snap={snap} id={selected} onSelect={setSelected} />
        </DemoPanel>
      </DemoGrid>

      <div className="grid gap-4 lg:grid-cols-2 min-w-0">
        <CodePanel draft={{ name, opts }} snap={snap} />
        <LogPanel snap={snap} />
      </div>
    </div>
  )
}

/** Guards against a stale or hand-edited draft in localStorage. */
function safeDraft(d: Draft): Draft {
  const o = d?.opts
  if (!d || typeof d.name !== 'string' || !o || !o.backoff) return DEFAULT_DRAFT
  const clamp = (v: unknown, lo: number, hi: number, dflt: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt)
  return {
    name: d.name,
    opts: {
      attempts: clamp(o.attempts, 1, 6, 4),
      backoff: { type: o.backoff.type === 'fixed' ? 'fixed' : 'exponential', delay: clamp(o.backoff.delay, 0, 4000, 1000) },
      delay: clamp(o.delay, 0, 10000, 0),
    },
  }
}
