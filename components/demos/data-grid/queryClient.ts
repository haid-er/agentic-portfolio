/**
 * A small React-Query-style cache, written for the lab so every rule is visible:
 * - entries are keyed by a serialised array; identical keys share one in-flight request
 * - data is fresh for `staleTime`, then stale; stale data is still shown while a refetch runs
 * - an entry with no observers is "inactive" and is garbage-collected after `gcTime`
 * - failed fetches retry with exponential backoff
 * - window focus refetches stale, observed entries (when enabled)
 * State objects are replaced on every change, so useSyncExternalStore sees new snapshots.
 */

export type QueryStatus = 'pending' | 'success' | 'error'

export interface QueryState<T = unknown> {
  key: string
  label: string
  data?: T
  error?: string
  status: QueryStatus
  fetching: boolean
  /** 0 means invalidated (always stale). */
  dataUpdatedAt: number
  fetchCount: number
  failureCount: number
  observers: number
  inactiveSince: number | null
}

export type LogKind =
  | 'fetch' | 'success' | 'error' | 'retry' | 'hit' | 'dedupe' | 'focus' | 'prefetch'
  | 'invalidate' | 'optimistic' | 'rollback' | 'confirm' | 'gc'

export interface LogEntry { id: number; at: number; kind: LogKind; label: string; text: string }

export interface ClientOptions {
  staleTime: number
  gcTime: number
  retry: number
  refetchOnFocus: boolean
}

type Fetcher<T> = (signal: AbortSignal) => Promise<T>

interface Internal {
  fn: Fetcher<unknown>
  promise: Promise<void> | null
  controller: AbortController | null
  gcTimer: ReturnType<typeof setTimeout> | null
}

const LOG_CAP = 60

export class QueryClient {
  private states = new Map<string, QueryState>()
  private internals = new Map<string, Internal>()
  private listeners = new Set<() => void>()
  private logSeq = 0
  private listSnapshot: QueryState[] = []
  log: LogEntry[] = []
  opts: ClientOptions

  constructor(opts: ClientOptions) {
    this.opts = opts
  }

  /* ---------- subscription (useSyncExternalStore) ---------- */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  private emit() {
    this.listSnapshot = [...this.states.values()]
    for (const fn of this.listeners) fn()
  }

  getState = <T,>(key: string): QueryState<T> | undefined => this.states.get(key) as QueryState<T> | undefined
  list = (): QueryState[] => this.listSnapshot
  getLog = (): LogEntry[] => this.log

  private write(key: string, patch: Partial<QueryState>) {
    const prev = this.states.get(key)
    if (!prev) return
    this.states.set(key, { ...prev, ...patch })
  }

  private note(kind: LogKind, label: string, text: string) {
    this.log = [{ id: ++this.logSeq, at: Date.now(), kind, label, text }, ...this.log].slice(0, LOG_CAP)
  }

  setOptions(p: Partial<ClientOptions>) {
    this.opts = { ...this.opts, ...p }
    // Re-arm GC timers so a shorter gcTime applies to entries already inactive.
    for (const [key, s] of this.states) if (s.observers === 0) this.scheduleGc(key)
    this.emit()
  }

  isStale(s: QueryState, now = Date.now()): boolean {
    return s.status !== 'success' || s.dataUpdatedAt === 0 || now - s.dataUpdatedAt >= this.opts.staleTime
  }

  /* ---------- registration ---------- */

  private ensure(key: string, label: string, fn: Fetcher<unknown>) {
    if (!this.states.has(key)) {
      this.states.set(key, {
        key, label, status: 'pending', fetching: false, dataUpdatedAt: 0,
        fetchCount: 0, failureCount: 0, observers: 0, inactiveSince: Date.now(),
      })
      this.internals.set(key, { fn, promise: null, controller: null, gcTimer: null })
    } else {
      const inner = this.internals.get(key)
      if (inner) inner.fn = fn
    }
  }

  /** A component starts reading `key`. Returns the unsubscribe function. */
  observe<T>(key: string, label: string, fn: Fetcher<T>): () => void {
    this.ensure(key, label, fn as Fetcher<unknown>)
    const s = this.states.get(key)!
    const inner = this.internals.get(key)!
    if (inner.gcTimer) { clearTimeout(inner.gcTimer); inner.gcTimer = null }
    this.write(key, { observers: s.observers + 1, inactiveSince: null })
    if (this.isStale(s)) void this.fetch(key, s.status === 'success' ? 'stale on mount' : 'mount')
    else this.note('hit', label, 'Cache hit: fresh data, no request sent.')
    this.emit()
    return () => {
      const cur = this.states.get(key)
      if (!cur) return
      const observers = Math.max(0, cur.observers - 1)
      this.write(key, { observers, inactiveSince: observers === 0 ? Date.now() : null })
      if (observers === 0) this.scheduleGc(key)
      this.emit()
    }
  }

  /** Warm the cache without an observer (pagination prefetch). */
  prefetch<T>(key: string, label: string, fn: Fetcher<T>) {
    this.ensure(key, label, fn as Fetcher<unknown>)
    const s = this.states.get(key)!
    if (!this.isStale(s) || s.fetching) return
    this.note('prefetch', label, 'Prefetching the next page in the background.')
    if (s.observers === 0) this.scheduleGc(key)
    void this.fetch(key, 'prefetch')
  }

