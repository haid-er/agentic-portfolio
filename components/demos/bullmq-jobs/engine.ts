/**
 * A deterministic model of a BullMQ queue plus one worker process, in simulated time.
 *
 * Covered semantics: waiting -> active -> completed/failed, `attempts` with fixed or
 * exponential `backoff` (delay * 2^(attemptsMade-1)), delayed jobs, job schedulers
 * (repeat every N ms, next instance added when the current one starts), flows
 * (parent in waiting-children until every child completes; failParentOnFailure), worker
 * `concurrency`, and stalled-job recovery after a worker crash (maxStalledCount = 1).
 */
import { seeded } from '@/lib/utils'

export type JobState = 'delayed' | 'waiting' | 'waiting-children' | 'active' | 'completed' | 'failed'
export type BackoffType = 'fixed' | 'exponential'
export type LogTone = 'info' | 'ok' | 'warn' | 'danger'

export interface JobOpts {
  attempts: number
  backoff: { type: BackoffType; delay: number }
  delay: number
}

export interface Attempt {
  n: number
  slot: number
  start: number
  end?: number
  outcome: 'running' | 'ok' | 'fail' | 'stalled'
  error?: string
  nextDelay?: number
}

export interface Job {
  id: number
  name: string
  opts: JobOpts
  state: JobState
  attemptsMade: number
  stalledCount: number
  createdAt: number
  delayUntil?: number
  finishedOn?: number
  failedReason?: string
  poison: boolean
  schedulerKey?: string
  parentId?: number
  childIds?: number[]
  history: Attempt[]
  /** While active: the running attempt's planned work and its slot. */
  work?: { total: number; left: number; slot: number; willFail: boolean; lockUntil: number; orphan: boolean }
}

export interface Scheduler { key: string; name: string; every: number; opts: JobOpts; created: number; runs: number }
export interface LogLine { id: number; t: number; text: string; tone: LogTone; jobId?: number }

export interface Counts extends Record<JobState, number> { total: number }

export interface Snapshot {
  now: number
  concurrency: number
  failPct: number
  workerAlive: boolean
  poisonNext: boolean
  jobs: Job[]
  counts: Counts
  schedulers: Scheduler[]
  log: LogLine[]
  completedTotal: number
  failedTotal: number
  retriesTotal: number
  throughput: number
}

export const JOB_TYPES = [
  { name: 'ingest-upload', ms: 1400 },
  { name: 'extract-rows', ms: 1000 },
  { name: 'compute-totals', ms: 800 },
  { name: 'render-report', ms: 1800 },
  { name: 'send-email', ms: 500 },
] as const
export type JobName = (typeof JOB_TYPES)[number]['name']

export const QUEUE_NAME = 'reports'
export const STALL_MS = 3000
export const MAX_STALLED = 1
const KEEP_FINISHED = 60
const LOG_KEEP = 120

const FAILURES = ['ECONNRESET from upstream API', 'Timeout after 30000ms', 'Rate limited (429)', 'Malformed row 17', 'Deadlock detected, retry']

/** BullMQ's built-in backoff: fixed = delay, exponential = round(2^(attemptsMade-1) * delay). */
export function backoffDelay(b: JobOpts['backoff'], attemptsMade: number): number {
  return b.type === 'fixed' ? b.delay : Math.round(2 ** (attemptsMade - 1) * b.delay)
}

/** The retry waits a job will see if every attempt fails. */
export function retrySchedule(opts: JobOpts): number[] {
  return Array.from({ length: Math.max(0, opts.attempts - 1) }, (_, i) => backoffDelay(opts.backoff, i + 1))
}

const durationOf = (name: string) => JOB_TYPES.find((j) => j.name === name)?.ms ?? 1000

export class JobQueue {
  now = 0
  concurrency = 3
  failPct = 15
  workerAlive = true
  poisonNext = false
  jobs: Job[] = []
  schedulers: Scheduler[] = []
  log: LogLine[] = []
  completedTotal = 0
  failedTotal = 0
  retriesTotal = 0

