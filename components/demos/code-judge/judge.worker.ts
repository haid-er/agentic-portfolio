/**
 * Sandbox worker for the code judge. It runs in its own thread with no DOM, no cookies API and
 * no storage; before compiling user code it also removes network and nested-worker APIs. The
 * main thread enforces time limits by terminating this worker.
 *
 * User code runs through `new Function`, so it sees globals but never this module's closure.
 * Everything it could tamper with (the clock, the reporting channel) is captured here first:
 * results go only through a private MessagePort the main thread transfers in with the run
 * request, and the main thread ignores anything posted on the worker's global channel.
 */
import type { RunRequest, WorkerMessage } from './protocol'

const scope = self as unknown as DedicatedWorkerGlobalScope
const now = performance.now.bind(performance)
const portPost = MessagePort.prototype.postMessage
const errorName = (err: unknown) => (err instanceof Error ? `${err.name}: ${err.message}` : null)

const BLOCKED = [
  'fetch', 'XMLHttpRequest', 'WebSocket', 'WebSocketStream', 'EventSource', 'importScripts', 'indexedDB', 'caches',
  'BroadcastChannel', 'Worker', 'SharedWorker', 'WebTransport', 'Request', 'Response', 'FileReaderSync',
] as const

function lockDown() {
  for (const name of BLOCKED) {
    let o: object | null = scope
    while (o) {
      if (Object.getOwnPropertyDescriptor(o, name)) {
        try { Object.defineProperty(o, name, { value: undefined, writable: false, configurable: false }) } catch { /* not configurable */ }
      }
      o = Object.getPrototypeOf(o)
    }
  }
}

const MAX_LOG_LINES = 40
const MAX_LOG_CHARS = 240

function format(v: unknown): string {
  if (typeof v === 'string') return v
  try { return JSON.stringify(v) ?? String(v) } catch { return String(v) }
}

let logs: string[] = []
function capture(...parts: unknown[]) {
  if (logs.length >= MAX_LOG_LINES) return
  const line = parts.map(format).join(' ')
  logs.push(line.length > MAX_LOG_CHARS ? `${line.slice(0, MAX_LOG_CHARS)}…` : line)
  if (logs.length === MAX_LOG_LINES) logs.push('… output truncated')
}

let started = false

scope.onmessage = (e: MessageEvent<RunRequest>) => {
  const req = e.data
  const port = e.ports[0]
  if (started || !req || req.type !== 'run' || !port) return
  started = true
  // Bound now, before user code runs, so later changes to Function.prototype cannot intercept it.
  const post = portPost.bind(port) as (m: WorkerMessage) => void
  lockDown()
  const quiet = () => {}
  const log = req.captureLogs ? capture : quiet
  console.log = log
  console.info = log
  console.warn = log
  console.error = log
  console.debug = log

  let solve: unknown
  try {
    // Shadow the most obvious globals inside the user's scope as a second layer.
    const factory = new Function(
      'self', 'postMessage', 'close', 'onmessage',
      `"use strict";\n${req.code}\n;return typeof solve === "function" ? solve : undefined;`,
    )
    solve = factory(undefined, undefined, undefined, undefined)
  } catch (err) {
    post({ type: 'compile-error', message: errorName(err) ?? String(err) })
    return
  }
  if (typeof solve !== 'function') {
    post({ type: 'compile-error', message: 'Define a function named solve (for example: function solve(nums) { … }).' })
    return
  }
  post({ type: 'compiled' })

  // Plain loop and captured clock: user code may have replaced Array.prototype.forEach or performance.now.
  const tests = req.tests
  const count = tests.length
  for (let index = 0; index < count; index++) {
    const args = tests[index]
    logs = []
    post({ type: 'start', index })
    const t0 = now()
    try {
      const value = (solve as (...a: unknown[]) => unknown)(...args)
      const ms = now() - t0
      try {
        post({ type: 'result', index, ok: true, value, ms, logs })
      } catch {
        post({ type: 'result', index, ok: false, error: 'The return value could not be copied back (return plain numbers, strings, booleans or arrays).', ms, logs })
      }
    } catch (err) {
      const ms = now() - t0
      const error = errorName(err) ?? `Thrown: ${format(err)}`
      post({ type: 'result', index, ok: false, error, ms, logs })
    }
  }
  post({ type: 'end' })
}
