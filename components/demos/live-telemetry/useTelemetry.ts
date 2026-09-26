'use client'
/**
 * Connection manager for the telemetry demo. `sse` opens an EventSource on the edge route and
 * lets the browser handle reconnects (it resends Last-Event-ID); `local` runs the same
 * deterministic generator on a timer, for offline use. Samples land in a bounded ring buffer.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { frame, type Frame, type ScenarioId } from './generator'

export type Transport = 'sse' | 'local'
export type Status = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'held' | 'error' | 'local'

export interface Sample extends Frame { rx: number }
export interface RawEvent { key: number; text: string }

export interface TelemetryOptions { scenario: ScenarioId; hz: number; seed: number; transport: Transport; want: boolean; live: boolean }

export const BUFFER_SECONDS = 120
const MAX_ERRORS = 4
const RAW_KEEP = 4

function parseFrame(data: string, devices: number): Frame | null {
  try {
    const f = JSON.parse(data) as Partial<Frame>
    if (typeof f.seq !== 'number' || typeof f.ts !== 'number' || !Array.isArray(f.values) || f.values.length !== devices) return null
    if (!f.values.every((row) => Array.isArray(row) && row.every((v) => typeof v === 'number' && Number.isFinite(v)))) return null
    return f as Frame
  } catch {
    return null
  }
}

export function useTelemetry({ scenario, hz, seed, transport, want, live }: TelemetryOptions, devices: number) {
  const [samples, setSamples] = useState<Sample[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [reconnects, setReconnects] = useState(0)
  const [malformed, setMalformed] = useState(0)
  const [raw, setRaw] = useState<RawEvent[]>([])
  const buf = useRef<Sample[]>([])
  const configKey = `${transport}|${scenario}|${hz}|${seed}`
  const lastKey = useRef(configKey)
  const rawSeq = useRef(0)

  const push = useCallback((f: Frame) => {
    const cap = BUFFER_SECONDS * hz
    const b = buf.current
    const last = b[b.length - 1]
    if (last && f.seq <= last.seq) return // duplicate after a resume
    b.push({ ...f, rx: Date.now() })
    if (b.length > cap) b.splice(0, b.length - cap)
    setSamples(b.slice())
  }, [hz])

  const clear = useCallback(() => {
    buf.current = []
    setSamples([])
    setRaw([])
    setReconnects(0)
    setMalformed(0)
  }, [])

  // A different scenario, rate, seed or transport starts a fresh series.
  useEffect(() => {
    if (lastKey.current !== configKey) {
      lastKey.current = configKey
      clear()
    }
  }, [configKey, clear])

  useEffect(() => {
    if (!want) { setStatus('idle'); return }
    if (!live) { setStatus('held'); return }
    setError(null)
    const nextSeq = () => {
      const last = buf.current[buf.current.length - 1]
      return last ? last.seq + 1 : 0
    }

    if (transport === 'local') {
      setStatus('local')
      let seq = nextSeq()
      const tick = () => push(frame(scenario, seed, seq++, hz, Date.now()))
      tick()
      const id = window.setInterval(tick, Math.round(1000 / hz))
      return () => window.clearInterval(id)
    }

    if (typeof EventSource === 'undefined') {
      setStatus('error')
      setError('This browser has no EventSource support. Use the local simulation instead.')
      return
    }
    setStatus('connecting')
    let errors = 0
    const qs = new URLSearchParams({ scenario, hz: String(hz), seed: String(seed), from: String(nextSeq()) })
    const es = new EventSource(`/api/demos/telemetry?${qs.toString()}`)
    const keepRaw = (type: string, e: MessageEvent<string>) => {
      const text = `${e.lastEventId ? `id: ${e.lastEventId}\n` : ''}event: ${type}\ndata: ${e.data}`
      setRaw((r) => [...r.slice(-(RAW_KEEP - 1)), { key: ++rawSeq.current, text }])
    }
    es.addEventListener('hello', (e: MessageEvent<string>) => {
      errors = 0
      setStatus('open')
      keepRaw('hello', e)
      try {
        if ((JSON.parse(e.data) as { resumed?: boolean }).resumed) setReconnects((n) => n + 1)
      } catch { /* informational only */ }
    })
    es.addEventListener('sample', (e: MessageEvent<string>) => {
      const f = parseFrame(e.data, devices)
      if (!f) { setMalformed((n) => n + 1); return }
      errors = 0
      push(f)
      keepRaw('sample', e)
    })
    es.addEventListener('rotate', (e: MessageEvent<string>) => {
      keepRaw('rotate', e)
      setStatus('reconnecting')
    })
    es.onerror = () => {
      errors++
      if (es.readyState === EventSource.CLOSED) {
        setStatus('error')
        setError('The stream endpoint refused the connection (too many open streams from this network, or it is unavailable in this deployment).')
        return
      }
      if (errors >= MAX_ERRORS) {
        es.close()
        setStatus('error')
        setError(typeof navigator !== 'undefined' && !navigator.onLine
          ? 'You appear to be offline, so the edge stream cannot be reached.'
          : `The stream dropped ${MAX_ERRORS} times in a row without delivering data.`)
        return
      }
      setStatus('reconnecting')
    }
    return () => es.close()
  }, [want, live, transport, scenario, hz, seed, devices, push])

  return { samples, status, error, reconnects, malformed, raw, clear }
}
