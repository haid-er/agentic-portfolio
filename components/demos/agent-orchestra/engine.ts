/**
 * A tiny durable-execution runtime in the spirit of Temporal, with Langfuse-style tracing.
 * - Activities run with a retry policy (exponential backoff) and a start-to-close timeout.
 * - Every lifecycle step is appended to an event history and to a span tree.
 * - Everything goes through `Recorder.emit`, so a finished run can be replayed from its log.
 * Pure TypeScript: no React, no network.
 */
import { AiError } from '@/lib/ai'

/* ------------------------------------------------------------------ */
/* state                                                               */
/* ------------------------------------------------------------------ */

export type SpanKind = 'workflow' | 'agent' | 'generation' | 'backoff' | 'marker'
export type SpanStatus = 'running' | 'ok' | 'error' | 'timeout' | 'cancelled'

export interface Span {
  id: string
  parentId: string | null
  name: string
  kind: SpanKind
  /** ms since the run started. */
  start: number
  end: number | null
  status: SpanStatus
  attrs: Record<string, string | number>
  input?: unknown
  output?: unknown
  error?: string
  /** Start-to-close deadline (ms since start) of a running attempt. */
  deadline?: number
}

export interface HistoryEvent {
  id: number
  t: number
  type: string
  detail: string
  spanId?: string
}

export type RunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface RunState<R = unknown> {
  spans: Span[]
  events: HistoryEvent[]
  status: RunStatus
  result?: R
  error?: string
}

export type Action<R = unknown> =
  | { type: 'reset' }
  | { type: 'span'; span: Span }
  | { type: 'spanPatch'; id: string; patch: Partial<Span> }
  | { type: 'event'; event: Omit<HistoryEvent, 'id'> }
  | { type: 'status'; status: RunStatus; result?: R; error?: string }

export const initialRun: RunState = { spans: [], events: [], status: 'idle' }

export function reducer<R>(s: RunState<R>, a: Action<R>): RunState<R> {
  switch (a.type) {
    case 'reset': return { spans: [], events: [], status: 'running' }
    case 'span': return { ...s, spans: [...s.spans.filter((x) => x.id !== a.span.id), a.span] }
    case 'spanPatch': return { ...s, spans: s.spans.map((x) => (x.id === a.id ? { ...x, ...a.patch, attrs: { ...x.attrs, ...(a.patch.attrs ?? {}) } } : x)) }
    case 'event': return { ...s, events: [...s.events, { ...a.event, id: s.events.length + 1 }] }
    case 'status': return { ...s, status: a.status, result: a.result ?? s.result, error: a.error }
  }
}

/* ------------------------------------------------------------------ */
/* recorder                                                            */
/* ------------------------------------------------------------------ */

export interface LoggedAction<R = unknown> { t: number; action: Action<R> }

export class Recorder<R = unknown> {
  private readonly t0 = performance.now()
  private n = 0
  readonly log: LoggedAction<R>[] = []
  constructor(private readonly dispatch: (a: Action<R>) => void) {}

  now(): number { return Math.round(performance.now() - this.t0) }

  emit(action: Action<R>) {
    this.log.push({ t: this.now(), action })
    this.dispatch(action)
  }

  start(span: Omit<Span, 'id' | 'start' | 'end' | 'status' | 'attrs'> & { attrs?: Span['attrs'] }): string {
    const id = `s${++this.n}`
    this.emit({ type: 'span', span: { attrs: {}, ...span, id, start: this.now(), end: null, status: 'running' } })
    return id
  }

  end(id: string, status: SpanStatus, patch: Partial<Span> = {}) {
    this.emit({ type: 'spanPatch', id, patch: { ...patch, status, end: this.now(), deadline: undefined } })
  }

  patch(id: string, patch: Partial<Span>) { this.emit({ type: 'spanPatch', id, patch }) }

  event(type: string, detail: string, spanId?: string) {
    this.emit({ type: 'event', event: { t: this.now(), type, detail, spanId } })
  }
}

/* ------------------------------------------------------------------ */
/* activities                                                          */
/* ------------------------------------------------------------------ */

export interface RetryPolicy {
  maximumAttempts: number
  initialIntervalMs: number
  backoffCoefficient: number
  maximumIntervalMs: number
  startToCloseTimeoutMs: number
}

export type Fault = { attempt: number; kind: 'crash' | 'hang' }

