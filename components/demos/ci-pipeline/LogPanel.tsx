'use client'
/** Step list and streaming log for the selected job. Follows the tail unless you scroll up. */
import { useEffect, useRef } from 'react'
import { Badge, DemoPanel } from '@/components/ui'
import { cx } from '@/lib/utils'
import { type JobRun } from './engine'
import { StatusTag } from './Board'

export function LogPanel({ job, idle }: { job: JobRun | undefined; idle: boolean }) {
  const boxRef = useRef<HTMLPreElement | null>(null)
  const follow = useRef(true)
  const count = job?.logs.length ?? 0

  useEffect(() => {
    const el = boxRef.current
    if (el && follow.current) el.scrollTop = el.scrollHeight
  }, [count, job?.def.id])

  if (!job) return null
  return (
    <DemoPanel title={`Job · ${job.def.name}`} meta={<StatusTag status={job.status} idle={idle} />}>
      <div className="grid gap-3">
        {job.def.skipReason ? <p className="m-0 text-0 text-ink-2">{job.def.skipReason}</p> : null}
        {job.def.needs.length ? (
          <p className="m-0 mono text-ink-3">needs: {job.def.needs.join(', ')}{job.def.gate ? ` · environment: ${job.def.gate}` : ''}</p>
        ) : null}
        <ol className="m-0 p-0 list-none grid gap-1" aria-label="Steps">
          {job.steps.map((s, i) => (
            <li key={`${s.name}-${i}`} className="flex flex-wrap items-center gap-2 text-0">
              <span
                aria-hidden="true"
                className={cx(
                  'inline-block size-2 rounded-pill border',
                  s.status === 'ok' && 'bg-ok border-ok',
                  s.status === 'failed' && 'bg-danger border-danger',
                  s.status === 'running' && 'bg-accent border-accent',
                  s.status === 'pending' && 'border-rule',
                )}
              />
              <span className={cx(s.status === 'pending' && 'text-ink-3')}>{s.name}</span>
              <span className="sr-only">{s.status}</span>
              {s.status === 'ok' || s.status === 'failed' ? <span className="mono text-ink-3 nums">{s.dur}s</span> : null}
              {s.cache ? <Badge tone={s.cache === 'hit' ? 'ok' : 'neutral'}>cache {s.cache}</Badge> : null}
            </li>
          ))}
        </ol>
        <pre
          ref={boxRef}
          tabIndex={0}
          aria-label={`Log output for ${job.def.name}`}
          onScroll={(e) => {
            const el = e.currentTarget
            follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
          }}
          className="m-0 h-64 overflow-auto p-3 bg-bg border border-rule-soft rounded-1 font-mono text-00 leading-[1.6] text-ink-2 whitespace-pre-wrap [overflow-wrap:anywhere]"
        >
          {job.logs.length ? job.logs.map((l, i) => (
            <span key={i} className={cx('block', /Error:|failed/.test(l) && 'text-danger', /▸/.test(l) && 'text-ink')}>{l}</span>
          )) : <span className="text-ink-3">{idle ? 'Run the pipeline to stream logs here.' : 'Waiting for this job to start.'}</span>}
        </pre>
      </div>
    </DemoPanel>
  )
}