  private seq = 0
  private logSeq = 0
  private doneTimes: number[] = []
  private rand = seeded(2025)

  /* ------------------------------ producers ------------------------------ */

  add(name: string, opts: JobOpts, extra: Partial<Pick<Job, 'parentId' | 'schedulerKey'>> = {}): Job {
    const id = ++this.seq
    const poison = this.poisonNext
    this.poisonNext = false
    const job: Job = {
      id, name, opts, state: 'waiting', attemptsMade: 0, stalledCount: 0, createdAt: this.now, poison, history: [], ...extra,
    }
    if (opts.delay > 0) {
      job.state = 'delayed'
      job.delayUntil = this.now + opts.delay
      this.note(`added #${id} ${name} (delayed ${fmtMs(opts.delay)})`, 'info', id)
    } else {
      this.note(`added #${id} ${name}${poison ? ' (poison: every attempt will throw)' : ''}`, poison ? 'warn' : 'info', id)
    }
    this.jobs.push(job)
    return job
  }

  /** FlowProducer: a parent that waits for its children (each fails the parent if it fails for good). */
  addFlow(opts: JobOpts, children = 3): Job {
    const parent = this.add('render-report', { ...opts, delay: 0 })
    parent.state = 'waiting-children'
    parent.childIds = []
    for (let i = 0; i < children; i++) {
      const c = this.add('extract-rows', { ...opts, delay: 0 }, { parentId: parent.id })
      parent.childIds.push(c.id)
    }
    this.note(`flow: #${parent.id} render-report waits for ${children} children`, 'info', parent.id)
    return parent
  }

  /** Job scheduler (repeat every N ms). The first instance is added as a delayed job. */
  upsertScheduler(name: string, every: number, opts: JobOpts): Scheduler {
    const key = `${name}-every-${every / 1000}s`
    const existing = this.schedulers.find((s) => s.key === key)
    if (existing) return existing
    const s: Scheduler = { key, name, every, opts: { ...opts, delay: 0 }, created: this.now, runs: 0 }
    this.schedulers.push(s)
    this.note(`job scheduler ${key} upserted`, 'ok')
    this.add(name, { ...s.opts, delay: every }, { schedulerKey: key })
    return s
  }

  removeScheduler(key: string) {
    this.schedulers = this.schedulers.filter((s) => s.key !== key)
    const pending = this.jobs.filter((j) => j.schedulerKey === key && j.state === 'delayed')
    this.jobs = this.jobs.filter((j) => !pending.includes(j))
    this.note(`job scheduler ${key} removed (${pending.length} pending instance dropped)`, 'info')
  }

  /* ------------------------------ worker controls ------------------------------ */

  killWorker(): number {
    if (!this.workerAlive) return 0
    this.workerAlive = false
    const active = this.jobs.filter((j) => j.state === 'active')
    active.forEach((j) => {
      if (j.work) j.work.orphan = true
      const last = j.history[j.history.length - 1]
      if (last && last.outcome === 'running') { last.outcome = 'stalled'; last.end = this.now; last.error = 'worker crashed; lock held until it expires' }
    })
    this.note(`worker process crashed with ${active.length} active job(s). Their locks expire in ${fmtMs(STALL_MS)}.`, 'danger')
    return active.length
  }

  startWorker() {
    if (this.workerAlive) return
    this.workerAlive = true
    this.note(`worker started (concurrency ${this.concurrency})`, 'ok')
  }

  retryFailed(): number {
    const failed = this.jobs.filter((j) => j.state === 'failed' && j.parentId === undefined)
    failed.forEach((j) => {
      j.state = 'waiting'
      j.attemptsMade = 0
      j.stalledCount = 0
      j.failedReason = undefined
      j.poison = false
      if (j.childIds) this.resetChildren(j)
    })
    if (failed.length) this.note(`retried ${failed.length} failed job(s) (poison cleared, as if the bug were fixed)`, 'ok')
    return failed.length
  }

  clean() {
    const before = this.jobs.length
    this.jobs = this.jobs.filter((j) => j.state !== 'completed' && j.state !== 'failed')
    this.note(`clean: removed ${before - this.jobs.length} finished job(s)`, 'info')
  }