export class TimeoutError extends Error { constructor(ms: number) { super(`StartToClose timeout after ${ms / 1000}s`); this.name = 'TimeoutError' } }
export class CancelledError extends Error { constructor() { super('Workflow cancelled'); this.name = 'CancelledError' } }
export class ActivityFailure extends Error {
  constructor(readonly activity: string, readonly cause: unknown) {
    super(`${activity} failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    this.name = 'ActivityFailure'
  }
}

/** Errors that retrying cannot fix (Temporal: non-retryable error types). */
function retryable(e: unknown): boolean {
  if (e instanceof AiError) return !['quota_exhausted', 'unavailable', 'bad_request', 'input_too_large', 'aborted'].includes(e.code)
  return true
}

export const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(new CancelledError()); return }
  const id = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve() }, ms)
  const onAbort = () => { clearTimeout(id); reject(new CancelledError()) }
  signal.addEventListener('abort', onAbort, { once: true })
})

export interface ActivityResult<T> { value: T; output?: unknown; attrs?: Span['attrs'] }

export interface ActivityOptions<T> {
  name: string
  activityType: string
  parentId: string
  input: unknown
  policy: RetryPolicy
  signal: AbortSignal
  fault?: Fault
  /** Label for attempt spans ("generation" when a model is called). */
  attemptLabel: string
  fn: (ctx: { signal: AbortSignal; attempt: number; feedback?: string }) => Promise<ActivityResult<T>>
}

/** Run fn once with a start-to-close timeout; an injected fault can crash or hang it. */
async function attemptOnce<T>(opts: ActivityOptions<T>, attempt: number): Promise<ActivityResult<T>> {
  const ctrl = new AbortController()
  const onParent = () => ctrl.abort(new CancelledError())
  opts.signal.addEventListener('abort', onParent, { once: true })
  const ms = opts.policy.startToCloseTimeoutMs
  const timer = setTimeout(() => ctrl.abort(new TimeoutError(ms)), ms)
  const aborted = new Promise<never>((_, reject) => {
    ctrl.signal.addEventListener('abort', () => reject(ctrl.signal.reason instanceof Error ? ctrl.signal.reason : new CancelledError()), { once: true })
  })
  try {
    const work = (async () => {
      if (opts.fault?.attempt === attempt) {
        if (opts.fault.kind === 'crash') { await sleep(450, ctrl.signal); throw new Error('Injected fault: worker process crashed (ECONNRESET)') }
        await new Promise<never>(() => { /* hang until the timeout fires */ })
      }
      return opts.fn({ signal: ctrl.signal, attempt })
    })()
    return await Promise.race([work, aborted])
  } finally {
    clearTimeout(timer)
    opts.signal.removeEventListener('abort', onParent)
  }
}

/** Run an activity under its retry policy, recording spans and history events. */
export async function runActivity<T, R>(rec: Recorder<R>, opts: ActivityOptions<T>): Promise<ActivityResult<T>> {
  const p = opts.policy
  const act = rec.start({
    name: opts.name, kind: 'agent', parentId: opts.parentId, input: opts.input,
    attrs: { activityType: opts.activityType, maximumAttempts: p.maximumAttempts, startToCloseTimeout: `${p.startToCloseTimeoutMs / 1000}s` },
  })
  rec.event('ActivityTaskScheduled', `${opts.activityType} · ${opts.name}`, act)
  for (let attempt = 1; ; attempt++) {
    const att = rec.start({ name: `${opts.attemptLabel} · attempt ${attempt}`, kind: 'generation', parentId: act, deadline: rec.now() + p.startToCloseTimeoutMs, attrs: { attempt } })
    rec.event('ActivityTaskStarted', `${opts.name} · attempt ${attempt}`, att)
    try {
      const r = await attemptOnce(opts, attempt)
      rec.end(att, 'ok', { output: r.output, attrs: r.attrs ?? {} })
      rec.end(act, 'ok', { output: r.output, attrs: { attempts: attempt } })
      rec.event('ActivityTaskCompleted', `${opts.name}${attempt > 1 ? ` after ${attempt} attempts` : ''}`, act)
      return r
    } catch (e) {
      if (opts.signal.aborted || e instanceof CancelledError) {
        rec.end(att, 'cancelled'); rec.end(act, 'cancelled')
        rec.event('ActivityTaskCanceled', opts.name, act)
        throw new CancelledError()
      }
      const msg = e instanceof Error ? e.message : String(e)
      if (e instanceof TimeoutError) {
        rec.end(att, 'timeout', { error: msg })
        rec.event('ActivityTaskTimedOut', `${opts.name} · ${msg}`, att)
      } else {
        rec.end(att, 'error', { error: msg })
        rec.event('ActivityTaskFailed', `${opts.name} · ${msg}`, att)
      }
      const canRetry = retryable(e)
      if (!canRetry || attempt >= p.maximumAttempts) {
        rec.end(act, 'error', { error: canRetry ? `Gave up after ${attempt} attempt${attempt === 1 ? '' : 's'}: ${msg}` : `Non-retryable: ${msg}`, attrs: { attempts: attempt } })
        throw new ActivityFailure(opts.name, e)
      }
      let wait = Math.min(p.maximumIntervalMs, Math.round(p.initialIntervalMs * p.backoffCoefficient ** (attempt - 1)))
      if (e instanceof AiError && e.retryAfterSec) wait = Math.min(8000, Math.max(wait, e.retryAfterSec * 1000))
      const b = rec.start({ name: `backoff ${wait} ms`, kind: 'backoff', parentId: act, attrs: { nextAttempt: attempt + 1 } })
      rec.event('RetryScheduled', `${opts.name} · attempt ${attempt + 1} in ${wait} ms (backoff ×${p.backoffCoefficient})`, b)
      try { await sleep(wait, opts.signal) } catch {
        rec.end(b, 'cancelled'); rec.end(act, 'cancelled')
        rec.event('ActivityTaskCanceled', opts.name, act)
        throw new CancelledError()
      }
      rec.end(b, 'ok')
    }
  }
}

/* ------------------------------------------------------------------ */
/* views                                                               */
/* ------------------------------------------------------------------ */

/** Depth-first order with depth, children sorted by start. */
export function flattenTree(spans: Span[]): Array<{ span: Span; depth: number }> {
  const kids = new Map<string | null, Span[]>()
  for (const s of spans) kids.set(s.parentId, [...(kids.get(s.parentId) ?? []), s])
  for (const list of kids.values()) list.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id, 'en', { numeric: true }))
  const out: Array<{ span: Span; depth: number }> = []
  const walk = (parent: string | null, depth: number) => {
    for (const s of kids.get(parent) ?? []) { out.push({ span: s, depth }); walk(s.id, depth + 1) }
  }
  walk(null, 0)
  return out
}
