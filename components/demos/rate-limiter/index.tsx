'use client'
/**
 * Rate limiter: the same request stream hits a token bucket, a sliding window and a fixed window
 * with identical budgets, drawn side by side; below, a real edge endpoint answers 200 or 429
 * with RateLimit headers.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, DemoPanel, DemoToolbar, ErrorState, Segmented } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useInView, usePageVisible, useReducedMotion } from '@/lib/hooks'
import { Lane } from './Lane'
import { LivePanel } from './LivePanel'
import { Range } from './Range'
import { PATTERNS, RateSim, type Pattern } from './sim'

export { notes } from './notes'

type Speed = '1' | '2' | '4'
const PATTERN_OPTIONS = (Object.keys(PATTERNS) as Pattern[]).map((p) => ({ value: p, label: PATTERNS[p].label }))
const SPEEDS = [{ value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '4', label: '4×' }] as const

/** A new sim, pre-stepped by one window so the paused first frame already shows traffic. */
function makeSim(limit: number, windowSec: number, pattern: Pattern): RateSim {
  const sim = new RateSim({ limit, windowMs: windowSec * 1000, pattern })
  if (pattern !== 'manual') sim.step(windowSec * 1000) // manual stays empty until the viewer sends
  return sim
}

export default function Demo(_props: DemoProps) {
  const reduced = useReducedMotion()
  const visible = usePageVisible()
  const [viewRef, inView] = useInView<HTMLDivElement>({ rootMargin: '120px' })
  const [limit, setLimit] = useState(5)
  const [windowSec, setWindowSec] = useState(10)
  const [pattern, setPattern] = useState<Pattern>('bursty')
  const [speed, setSpeed] = useState<Speed>('1')
  const [running, setRunning] = useState(false)
  const [crash, setCrash] = useState<string | null>(null)
  const [, setFrame] = useState(0)
  const [width, setWidth] = useState(600)
  const [announce, setAnnounce] = useState('')
  const stageRef = useRef<HTMLDivElement | null>(null)
  const sim = useRef<RateSim | null>(null)
  // Nothing autoplays: the demo starts paused on a pre-stepped frame until the viewer presses Run.
  if (!sim.current) sim.current = makeSim(limit, windowSec, pattern)

  const rebuild = useCallback((next: { limit: number; windowSec: number; pattern: Pattern }) => {
    sim.current = makeSim(next.limit, next.windowSec, next.pattern)
    setCrash(null)
    setFrame((f) => f + 1)
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => { if (e) setWidth(Math.round(e.contentRect.width)) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!running || !visible || !inView || crash) return
    const factor = Number(speed)
    const tick = (dt: number) => {
      try {
        sim.current?.step(Math.min(dt, 200) * factor)
        setFrame((f) => f + 1)
      } catch (e) {
        setCrash(e instanceof Error ? e.message : 'The simulation stopped unexpectedly.')
      }
    }
    if (reduced) {
      const id = window.setInterval(() => tick(250), 250)
      return () => window.clearInterval(id)
    }
    let raf = 0
    let last = performance.now()
    let acc = 0
    const frame = (now: number) => {
      acc += now - last
      last = now
      if (acc >= 50) { tick(acc); acc = 0 } // ~20 fps is plenty for this strip
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, visible, inView, speed, reduced, crash])

  const s = sim.current
  const windowMs = windowSec * 1000
  const spanMs = Math.min(s.horizon, windowMs * 3)

  const send = (n: number) => {
    s.enqueue(n)
    if (!running) s.step(n * 40 + 1)
    setFrame((f) => f + 1)
    setAnnounce(`${n} request${n > 1 ? 's' : ''} sent to all three limiters.`)
  }

  if (crash) {
    return (
      <ErrorState title="The simulation stopped" action={<Button variant="secondary" icon="refresh" onClick={() => rebuild({ limit, windowSec, pattern })}>Restart</Button>}>
        <p className="m-0">{crash}</p>
      </ErrorState>
    )
  }

  return (
    <div ref={viewRef} className="grid gap-4 min-w-0">
      <p className="sr-only" aria-live="polite">{announce}</p>

      <DemoPanel
        title="Simulation"
        meta={<span className="nums">t = {(s.now / 1000).toFixed(1)}s · budget {limit} per {windowSec}s</span>}
      >
        <div className="grid gap-4 min-w-0">
          <DemoToolbar>
            <Segmented<Pattern> label="Traffic" options={PATTERN_OPTIONS} value={pattern} onChange={(p) => { setPattern(p); rebuild({ limit, windowSec, pattern: p }) }} />
            <Segmented<Speed> label="Speed" options={SPEEDS} value={speed} onChange={setSpeed} />
          </DemoToolbar>
          <p className="m-0 text-0 text-ink-2 measure">{PATTERNS[pattern].hint}</p>
          <DemoToolbar>
            <Range label="Limit" value={limit} min={2} max={12} onChange={(v) => { setLimit(v); rebuild({ limit: v, windowSec, pattern }) }} format={(v) => `${v} req`} />
            <Range label="Window" value={windowSec} min={2} max={20} onChange={(v) => { setWindowSec(v); rebuild({ limit, windowSec: v, pattern }) }} format={(v) => `${v}s`} />
          </DemoToolbar>
          <DemoToolbar>
            <Button variant="primary" icon={running ? 'pause' : 'play'} onClick={() => { setRunning((r) => !r); setAnnounce(running ? 'Paused.' : 'Running.') }}>{running ? 'Pause' : 'Run'}</Button>
            <Button variant="secondary" icon="step" onClick={() => send(1)}>Send 1</Button>
            <Button variant="secondary" icon="plus" onClick={() => send(10)}>Burst 10</Button>
            <Button variant="ghost" icon="refresh" onClick={() => { rebuild({ limit, windowSec, pattern }); setAnnounce('Simulation reset.') }}>Reset</Button>
          </DemoToolbar>

          <div ref={stageRef} className="grid gap-4 min-w-0">
            {s.lanes.map(({ limiter, state }) => (
              <Lane key={state.key} lane={state} now={s.now} spanMs={spanMs} windowMs={windowMs} limit={limit} width={width} remaining={limiter.peek(s.now)} />
            ))}
          </div>
          <ul className="m-0 p-0 list-none flex flex-wrap gap-x-4 gap-y-1 font-mono text-00 text-ink-3" aria-label="Legend">
            <li>line: capacity left</li>
            <li>dot: allowed</li>
            <li><span className="text-danger">×</span>: rejected (429)</li>
            <li>shaded: sliding window</li>
            <li>dashes: fixed-window reset</li>
          </ul>
          {s.now === 0 && pattern === 'manual' ? <p className="m-0 text-0 text-ink-2">Manual traffic: nothing arrives until you press Send 1 or Burst 10.</p> : null}
        </div>
      </DemoPanel>

      <DemoPanel title="Live edge endpoint" meta="GET /api/demos/limited">
        <LivePanel />
      </DemoPanel>
    </div>
  )
}
