'use client'
/** Producer form, worker controls, the equivalent BullMQ code and the queue-events log. */
import { useState } from 'react'
import { Badge, Button, DemoPanel, EmptyState, Segmented, Select, Toggle, useToast } from '@/components/ui'
import { cx } from '@/lib/utils'
import { Range } from './Range'
import { fmtMs, JOB_TYPES, MAX_STALLED, QUEUE_NAME, retrySchedule, STALL_MS, type BackoffType, type JobOpts, type LogTone, type Snapshot } from './engine'

export interface Draft { name: string; opts: JobOpts }
type Every = '2000' | '5000' | '10000'

export function AddJobPanel({ draft, onDraft, snap, onAdd, onAddMany, onFlow, onScheduler, onRemoveScheduler }: {
  draft: Draft
  onDraft: (d: Draft) => void
  snap: Snapshot
  onAdd: () => void
  onAddMany: (n: number) => void
  onFlow: () => void
  onScheduler: (every: number) => void
  onRemoveScheduler: (key: string) => void
}) {
  const [every, setEvery] = useState<Every>('5000')
  const set = (patch: Partial<JobOpts>) => onDraft({ ...draft, opts: { ...draft.opts, ...patch } })
  const schedule = retrySchedule(draft.opts)
  const worst = schedule.reduce((a, b) => a + b, 0)
  const peak = Math.max(1, ...schedule)
  return (
    <DemoPanel title="Producer · queue.add()" meta={QUEUE_NAME}>
      <div className="grid gap-4">
        <Select label="Job name" value={draft.name} onChange={(e) => onDraft({ ...draft, name: e.target.value })}>
          {JOB_TYPES.map((t) => <option key={t.name} value={t.name}>{t.name} (~{fmtMs(t.ms)})</option>)}
        </Select>
        <Range label="attempts" value={draft.opts.attempts} min={1} max={6} onChange={(v) => set({ attempts: v })} />
        <Segmented
          label="backoff.type"
          options={[{ value: 'exponential', label: 'Exponential' }, { value: 'fixed', label: 'Fixed' }] as const}
          value={draft.opts.backoff.type}
          onChange={(v: BackoffType) => set({ backoff: { ...draft.opts.backoff, type: v } })}
        />
        <Range label="backoff.delay" value={draft.opts.backoff.delay} min={0} max={4000} step={100} format={fmtMs} onChange={(v) => set({ backoff: { ...draft.opts.backoff, delay: v } })} />
        <Range label="delay (start later)" value={draft.opts.delay} min={0} max={10000} step={500} format={(v) => (v ? fmtMs(v) : 'none')} onChange={(v) => set({ delay: v })} />

        <div className="grid gap-2">
          <p className="m-0 mono text-ink-2">Retry schedule if every attempt fails</p>
          {schedule.length ? (
            <>
              <ol className="m-0 p-0 list-none grid gap-1" aria-label="Wait before each retry">
                {schedule.map((ms, i) => (
                  <li key={i} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2 font-mono text-00">
                    <span className="text-ink-3">retry {i + 1}</span>
                    <span className="h-2 bg-bg-2 border border-rule-soft overflow-hidden" aria-hidden="true">
                      <span className="block h-full bg-data-3 origin-left" style={{ transform: `scaleX(${ms / peak})` }} />
                    </span>
                    <span className="text-ink nums text-right">+{fmtMs(ms)}</span>
                  </li>
                ))}
              </ol>
              <p className="m-0 text-00 text-ink-3">
                {draft.opts.backoff.type === 'exponential' ? 'wait = delay × 2^(attemptsMade − 1)' : 'wait = delay'} · worst case {fmtMs(worst)} of waiting
              </p>
            </>
          ) : (
            <p className="m-0 text-00 text-ink-3">attempts = 1: a failure is final.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button icon="plus" onClick={onAdd}>Add job</Button>
          <Button variant="secondary" onClick={() => onAddMany(10)}>Add ×10</Button>
          <Button variant="secondary" icon="nodes" onClick={onFlow}>Add flow</Button>
        </div>
        <p className="m-0 text-00 text-ink-3">A flow adds render-report as a parent that waits for three extract-rows children.</p>

        <div className="grid gap-2 pt-3 border-t border-rule-soft">
          <Segmented
            label="Job scheduler · repeat every"
            options={[{ value: '2000', label: '2s' }, { value: '5000', label: '5s' }, { value: '10000', label: '10s' }] as const}
            value={every}
            onChange={setEvery}
          />
          <div><Button variant="secondary" icon="refresh" onClick={() => onScheduler(Number(every))}>Upsert scheduler</Button></div>
          {snap.schedulers.length ? (
            <ul className="m-0 p-0 list-none grid gap-1">
              {snap.schedulers.map((s) => (
                <li key={s.key} className="flex flex-wrap items-center gap-2 font-mono text-00">
                  <span className="text-ink [overflow-wrap:anywhere]">↻ {s.key}</span>
                  <span className="text-ink-3">{s.runs} run(s)</span>
                  <Button size="sm" variant="ghost" icon="close" className="ml-auto" onClick={() => onRemoveScheduler(s.key)} aria-label={`Remove scheduler ${s.key}`}>Remove</Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </DemoPanel>
  )
}

export function WorkerPanel({ snap, onConcurrency, onFailPct, onPoison, onKill, onStart, onRetryFailed, onClean }: {
  snap: Snapshot
  onConcurrency: (n: number) => void
  onFailPct: (n: number) => void
  onPoison: (v: boolean) => void
  onKill: () => void
  onStart: () => void
  onRetryFailed: () => void
  onClean: () => void
}) {
  return (
    <DemoPanel title="Worker" meta={snap.workerAlive ? 'running' : 'crashed'}>
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone={snap.workerAlive ? 'ok' : 'danger'}>{snap.workerAlive ? 'process up' : 'process down'}</Badge>
          <Badge>{snap.throughput.toFixed(2)} done/s</Badge>
          <Badge tone="ok">{snap.completedTotal} completed</Badge>
          {snap.retriesTotal ? <Badge tone="warn">{snap.retriesTotal} retries</Badge> : null}
          {snap.failedTotal ? <Badge tone="danger">{snap.failedTotal} failed</Badge> : null}
        </div>
        <Range label="concurrency" value={snap.concurrency} min={1} max={8} onChange={onConcurrency} hint="How many jobs this one worker runs at the same time." />
        <Range label="Injected failure rate" value={snap.failPct} min={0} max={80} step={5} format={(v) => `${v}%`} onChange={onFailPct} />
        <Toggle label="Poison the next job added" checked={snap.poisonNext} onChange={onPoison} />
        <div className="flex flex-wrap gap-2">
          {snap.workerAlive
            ? <Button variant="danger" icon="close" onClick={onKill}>Crash worker</Button>
            : <Button icon="play" onClick={onStart}>Start worker</Button>}
          <Button variant="secondary" icon="refresh" onClick={onRetryFailed} disabled={!snap.counts.failed}>Retry failed</Button>
          <Button variant="ghost" onClick={onClean} disabled={!snap.counts.completed && !snap.counts.failed}>Clean finished</Button>
        </div>
        <p className="m-0 text-00 text-ink-3">
          A crash leaves active jobs locked. When a worker runs again, its stalled-job checker moves them back to waiting once the lock
          ({fmtMs(STALL_MS)} here) has expired; a job that stalls more than {MAX_STALLED}× fails.
        </p>
      </div>
    </DemoPanel>
  )
}

export function CodePanel({ draft, snap }: { draft: Draft; snap: Snapshot }) {
  const toast = useToast()
  const sched = snap.schedulers[snap.schedulers.length - 1]
  const every = sched?.every ?? 5000
  const schedName = sched?.name ?? 'ingest-upload'
  const o = draft.opts
  const addOpts = [
    `  attempts: ${o.attempts},`,
    `  backoff: { type: '${o.backoff.type}', delay: ${o.backoff.delay} },`,
    ...(o.delay ? [`  delay: ${o.delay},`] : []),
    '  removeOnComplete: 60,',
    '  removeOnFail: 60,',
  ]
  const code = [
    "import { Queue, Worker, FlowProducer } from 'bullmq'",
    '',
    `const queue = new Queue('${QUEUE_NAME}', { connection })`,
    `await queue.add('${draft.name}', payload, {`,
    ...addOpts,
    '})',
    '',
    `await queue.upsertJobScheduler('${schedName}-every-${every / 1000}s',`,
    `  { every: ${every} },`,
    `  { name: '${schedName}', data: {} })`,
    '',
    'await new FlowProducer({ connection }).add({',
    `  name: 'render-report', queueName: '${QUEUE_NAME}',`,
    `  children: [1, 2, 3].map((part) => ({`,
    `    name: 'extract-rows', queueName: '${QUEUE_NAME}', data: { part },`,
    '    opts: { failParentOnFailure: true },',
    '  })),',
    '})',
    '',
    `new Worker('${QUEUE_NAME}', async (job) => {`,
    '  await job.updateProgress(50)',
    '  return handlers[job.name](job.data) // throw = failed attempt',
    `}, { connection, concurrency: ${snap.concurrency}, maxStalledCount: ${MAX_STALLED} })`,
  ].join('\n')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast('BullMQ snippet copied')
    } catch {
      toast('Copy failed: select the code and copy it by hand', { tone: 'warn' })
    }
  }
  return (
    <DemoPanel title="Equivalent BullMQ code" meta="TypeScript" actions={<Button size="sm" variant="ghost" icon="copy" onClick={copy}>Copy</Button>}>
      <pre className="m-0 p-3 bg-bg-2 border border-rule-soft rounded-1 text-00 leading-[1.6] overflow-x-auto max-w-full" tabIndex={0} aria-label="BullMQ code">
        <code>{code}</code>
      </pre>
    </DemoPanel>
  )
}

const TONE_CLASS: Record<LogTone, string> = { info: 'text-ink-2', ok: 'text-accent-ink', warn: 'text-warn', danger: 'text-danger' }
const TONE_MARK: Record<LogTone, string> = { info: '·', ok: '+', warn: '!', danger: '×' }

export function LogPanel({ snap }: { snap: Snapshot }) {
  const [problems, setProblems] = useState(false)
  const lines = snap.log.filter((l) => !problems || l.tone === 'warn' || l.tone === 'danger').slice(-50).reverse()
  return (
    <DemoPanel title="Queue events" meta="newest first">
      <Toggle label="Problems only" checked={problems} onChange={setProblems} />
      {lines.length ? (
        <ol className="m-0 mt-2 p-0 list-none max-h-80 overflow-y-auto grid gap-1 font-mono text-00" tabIndex={0} aria-label="Queue event lines">
          {lines.map((l) => (
            <li key={l.id} className="grid grid-cols-[4.5ch_1.5ch_1fr] gap-2">
              <span className="text-ink-3 nums">{(l.t / 1000).toFixed(1)}</span>
              <span aria-hidden="true" className={TONE_CLASS[l.tone]}>{TONE_MARK[l.tone]}</span>
              <span className={cx('[overflow-wrap:anywhere]', TONE_CLASS[l.tone])}>{l.text}</span>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="No events yet" className="mt-2">Add a job and the queue events (added, active, completed, failed, stalled) appear here.</EmptyState>
      )}
    </DemoPanel>
  )
}
