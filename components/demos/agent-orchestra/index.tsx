'use client'
/**
 * Agent orchestra: planner -> parallel workers -> reviewer on your goal, run on a small
 * Temporal-style runtime (retries, backoff, start-to-close timeouts, event history) and traced
 * like Langfuse (span tree + waterfall). Live mode calls the lib/ai gateway; simulated mode
 * runs scripted agents offline. Finished runs can be replayed from their recorded log.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from 'react'
import {
  Badge, Button, DemoGrid, DemoPanel, EmptyState, ErrorState, Segmented, Table, TableWrap, Td, Textarea, Th, Toggle, Tr,
} from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { aiErrorMessage, isQuotaError } from '@/lib/ai'
import type { DemoProps } from '@/lib/demos/types'
import { usePageVisible, useReducedMotion } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { liveAgents, simulatedAgents } from './agents'
import { ActivityFailure, initialRun, Recorder, reducer, type Action, type LoggedAction, type RetryPolicy, type RunState } from './engine'
import { fmtMs, SpanDetail, SpanTree } from './SpanTree'
import { orchestrate, type WorkflowResult } from './workflow'

export { notes } from './notes'

type Mode = 'live' | 'simulated'
type Attempts = '1' | '3' | '5'
type Timeout = '5' | '15' | '30'

const MAX_GOAL = 300
const PRESETS = [
  'Plan a zero-cost launch checklist for a personal portfolio site',
  'Draft a migration plan from REST polling to WebSockets for a chat feature',
  'Outline a data-collection survey for a small company’s Scope 2 electricity emissions',
  'Compare three ways to cut the p95 latency of a slow API endpoint',
]

type Run = RunState<WorkflowResult>

export default function Demo({ slug }: DemoProps) {
  const reduced = useReducedMotion()
  const visible = usePageVisible()
  const [state, dispatch] = useReducer(reducer<WorkflowResult>, initialRun as Run)
  const [goal, setGoal] = useState(PRESETS[0] ?? '')
  const [mode, setMode] = useState<Mode>('live')
  const [attempts, setAttempts] = useState<Attempts>('3')
  const [timeout, setTimeoutSec] = useState<Timeout>('15')
  const [crashWorker, setCrashWorker] = useState(true)
  const [hangReviewer, setHangReviewer] = useState(false)
  const [allowRevision, setAllowRevision] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [now, setNow] = useState(0)
  const [replaying, setReplaying] = useState(false)
  const [offerSim, setOfferSim] = useState<string | null>(null)
  const [ranMode, setRanMode] = useState<Mode>('live')

  const ctrl = useRef<AbortController | null>(null)
  const clock = useRef<{ start: number; speed: number } | null>(null)
  const lastLog = useRef<LoggedAction<WorkflowResult>[] | null>(null)
  const timers = useRef<number[]>([])

  const running = state.status === 'running'
  const ticking = running || replaying

  // Live clock for running bars (slower under reduced motion; paused when the tab is hidden).
  useEffect(() => {
    if (!ticking || !visible) return
    const id = window.setInterval(() => {
      const c = clock.current
      if (c) setNow(Math.round((performance.now() - c.start) * c.speed))
    }, reduced ? 500 : 100)
    return () => window.clearInterval(id)
  }, [ticking, visible, reduced])

  const stopReplay = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    setReplaying(false)
  }, [])

  useEffect(() => () => { ctrl.current?.abort(); stopReplay() }, [stopReplay])

  // Stopping mid-replay jumps to the recorded end state, so status never sticks at 'running'.
  const finishReplay = () => {
    const log = lastLog.current
    stopReplay()
    if (!log?.length) return
    dispatch({ type: 'reset' })
    log.forEach((l) => dispatch(l.action))
    clock.current = null
    setNow(log[log.length - 1]?.t ?? 0)
  }

  const policy: RetryPolicy = useMemo(() => ({
    maximumAttempts: Number(attempts), initialIntervalMs: 600, backoffCoefficient: 2, maximumIntervalMs: 5000,
    startToCloseTimeoutMs: Number(timeout) * 1000,
  }), [attempts, timeout])

  const start = async (runMode: Mode, e?: FormEvent) => {
    e?.preventDefault()
    const g = goal.trim().slice(0, MAX_GOAL)
    if (!g || running) return
    stopReplay()
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setOfferSim(null)
    setSelected(null)
    setRanMode(runMode)
    dispatch({ type: 'reset' })
    const rec = new Recorder<WorkflowResult>(dispatch)
    clock.current = { start: performance.now(), speed: 1 }
    setNow(0)
    try {
      await orchestrate(rec, {
        goal: g,
        agents: runMode === 'live' ? liveAgents(slug, 3) : simulatedAgents(4),
        policy, chaos: { crashWorker, hangReviewer }, allowRevision,
        simulated: runMode === 'simulated', signal: c.signal,
      })
    } catch (err) {
      const cause = err instanceof ActivityFailure ? err.cause : err
      if (runMode === 'live' && isQuotaError(cause)) setOfferSim(aiErrorMessage(cause))
    } finally {
      lastLog.current = [...rec.log]
      setNow(rec.now())
      clock.current = null
      if (ctrl.current === c) ctrl.current = null
    }
  }

  const replay = () => {
    const log = lastLog.current
    if (!log?.length || running) return
    stopReplay()
    setSelected(null)
    const speed = 2
    const apply = (a: Action<WorkflowResult>) => dispatch(a)
    dispatch({ type: 'reset' })
    if (reduced) {
      log.forEach((l) => apply(l.action))
      setNow(log[log.length - 1]?.t ?? 0)
      return
    }
    setReplaying(true)
    clock.current = { start: performance.now(), speed }
    setNow(0)
    const lastT = log[log.length - 1]?.t ?? 0
    timers.current = log.map((l) => window.setTimeout(() => apply(l.action), l.t / speed))
    timers.current.push(window.setTimeout(() => { setReplaying(false); clock.current = null; setNow(lastT) }, lastT / speed + 30))
  }

  const sel = state.spans.find((s) => s.id === selected) ?? null
  const counts = useMemo(() => {
    const gens = state.spans.filter((s) => s.kind === 'generation')
    const tokens = gens.reduce((n, s) => n + (Number(s.attrs.inputTokens) || 0) + (Number(s.attrs.outputTokens) || 0), 0)
    return {
      attempts: gens.length,
      retries: state.spans.filter((s) => s.kind === 'backoff').length,
      timeouts: gens.filter((s) => s.status === 'timeout').length,
      failures: gens.filter((s) => s.status === 'error').length,
      tokens,
    }
  }, [state.spans])
  const wall = state.spans.find((s) => s.kind === 'workflow')
  const wallMs = wall ? (wall.end ?? now) - wall.start : 0

  return (
    <DemoGrid
      aside={
        <DemoPanel title="Event history" meta={`${state.events.length} events`}>
          {state.events.length === 0 ? (
            <EmptyState title="No history yet">Each workflow and activity step is appended here, like a Temporal event history.</EmptyState>
          ) : (
            <TableWrap label="Workflow event history" className="max-h-[36rem] overflow-y-auto">
              <Table>
                <thead><Tr><Th>#</Th><Th>t</Th><Th>Event</Th></Tr></thead>
                <tbody>
                  {state.events.map((e) => (
                    <Tr key={e.id}>
                      <Td className="font-mono text-00 text-ink-3">{e.id}</Td>
                      <Td className="font-mono text-00 text-ink-3 whitespace-nowrap">+{fmtMs(e.t)}</Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() => e.spanId && setSelected(e.spanId)}
                          className={cx('grid gap-[2px] text-left min-h-tap w-full', e.spanId && 'hover:text-accent-ink')}
                        >
                          <span className={cx('font-mono text-00 tracking-[.02em]', /Failed|TimedOut/.test(e.type) ? 'text-danger' : /Retry/.test(e.type) ? 'text-warn' : /Completed/.test(e.type) ? 'text-ok' : 'text-ink')}>{e.type}</span>
                          <span className="text-00 text-ink-2 [overflow-wrap:anywhere]">{e.detail}</span>
                        </button>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </DemoPanel>
      }
    >
      <DemoPanel title="Goal" meta={mode === 'live' ? 'Live agents via AI gateway' : 'Simulated agents, offline'}>
        <form onSubmit={(e) => void start(mode, e)} className="grid gap-4">
          <Textarea label="What should the agents work on?" rows={2} value={goal} maxLength={MAX_GOAL} onChange={(e) => setGoal(e.target.value)} hint={`${goal.length}/${MAX_GOAL}`} />
          <div className="flex flex-wrap gap-2" aria-label="Example goals">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => setGoal(p)} className={cx('min-h-tap px-3 py-2 text-left text-00 border rounded-pill bg-bg-2 hover:border-accent', goal === p ? 'border-accent text-accent-ink' : 'border-rule-soft text-ink-2')}>
                {p}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Segmented<Mode> label="Agents" value={mode} onChange={setMode} options={[{ value: 'live', label: 'Live (AI)' }, { value: 'simulated', label: 'Simulated' }]} />
            <Segmented<Attempts> label="Retry policy · max attempts" value={attempts} onChange={setAttempts} options={[{ value: '1', label: '1' }, { value: '3', label: '3' }, { value: '5', label: '5' }]} />
            <Segmented<Timeout> label="Start-to-close timeout" value={timeout} onChange={setTimeoutSec} options={[{ value: '5', label: '5 s' }, { value: '15', label: '15 s' }, { value: '30', label: '30 s' }]} />
            <fieldset className="m-0 p-0 border-0 grid gap-0">
              <legend className="mono text-ink-2 mb-1">Chaos</legend>
              <Toggle label="Crash worker 2 on attempt 1" checked={crashWorker} onChange={setCrashWorker} />
              <Toggle label="Hang the reviewer on attempt 1" checked={hangReviewer} onChange={setHangReviewer} />
              <Toggle label="Reviewer may ask for one revision" checked={allowRevision} onChange={setAllowRevision} />
            </fieldset>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {running && !replaying ? (
              <Button variant="danger" icon="close" onClick={() => ctrl.current?.abort()}>Cancel workflow</Button>
            ) : (
              <Button type="submit" arrow disabled={!goal.trim() || replaying}>Start workflow</Button>
            )}
            {replaying || (lastLog.current && !running) ? (
              <Button variant="secondary" icon={replaying ? 'pause' : 'refresh'} onClick={replaying ? finishReplay : replay}>
                {replaying ? 'Stop replay' : 'Replay from history'}
              </Button>
            ) : null}
            <span className="text-00 text-ink-3">
              {mode === 'live' ? 'About 5 to 7 model calls per run on free, rate-limited providers.' : 'Scripted agents with seeded latency. No model is called.'}
            </span>
          </div>
        </form>
      </DemoPanel>

      <DemoPanel
        title="Trace"
        meta={state.status === 'idle' ? undefined : `${fmtMs(wallMs)} · ${counts.attempts} attempts · ${counts.retries} retries${replaying ? ' · replaying ×2' : ''}`}
      >
        {state.spans.length === 0 ? (
          <EmptyState title="No trace yet">
            Start a workflow. The planner span opens, fans out to parallel worker spans, then the reviewer merges them. Crashes, timeouts and backoff gaps show up as they happen.
          </EmptyState>
        ) : (
          <div className="grid gap-4">
            <SpanTree spans={state.spans} now={now} selected={selected} onSelect={setSelected} />
            {sel ? <SpanDetail span={sel} now={now} /> : <p className="m-0 text-0 text-ink-3">Select a span to see its input, output and attributes.</p>}
          </div>
        )}
      </DemoPanel>

      <ResultPanel state={state} replaying={replaying} counts={counts} simulated={ranMode === 'simulated'} offerSim={offerSim} onSimulate={() => { setMode('simulated'); void start('simulated') }} />
    </DemoGrid>
  )
}

function ResultPanel({ state, replaying, counts, simulated, offerSim, onSimulate }: {
  state: Run
  replaying: boolean
  counts: { attempts: number; retries: number; timeouts: number; failures: number; tokens: number }
  simulated: boolean
  offerSim: string | null
  onSimulate: () => void
}) {
  const r = state.result
  return (
    <DemoPanel title="Result" meta={state.status === 'idle' ? undefined : state.status}>
      <div aria-live="polite">
        {state.status === 'idle' ? (
          <EmptyState title="Nothing merged yet">The reviewer&apos;s merged answer and score land here.</EmptyState>
        ) : state.status === 'running' ? (
          <p className="m-0 flex items-center gap-2 mono text-ink-2" role="status"><Icon name="nodes" size={16} className="text-accent-ink" />{replaying ? 'Replaying…' : 'Agents at work…'}</p>
        ) : state.status === 'cancelled' ? (
          <p className="m-0 text-0 text-ink-2">Cancelled. Every running activity received the cancellation and stopped.</p>
        ) : state.status === 'failed' ? (
          <ErrorState
            title="Workflow failed"
            action={offerSim ? <Button size="sm" variant="secondary" icon="play" onClick={onSimulate}>Run with simulated agents</Button> : undefined}
          >
            {offerSim ? `${offerSim} The runtime is the same either way; simulated agents return scripted text.` : state.error}
          </ErrorState>
        ) : r ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={r.review.verdict === 'approve' ? 'ok' : 'warn'}>{r.review.verdict}</Badge>
              <span className="display text-3 nums">{r.review.score}<span className="text-1 text-ink-3">/10</span></span>
              {r.revisions ? <Badge tone="accent">{r.revisions} revision</Badge> : null}
              {simulated ? <Badge tone="warn">simulated agents</Badge> : null}
            </div>
            <p className="m-0 text-0 text-ink-2 italic">{r.review.notes}</p>
            <div className="whitespace-pre-wrap text-1 leading-[var(--lh-body)] [overflow-wrap:anywhere] measure">{r.review.finalAnswer}</div>
            <details className="group border-t border-rule-soft pt-2">
              <summary className="flex min-h-tap cursor-pointer list-none items-center gap-2 mono text-ink-2 [&::-webkit-details-marker]:hidden">
                <Icon name="plus" size={14} className="transition-transform group-open:rotate-45 motion-reduce:transition-none" />
                Worker outputs ({r.outputs.length})
              </summary>
              <ol className="m-0 p-0 list-none grid gap-2">
                {r.outputs.map(({ task, work, error }) => (
                  <li key={task.id} className="grid gap-1 p-3 border border-rule-soft rounded-1 bg-bg-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-00 text-accent-ink">{task.id}</span>
                      <span className="font-semibold text-0">{task.title}</span>
                      {work ? <span className="nums font-mono text-00 text-ink-3">confidence {work.confidence}</span> : <Badge tone="danger">failed</Badge>}
                    </span>
                    <span className="whitespace-pre-wrap text-0 text-ink-2 [overflow-wrap:anywhere]">{work?.output ?? error}</span>
                  </li>
                ))}
              </ol>
            </details>
            <dl className="m-0 grid grid-cols-2 xs:grid-cols-5 gap-2 font-mono text-00">
              {[['attempts', counts.attempts], ['retries', counts.retries], ['timeouts', counts.timeouts], ['failed attempts', counts.failures], ['tokens', simulated ? '—' : counts.tokens]].map(([k, v]) => (
                <div key={k} className="grid gap-[2px] p-2 border border-rule-soft rounded-0">
                  <dt className="text-ink-3 uppercase tracking-[.06em]">{k}</dt>
                  <dd className="m-0 nums text-2 font-display">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </DemoPanel>
  )
}
