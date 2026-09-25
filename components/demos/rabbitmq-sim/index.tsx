'use client'
/**
 * RabbitMQ broker sim: sensor producers publish to one exchange (direct / topic / fanout),
 * bindings route copies into queues, competing consumers get messages up to their prefetch and
 * ack or nack them, and failures, overflow and crashes end up in a dead-letter queue.
 * Everything runs in the browser on a deterministic model (engine.ts).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, Button, DemoGrid, DemoPanel, DemoToolbar, ErrorState, Segmented } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useInView, usePageVisible, useReducedMotion } from '@/lib/hooks'
import { Diagram } from './Diagram'
import { Broker, SCENARIOS, type ExchangeType, type ScenarioKey, type Snapshot } from './engine'
import { layoutFor, type Orientation } from './layout'
import { BindingsPanel, ConsumerPanel, DlqPanel, JavaPanel, LogPanel, QueueTable, StatsRow } from './panels'

export { notes } from './notes'

type Speed = '0.5' | '1' | '2'
const SPEEDS = [{ value: '0.5', label: '½×' }, { value: '1', label: '1×' }, { value: '2', label: '2×' }] as const
const SCENARIO_OPTIONS = (Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => ({ value: k, label: SCENARIOS[k].label }))

export default function Demo(_props: DemoProps) {
  const reduced = useReducedMotion()
  const visible = usePageVisible()
  const [viewRef, inView] = useInView<HTMLDivElement>({ rootMargin: '120px' })
  const broker = useRef<Broker | null>(null)
  if (!broker.current) {
    broker.current = new Broker()
    broker.current.apply(SCENARIOS.steady.config)
  }
  const [snap, setSnap] = useState<Snapshot>(() => (broker.current as Broker).snapshot())
  const [running, setRunning] = useState(!reduced)
  const [speed, setSpeed] = useState<Speed>('1')
  const [scenario, setScenario] = useState<ScenarioKey>('steady')
  const [selected, setSelected] = useState('c-a')
  const [crash, setCrash] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  const [orientation, setOrientation] = useState<Orientation>('tall')
  const stageRef = useRef<HTMLDivElement | null>(null)

  const b = broker.current

  const refresh = useCallback(() => setSnap((broker.current as Broker).snapshot()), [])

  /** Runs a mutation on the broker and re-renders; errors become the demo's error state. */
  const act = useCallback((fn: (br: Broker) => void, say?: string) => {
    try {
      fn(broker.current as Broker)
      refresh()
      if (say) setAnnounce(say)
    } catch (e) {
      setCrash(e instanceof Error ? e.message : 'The simulation stopped unexpectedly.')
    }
  }, [refresh])

  useEffect(() => { b.animate = !reduced }, [b, reduced])

  // Stage width decides the orientation of the diagram.
  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setOrientation(entry.contentRect.width >= 620 ? 'wide' : 'tall')
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Simulation loop: rAF when animating, a calm 4 Hz tick under reduced motion.
  // It stops when paused, when the tab is hidden, or when the demo is scrolled away.
  useEffect(() => {
    if (!running || !visible || !inView || crash) return
    const factor = Number(speed)
    let lastPaint = 0
    const tick = (dt: number, now = 0) => {
      try {
        const br = broker.current as Broker
        br.step(Math.min(dt, 120) * factor)
        // Paint at ~30 fps: smooth enough for the dots, half the React work of 60 fps.
        if (now - lastPaint < 30) return
        lastPaint = now
        setSnap(br.snapshot())
      } catch (e) {
        setCrash(e instanceof Error ? e.message : 'The simulation stopped unexpectedly.')
      }
    }
    if (reduced) {
      const id = window.setInterval(() => tick(250, performance.now()), 250)
      return () => window.clearInterval(id)
    }
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      tick(now - last, now)
      last = now
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, visible, inView, speed, reduced, crash])

  const applyScenario = (k: ScenarioKey) => {
    setScenario(k)
    act((br) => br.apply(SCENARIOS[k].config), `${SCENARIOS[k].label} scenario loaded.`)
  }

  const reset = () => {
    broker.current = new Broker()
    broker.current.animate = !reduced
    broker.current.apply(SCENARIOS[scenario].config)
    setCrash(null)
    refresh()
    setAnnounce('Broker reset.')
  }

  if (crash) {
    return (
      <ErrorState title="The broker simulation stopped" action={<Button variant="secondary" icon="refresh" onClick={reset}>Reset broker</Button>}>
        <p className="m-0">{crash}</p>
        <p className="m-0">No messages were sent anywhere; this runs entirely in your browser.</p>
      </ErrorState>
    )
  }

  const layout = layoutFor(orientation)
  const sel = snap.consumers.find((c) => c.id === selected) ?? snap.consumers[0]
  const selQueue = snap.queues.find((q) => q.id === sel?.queueId)

  return (
    <div ref={viewRef} className="grid gap-4 min-w-0">
      <p className="sr-only" aria-live="polite">{announce}</p>

      <DemoToolbar>
        <Segmented label="Scenario" options={SCENARIO_OPTIONS} value={scenario} onChange={applyScenario} />
        <Segmented label="Speed" options={SPEEDS} value={speed} onChange={setSpeed} />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            icon={running ? 'pause' : 'play'}
            onClick={() => { setRunning((r) => !r); setAnnounce(running ? 'Paused.' : 'Running.') }}
          >
            {running ? 'Pause' : 'Run'}
          </Button>
          <Button variant="secondary" icon="step" disabled={running} onClick={() => act((br) => br.step(250))} aria-label="Advance 250 milliseconds">Step</Button>
        </div>
      </DemoToolbar>
      <p className="m-0 text-0 text-ink-2 measure">{SCENARIOS[scenario].hint}</p>

      <DemoGrid
        aside={
          <>
            <BindingsPanel
              snap={snap}
              onExchange={(t: ExchangeType) => act((br) => br.setExchange(t), `${t} exchange; bindings reset.`)}
              onBinding={(id, key) => act((br) => br.setBinding(id, key))}
              onRate={(r) => act((br) => { br.rate = r })}
              onDlx={(v) => act((br) => { br.dlx = v }, v ? 'Dead-letter exchange on.' : 'Dead-letter exchange off: failures are discarded.')}
              onMaxLength={(n) => act((br) => br.setMaxLength(n))}
              onToggleProducer={(id) => act((br) => br.toggleProducer(id))}
            />
            {sel ? (
              <ConsumerPanel
                snap={snap}
                selected={sel}
                onSelect={setSelected}
                onPatch={(patch) => act((br) => br.patchConsumer(sel.id, patch))}
                onKill={() => act((br) => {
                  const n = br.kill(sel.id)
                  setAnnounce(sel.autoAck ? `${sel.label} killed. ${n} auto-acked messages lost.` : `${sel.label} killed. ${n} unacked messages requeued.`)
                })}
                onRevive={() => act((br) => br.revive(sel.id), `${sel.label} reconnected.`)}
              />
            ) : null}
          </>
        }
      >
        <DemoPanel
          title="Broker"
          meta={<span className="nums">t = {(snap.now / 1000).toFixed(1)}s · {snap.transits.length} in flight</span>}
        >
          <div ref={stageRef} className="min-w-0">
            <Diagram snap={snap} layout={layout} />
          </div>
          <Legend />
          <DemoToolbar className="mt-3">
            <Button variant="secondary" size="sm" icon="plus" onClick={() => act((br) => br.burst(20), '20 messages published.')}>Burst 20</Button>
            <Button variant="danger" size="sm" icon="alert" onClick={() => act((br) => br.publishPoison(), 'Poison message published.')}>Publish poison</Button>
            {!running ? <Badge tone="warn">paused</Badge> : null}
          </DemoToolbar>
        </DemoPanel>
        <StatsRow snap={snap} />
      </DemoGrid>

      <div className="grid gap-4 lg:grid-cols-2 min-w-0">
        <QueueTable snap={snap} />
        <DlqPanel
          snap={snap}
          onPurge={() => act((br) => br.purgeDlq(), 'Dead-letter queue purged.')}
          onReplay={() => act((br) => br.replayDlq(), 'Dead letters replayed through the exchange.')}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 min-w-0">
        {sel && selQueue ? <JavaPanel consumer={sel} queue={selQueue} snap={snap} /> : null}
        <LogPanel snap={snap} />
      </div>
    </div>
  )
}

function Legend() {
  return (
    <ul className="m-0 mt-3 p-0 list-none flex flex-wrap gap-x-4 gap-y-1 text-00 font-mono text-ink-2" aria-label="Legend">
      <li className="flex items-center gap-2"><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" className="fill-data-1" /></svg>message (ink = producer)</li>
      <li className="flex items-center gap-2"><svg width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="4" className="fill-data-3" /><circle cx="8" cy="8" r="7" fill="none" className="stroke-ink" /></svg>redelivered</li>
      <li className="flex items-center gap-2"><svg width="12" height="12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" className="fill-danger" /></svg>poison</li>
      <li className="flex items-center gap-2"><svg width="30" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" className="fill-accent" /><circle cx="17" cy="5" r="4" className="fill-surface stroke-rule" /></svg>prefetch slots (filled = unacked)</li>
    </ul>
  )
}

