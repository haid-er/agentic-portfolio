/**
 * Sandbox worker for the code judge. It runs in its own thread with no DOM, no cookies API and
 * no storage; before compiling user code it also removes network and nested-worker APIs. The
 * main thread enforces time limits by terminating this worker.
 */
import type { RunRequest, WorkerMessage } from './protocol'

const scope = self as unknown as DedicatedWorkerGlobalScope
const post = scope.postMessage.bind(scope) as (m: WorkerMessage) => void

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

scope.onmessage = (e: MessageEvent<RunRequest>) => {
  const req = e.data
  if (!req || req.type !== 'run') return
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
    post({ type: 'compile-error', message: err instanceof Error ? `${err.name}: ${err.message}` : String(err) })
    return
  }
  if (typeof solve !== 'function') {
    post({ type: 'compile-error', message: 'Define a function named solve (for example: function solve(nums) { … }).' })
    return
  }
  post({ type: 'compiled' })

  req.tests.forEach((args, index) => {
    logs = []
    post({ type: 'start', index })
    const t0 = performance.now()
    try {
      const value = (solve as (...a: unknown[]) => unknown)(...args)
      const ms = performance.now() - t0
      try {
        post({ type: 'result', index, ok: true, value, ms, logs })
      } catch {
        post({ type: 'result', index, ok: false, error: 'The return value could not be copied back (return plain numbers, strings, booleans or arrays).', ms, logs })
      }
    } catch (err) {
      const ms = performance.now() - t0
      const error = err instanceof Error ? `${err.name}: ${err.message}` : `Thrown: ${format(err)}`
      post({ type: 'result', index, ok: false, error, ms, logs })
    }
  })
  post({ type: 'end' })
}