  /* ---------- fetching ---------- */

  fetch(key: string, reason: string): Promise<void> {
    const inner = this.internals.get(key)
    const s = this.states.get(key)
    if (!inner || !s) return Promise.resolve()
    if (inner.promise) {
      this.note('dedupe', s.label, `Request already in flight; "${reason}" joins it.`)
      this.emit()
      return inner.promise
    }
    const controller = new AbortController()
    inner.controller = controller
    this.write(key, { fetching: true, fetchCount: s.fetchCount + 1 })
    this.note('fetch', s.label, `Fetch started (${reason}).`)
    this.emit()

    const run = async () => {
      let attempt = 0
      for (;;) {
        try {
          const data = await inner.fn(controller.signal)
          if (controller.signal.aborted) return
          this.write(key, { data, error: undefined, status: 'success', dataUpdatedAt: Date.now(), failureCount: 0, fetching: false })
          this.note('success', s.label, attempt ? `Succeeded after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}.` : 'Fresh data stored.')
          return
        } catch (e) {
          if (controller.signal.aborted) return
          const message = e instanceof Error ? e.message : 'Request failed.'
          attempt++
          if (attempt <= this.opts.retry) {
            const wait = 400 * 2 ** (attempt - 1)
            this.write(key, { failureCount: attempt })
            this.note('retry', s.label, `${message} Retrying in ${wait} ms.`)
            this.emit()
            await new Promise((r) => setTimeout(r, wait))
            if (controller.signal.aborted) return
            continue
          }
          // Keep old data on error: stale data beats an empty table.
          this.write(key, { error: message, status: this.states.get(key)?.data !== undefined ? 'success' : 'error', fetching: false, failureCount: attempt })
          this.note('error', s.label, message)
          return
        }
      }
    }

    inner.promise = run().finally(() => {
      inner.promise = null
      inner.controller = null
      this.emit()
    })
    return inner.promise
  }

  /** Window focus: refetch observed entries whose data is stale. */
  onFocus(source: string) {
    if (!this.opts.refetchOnFocus) {
      this.note('focus', 'window', `${source}: refetch on focus is off, nothing sent.`)
      this.emit()
      return
    }
    const stale = [...this.states.values()].filter((s) => s.observers > 0 && this.isStale(s))
    this.note('focus', 'window', stale.length ? `${source}: refetching ${stale.length} stale ${stale.length === 1 ? 'query' : 'queries'}.` : `${source}: everything observed is fresh, nothing sent.`)
    for (const s of stale) void this.fetch(s.key, 'window focus')
    this.emit()
  }

  /** Mark matching entries stale; refetch the ones on screen. */
  invalidate(match: (key: string) => boolean, why: string) {
    let n = 0
    for (const [key, s] of this.states) {
      if (!match(key)) continue
      n++
      this.write(key, { dataUpdatedAt: 0 })
      if (s.observers > 0) void this.fetch(key, why)
    }
    this.note('invalidate', 'cache', `${why}: ${n} ${n === 1 ? 'entry' : 'entries'} marked stale.`)
    this.emit()
  }

  /* ---------- manual cache writes (optimistic updates) ---------- */

  snapshot<T>(match: (key: string) => boolean): Map<string, T | undefined> {
    const out = new Map<string, T | undefined>()
    for (const [key, s] of this.states) if (match(key)) out.set(key, s.data as T | undefined)
    return out
  }

  updateData<T>(match: (key: string) => boolean, fn: (data: T) => T) {
    for (const [key, s] of this.states) {
      if (match(key) && s.data !== undefined) this.write(key, { data: fn(s.data as T) })
    }
    this.emit()
  }

  restore<T>(snap: Map<string, T | undefined>) {
    for (const [key, data] of snap) if (this.states.has(key)) this.write(key, { data })
    this.emit()
  }

  record(kind: LogKind, label: string, text: string) {
    this.note(kind, label, text)
    this.emit()
  }

  remove(key: string) {
    const inner = this.internals.get(key)
    inner?.controller?.abort()
    if (inner?.gcTimer) clearTimeout(inner.gcTimer)
    this.internals.delete(key)
    this.states.delete(key)
    this.emit()
  }

  clear() {
    for (const key of [...this.states.keys()]) this.remove(key)
    this.log = []
    this.emit()
  }

  private scheduleGc(key: string) {
    const inner = this.internals.get(key)
    const s = this.states.get(key)
    if (!inner || !s) return
    if (inner.gcTimer) clearTimeout(inner.gcTimer)
    const since = s.inactiveSince ?? Date.now()
    const wait = Math.max(0, since + this.opts.gcTime - Date.now())
    inner.gcTimer = setTimeout(() => {
      const cur = this.states.get(key)
      if (!cur || cur.observers > 0) return
      if (cur.fetching) { inner.gcTimer = setTimeout(() => this.scheduleGc(key), 1000); return }
      this.note('gc', cur.label, `Inactive for ${Math.round(this.opts.gcTime / 1000)} s: removed from the cache.`)
      this.remove(key)
    }, wait)
  }
}