  /* ------------------------------ simulation ------------------------------ */

  step(dt: number) {
    this.now += dt
    this.promoteDelayed()
    this.checkStalled()
    this.runActive(dt)
    this.fetchJobs()
    const cutoff = this.now - 10000
    while (this.doneTimes.length && (this.doneTimes[0] as number) < cutoff) this.doneTimes.shift()
  }

  snapshot(): Snapshot {
    const counts: Counts = { delayed: 0, waiting: 0, 'waiting-children': 0, active: 0, completed: 0, failed: 0, total: this.jobs.length }
    this.jobs.forEach((j) => { counts[j.state]++ })
    const window = Math.min(this.now, 10000) / 1000
    return {
      now: this.now,
      concurrency: this.concurrency,
      failPct: this.failPct,
      workerAlive: this.workerAlive,
      poisonNext: this.poisonNext,
      jobs: this.jobs.map((j) => ({ ...j, history: j.history.slice(), work: j.work ? { ...j.work } : undefined })),
      counts,
      schedulers: this.schedulers.map((s) => ({ ...s })),
      log: this.log.slice(-LOG_KEEP),
      completedTotal: this.completedTotal,
      failedTotal: this.failedTotal,
      retriesTotal: this.retriesTotal,
      throughput: window > 0 ? this.doneTimes.length / window : 0,
    }
  }

  private promoteDelayed() {
    this.jobs.forEach((j) => {
      if (j.state === 'delayed' && (j.delayUntil ?? 0) <= this.now) {
        j.state = 'waiting'
        j.delayUntil = undefined
      }
    })
  }

  /** A running worker's stalled-job checker finds active jobs whose lock expired. */
  private checkStalled() {
    if (!this.workerAlive) return
    this.jobs.forEach((j) => {
      if (j.state !== 'active' || !j.work || j.work.lockUntil > this.now) return
      j.work = undefined
      j.stalledCount++
      if (j.stalledCount > MAX_STALLED) {
        this.fail(j, 'job stalled more than allowable limit')
      } else {
        j.state = 'waiting'
        this.note(`#${j.id} ${j.name} stalled (lock expired); moved back to waiting`, 'warn', j.id)
      }
    })
  }

  private runActive(dt: number) {
    if (!this.workerAlive) return
    this.jobs.forEach((j) => {
      if (j.state !== 'active' || !j.work || j.work.orphan) return
      j.work.left -= dt
      j.work.lockUntil = this.now + STALL_MS // the worker keeps extending its lock
      if (j.work.left > 0) return
      const { willFail } = j.work
      j.work = undefined
      j.attemptsMade++
      const last = j.history[j.history.length - 1]
      if (!willFail) {
        if (last) { last.outcome = 'ok'; last.end = this.now }
        this.complete(j)
        return
      }
      const error = j.poison ? 'TypeError: cannot read "rows" of undefined' : (FAILURES[Math.floor(this.rand() * FAILURES.length)] as string)
      if (last) { last.outcome = 'fail'; last.end = this.now; last.error = error }
      if (j.attemptsMade < j.opts.attempts) {
        const wait = backoffDelay(j.opts.backoff, j.attemptsMade)
        if (last) last.nextDelay = wait
        this.retriesTotal++
        j.failedReason = error
        if (wait > 0) { j.state = 'delayed'; j.delayUntil = this.now + wait } else j.state = 'waiting'
        this.note(`#${j.id} ${j.name} failed attempt ${j.attemptsMade}/${j.opts.attempts}: ${error}. Retry in ${fmtMs(wait)}`, 'warn', j.id)
      } else {
        this.fail(j, error, true)
      }
    })
  }

  private fetchJobs() {
    if (!this.workerAlive) return
    const busy = new Set<number>()
    this.jobs.forEach((j) => { if (j.state === 'active' && j.work && !j.work.orphan) busy.add(j.work.slot) })
    let free = this.concurrency - busy.size
    if (free <= 0) return
    const waiting = this.jobs.filter((j) => j.state === 'waiting')
    for (const j of waiting) {
      if (free <= 0) break
      let slot = 0
      while (busy.has(slot)) slot++
      busy.add(slot)
      free--
      this.start(j, slot)
    }
  }

