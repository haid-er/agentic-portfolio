'use client'
/**
 * Sends a request to the real route (/api/demos/lab/*). If the server can't be reached,
 * `auto` mode runs the same layered app in the browser and says so.
 */
import { useCallback, useRef, useState } from 'react'
import { handle, requestId } from './api/app'
import { seedDb } from './api/store'
import type { LabDb, LabWire, LogLine, TraceStep } from './api/types'
import type { Method } from './presets'

export type RunMode = 'auto' | 'server' | 'browser'

export interface Exchange {
  id: number
  method: Method
  path: string
  requestBody: string
  status: number
  headers: [string, string][]
  body: unknown
  trace: TraceStep[]
  logs: LogLine[]
  durationMs: number
  roundTripMs: number
  runtime: 'server' | 'browser'
  coldStart?: boolean
  /** Why the browser answered instead of the server. */
  fallbackReason?: string
  at: string
}

const SHOWN_HEADERS = ['content-type', 'location', 'allow', 'x-request-id', 'x-response-time', 'x-lab-runtime', 'cache-control']

function sessionId(): string {
  const key = 'ghp:layered-api-lab:session'
  try {
    const got = localStorage.getItem(key)
    if (got) return got
    const made = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(key, made)
    return made
  } catch {
    return `s-${Date.now().toString(36)}-anon`
  }
}

function splitPath(path: string): { pathname: string; query: Record<string, string> } {
  const [p = '/', qs = ''] = path.split('?')
  const query: Record<string, string> = {}
  new URLSearchParams(qs).forEach((v, k) => { query[k] = v })
  return { pathname: p.startsWith('/') ? p : `/${p}`, query }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export function useLab() {
  const [history, setHistory] = useState<Exchange[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)
  const browserDb = useRef<LabDb | null>(null)
  const sid = useRef<string | null>(null)
  const abort = useRef<AbortController | null>(null)

  const runInBrowser = useCallback((method: Method, path: string, body: string, reason?: string): Exchange => {
    if (!browserDb.current) browserDb.current = seedDb()
    const t0 = now()
    const { pathname, query } = splitPath(path)
    const res = handle({ method, path: pathname, query, rawBody: body, requestId: requestId() }, browserDb.current)
    return {
      id: ++seq.current, method, path, requestBody: body, status: res.status,
      headers: Object.entries({ ...res.headers, 'x-lab-runtime': 'browser' }).filter(([k]) => SHOWN_HEADERS.includes(k)),
      body: res.body, trace: res.trace, logs: res.logs, durationMs: res.durationMs,
      roundTripMs: Math.round((now() - t0) * 100) / 100, runtime: 'browser', fallbackReason: reason, at: new Date().toISOString(),
    }
  }, [])

  const runOnServer = useCallback(async (method: Method, path: string, body: string, signal: AbortSignal): Promise<Exchange> => {
    if (!sid.current) sid.current = sessionId()
    const t0 = now()
    const res = await fetch(`/api/demos/lab${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-lab-session': sid.current },
      body: method === 'GET' ? undefined : body,
      signal,
      cache: 'no-store',
    })
    const text = await res.text()
    let wire: LabWire | null = null
    try { wire = JSON.parse(text) as LabWire } catch { /* not ours */ }
    if (!wire || typeof wire !== 'object' || !('_debug' in wire)) throw new Error(`the route answered ${res.status} without a lab trace`)
    return {
      id: ++seq.current, method, path, requestBody: body,
      status: Number(res.headers.get('x-lab-status') ?? res.status),
      headers: SHOWN_HEADERS.flatMap((h) => { const v = res.headers.get(h); return v ? [[h, v] as [string, string]] : [] }),
      body: wire.body, trace: wire._debug.trace, logs: wire._debug.logs, durationMs: wire._debug.durationMs,
      roundTripMs: Math.round(now() - t0), runtime: 'server', coldStart: wire._debug.coldStart, at: new Date().toISOString(),
    }
  }, [])

  const send = useCallback(async (method: Method, path: string, body: string, mode: RunMode): Promise<Exchange | null> => {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setBusy(true)
    setError(null)
    try {
      let ex: Exchange
      if (mode === 'browser') ex = runInBrowser(method, path, body)
      else {
        try {
          ex = await runOnServer(method, path, body, ctrl.signal)
        } catch (e) {
          if (ctrl.signal.aborted) return null
          const reason = e instanceof Error ? e.message : 'network error'
          if (mode === 'server') throw new Error(`The server route could not be reached (${reason}). Switch to "In browser" to run the same code locally.`)
          ex = runInBrowser(method, path, body, reason)
        }
      }
      setHistory((h) => [ex, ...h].slice(0, 12))
      return ex
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The request failed.')
      return null
    } finally {
      if (abort.current === ctrl) setBusy(false)
    }
  }, [runInBrowser, runOnServer])

  const reset = useCallback(async () => {
    browserDb.current = seedDb()
    if (!sid.current) sid.current = sessionId()
    try {
      await fetch('/api/demos/lab/_reset', { method: 'POST', headers: { 'x-lab-session': sid.current } })
    } catch { /* browser copy is reset either way */ }
    setHistory([])
  }, [])

  return { history, busy, error, send, reset, clearError: () => setError(null) }
}
