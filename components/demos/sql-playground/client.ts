'use client'
/**
 * Promise wrapper around the sql.js worker, with a watchdog: a request that runs longer than
 * `timeoutMs` terminates the worker and rejects with a TimeoutError; the caller restarts it.
 */
import type { Envelope, Reply, Request } from './protocol'
import { buildSeedSql } from './seed'

/**
 * Self-hosted copy first (offline-friendly), then the CDN build. The self-hosted file is copied
 * from node_modules/sql.js/dist at install time, so it always matches the installed JS glue; the
 * CDN version must equal the exact sql.js version pinned in package.json.
 */
export const WASM_URLS = [
  '/demos/sql-playground/sql-wasm.wasm',
  'https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/sql-wasm.wasm',
]

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`The query was still running after ${(ms / 1000).toFixed(0)} s, so the database was restarted.`)
    this.name = 'TimeoutError'
  }
}

type ReplyType = Extract<Reply, { ok: true }>['type']
type Ok<T extends ReplyType> = Extract<Reply, { ok: true; type: T }>
type Pending = { resolve: (r: Reply) => void; reject: (e: Error) => void; timer: number }

export class SqlClient {
  private worker: Worker
  private seq = 0
  private pending = new Map<number, Pending>()
  private dead = false

  constructor(private timeoutMs = 4000) {
    this.worker = new Worker(new URL('./sql.worker.ts', import.meta.url), { name: 'sql-playground' })
    this.worker.onmessage = (e: MessageEvent<Envelope<Reply>>) => {
      const p = this.pending.get(e.data.id)
      if (!p) return
      window.clearTimeout(p.timer)
      this.pending.delete(e.data.id)
      p.resolve(e.data)
    }
    this.worker.onerror = (e) => {
      e.preventDefault()
      this.fail(new Error(e.message || 'The SQLite worker crashed.'))
    }
  }

  private fail(err: Error) {
    this.dead = true
    this.worker.terminate()
    for (const p of this.pending.values()) { window.clearTimeout(p.timer); p.reject(err) }
    this.pending.clear()
  }

  private send<T extends ReplyType>(req: Request & { type: T }, timeoutMs = this.timeoutMs): Promise<Ok<T>> {
    if (this.dead) return Promise.reject(new Error('The SQLite worker has stopped.'))
    const id = ++this.seq
    return new Promise<Reply>((resolve, reject) => {
      const timer = window.setTimeout(() => this.fail(new TimeoutError(timeoutMs)), timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.worker.postMessage({ ...req, id })
    }).then((r) => {
      if (!r.ok) throw new Error(r.error)
      return r as Ok<T>
    })
  }

  init() { return this.send({ type: 'init', wasmUrls: WASM_URLS, seedSql: buildSeedSql() }, 30_000) }
  exec(sql: string) { return this.send({ type: 'exec', sql }).then((r) => r.outcome) }
  check(userSql: string, refSql: string) { return this.send({ type: 'check', userSql, refSql }) }
  schema() { return this.send({ type: 'schema' }).then((r) => r.tables) }
  reset() { return this.send({ type: 'reset' }) }
  export() { return this.send({ type: 'export' }).then((r) => r.bytes) }

  close() { this.fail(new Error('closed')) }
}