  private start(j: Job, slot: number) {
    const base = durationOf(j.name)
    const total = Math.round(base * (0.7 + this.rand() * 0.6))
    const willFail = j.poison || this.rand() * 100 < this.failPct
    j.state = 'active'
    j.work = { total, left: total, slot, willFail, lockUntil: this.now + STALL_MS, orphan: false }
    j.history.push({ n: j.attemptsMade + 1, slot, start: this.now, outcome: 'running' })
    if (j.schedulerKey && j.history.length === 1) {
      const s = this.schedulers.find((x) => x.key === j.schedulerKey)
      if (s) {
        s.runs++
        this.add(s.name, { ...s.opts, delay: s.every }, { schedulerKey: s.key })
      }
    }
  }

  private complete(j: Job) {
    j.state = 'completed'
    j.finishedOn = this.now
    j.failedReason = undefined
    this.completedTotal++
    this.doneTimes.push(this.now)
    this.note(`#${j.id} ${j.name} completed${j.attemptsMade > 1 ? ` on attempt ${j.attemptsMade}` : ''}`, 'ok', j.id)
    if (j.parentId !== undefined) this.childDone(j)
    this.trim()
  }

  private fail(j: Job, reason: string, exhausted = false) {
    j.state = 'failed'
    j.failedReason = reason
    j.finishedOn = this.now
    j.work = undefined
    this.failedTotal++
    this.note(`#${j.id} ${j.name} failed${exhausted ? ` after ${j.attemptsMade} attempt(s) (retries exhausted)` : ''}: ${reason}`, 'danger', j.id)
    if (j.parentId !== undefined) {
      const parent = this.jobs.find((p) => p.id === j.parentId)
      if (parent && parent.state === 'waiting-children') this.fail(parent, `child #${j.id} failed (failParentOnFailure)`)
    }
    this.trim()
  }

  private childDone(child: Job) {
    const parent = this.jobs.find((p) => p.id === child.parentId)
    if (!parent || parent.state !== 'waiting-children') return
    const kids = this.jobs.filter((k) => k.parentId === parent.id)
    if (kids.every((k) => k.state === 'completed')) {
      parent.state = 'waiting'
      this.note(`#${parent.id} ${parent.name}: all ${kids.length} children completed, moved to waiting`, 'ok', parent.id)
    }
  }

  private resetChildren(parent: Job) {
    const kids = this.jobs.filter((k) => k.parentId === parent.id)
    parent.state = kids.every((k) => k.state === 'completed') ? 'waiting' : 'waiting-children'
    kids.forEach((k) => {
      if (k.state === 'failed') { k.state = 'waiting'; k.attemptsMade = 0; k.stalledCount = 0; k.failedReason = undefined; k.poison = false }
    })
  }

  /** removeOnComplete / removeOnFail: keep the newest finished jobs only (never a flow's live members). */
  private trim() {
    const finished = this.jobs.filter((j) => j.state === 'completed' || j.state === 'failed')
    if (finished.length <= KEEP_FINISHED) return
    const liveParents = new Set(this.jobs.filter((j) => j.state === 'waiting-children').map((j) => j.id))
    const drop = new Set(
      finished
        .filter((j) => j.parentId === undefined || !liveParents.has(j.parentId))
        .sort((a, b) => (a.finishedOn ?? 0) - (b.finishedOn ?? 0))
        .slice(0, finished.length - KEEP_FINISHED)
        .map((j) => j.id),
    )
    this.jobs = this.jobs.filter((j) => !drop.has(j.id))
  }

  private note(text: string, tone: LogTone, jobId?: number) {
    this.log.push({ id: ++this.logSeq, t: this.now, text, tone, jobId })
    if (this.log.length > LOG_KEEP * 2) this.log.splice(0, this.log.length - LOG_KEEP)
  }
}

export function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  return s < 60 ? `${s % 1 === 0 ? s.toFixed(0) : s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}
