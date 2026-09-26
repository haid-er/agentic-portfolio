'use client'
/**
 * System design canvas: place a load balancer, APIs, a cache, a queue, workers and a database,
 * wire them, push load and watch where it breaks. A flow + queueing model (model.ts) runs
 * four times a second in the browser; nothing is deployed.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Badge, Button, DemoPanel, DemoToolbar, ErrorState, Icon, Segmented, Select, useToast } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useInView, useLocalStorage, usePageVisible, useReducedMotion } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { BOARD_H, Canvas, NODE_H, NODE_W } from './Canvas'
import { Inspector } from './Inspector'
import { Range } from './Range'
import { Sparkline } from './Sparkline'
import {
  MAX_NODES, PALETTE, PRESETS, SPEC, canConnect, fmtLag, fmtMs, fmtRate, isDesign, simulate,
  type Cloud, type Design, type Kind, type NodeT, type PresetKey, type SimResult,
} from './model'

export { notes } from './notes'

const TICK_S = 0.25
const HISTORY = 80
const SPIKE_S = 8
const CLOUDS = [{ value: 'generic', label: 'Generic' }, { value: 'aws', label: 'AWS' }, { value: 'azure', label: 'Azure' }] as const
const PRESET_OPTIONS = (Object.keys(PRESETS) as PresetKey[]).map((k) => ({ value: k, label: PRESETS[k].label }))
const COLUMN_X: Record<Kind, number> = { client: 20, lb: 190, api: 360, cache: 560, queue: 560, worker: 760, db: 760 }

/** Load slider is logarithmic: 0..100 maps to 50..20 000 req/s. */
const toRps = (v: number) => Math.round(50 * Math.pow(400, v / 100) / 10) * 10
const fromRps = (rps: number) => (Math.log(rps / 50) / Math.log(400)) * 100

export default function Demo(_props: DemoProps) {
  const reduced = useReducedMotion()
  const visible = usePageVisible()
  const toast = useToast()
  const [viewRef, inView] = useInView<HTMLDivElement>({ rootMargin: '120px' })
  const [stored, setStored] = useLocalStorage<unknown>('system-design-canvas:design', PRESETS.monolith.design)
  const [cloud, setCloud] = useLocalStorage<Cloud>('system-design-canvas:cloud', 'aws')
  const [rps, setRps] = useState(1200)
  const [readPct, setReadPct] = useState(80)
  const [running, setRunning] = useState(true)
  const [spikeLeft, setSpikeLeft] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [sim, setSim] = useState<SimResult | null>(null)
  const [series, setSeries] = useState<{ lat: number[]; err: number[] }>({ lat: [], err: [] })
  const [announce, setAnnounce] = useState('')
  const [crash, setCrash] = useState<string | null>(null)
  const backlog = useRef<Record<string, number>>({})
  const lastBottleneck = useRef<string | null>(null)

  const valid = isDesign(stored)
  const design: Design = valid ? stored : PRESETS.monolith.design
  const setDesign = useCallback((fn: (d: Design) => Design) => {
    setStored((prev: unknown) => fn(isDesign(prev) ? prev : PRESETS.monolith.design))
  }, [setStored])

  const offered = spikeLeft > 0 ? rps * 3 : rps
  const load = useMemo(() => ({ rps: offered, readRatio: readPct / 100 }), [offered, readPct])

  const tick = useCallback((dt: number) => {
    try {
      const r = simulate(design, load, backlog.current, dt)
      backlog.current = r.backlog
      setSim(r)
      if (dt > 0) {
        setSeries((s) => ({
          lat: [...s.lat, r.latency].slice(-HISTORY),
          err: [...s.err, r.errorRate].slice(-HISTORY),
        }))
      }
      if (r.bottleneck !== lastBottleneck.current) {
        lastBottleneck.current = r.bottleneck
        const n = design.nodes.find((x) => x.id === r.bottleneck)
        setAnnounce(n ? `Bottleneck: ${SPEC[n.kind].label}.` : 'No bottleneck.')
      }
    } catch (e) {
      setCrash(e instanceof Error ? e.message : 'The simulation stopped unexpectedly.')
    }
  }, [design, load])

  // Recompute right away whenever the design or load changes (also while paused).
  useEffect(() => { tick(0) }, [tick])

  // The clock: 4 ticks a second, paused when hidden, off-screen or stopped.
  useEffect(() => {
    if (!running || !visible || !inView || crash || !valid) return
    const id = window.setInterval(() => {
      tick(TICK_S)
      setSpikeLeft((s) => Math.max(0, s - TICK_S))
    }, TICK_S * 1000)
    return () => window.clearInterval(id)
  }, [running, visible, inView, crash, valid, tick])

  // ---- editing ----------------------------------------------------------------------------
  const addNode = (kind: Kind) => {
    if (design.nodes.length >= MAX_NODES) { toast(`The board holds ${MAX_NODES} components.`, { tone: 'warn' }); return }
    let n = 1
    while (design.nodes.some((x) => x.id === `${kind}-${n}`)) n++
    const id = `${kind}-${n}`
    const x = COLUMN_X[kind]
    const ys = [40, 150, 260, 370, 450]
    const y = ys.find((cy) => !design.nodes.some((o) => Math.abs(o.x - x) < NODE_W && Math.abs(o.y - cy) < NODE_H + 8)) ?? BOARD_H / 2 - NODE_H / 2
    const node: NodeT = { id, kind, x, y, replicas: 1, ...(kind === 'cache' ? { hitRate: 0.85 } : {}) }
    setDesign((d) => ({ ...d, nodes: [...d.nodes, node] }))
    setSelected(id)
    setAnnounce(`${SPEC[kind].label} added. Connect it to start routing traffic.`)
  }
  const moveNode = useCallback((id: string, x: number, y: number) => {
    setDesign((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, x: Math.round(x), y: Math.round(y) } : n)) }))
  }, [setDesign])
  const patchNode = (id: string, patch: Partial<NodeT>) => {
    setDesign((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }))
  }
  const deleteNode = (id: string) => {
    const n = design.nodes.find((x) => x.id === id)
    if (!n || n.kind === 'client') return
    setDesign((d) => ({ nodes: d.nodes.filter((x) => x.id !== id), edges: d.edges.filter((e) => e.from !== id && e.to !== id) }))
    delete backlog.current[id]
    setSelected(null)
    setConnectFrom(null)
    setAnnounce(`${SPEC[n.kind].label} removed.`)
  }
  const connect = (from: string, to: string) => {
    const why = canConnect(design, from, to)
    if (why) { toast(why, { tone: 'warn' }); setAnnounce(why); return false }
    setDesign((d) => ({ ...d, edges: [...d.edges, { from, to }] }))
    const a = design.nodes.find((n) => n.id === from)
    const b = design.nodes.find((n) => n.id === to)
    if (a && b) setAnnounce(`Connected ${SPEC[a.kind].label} to ${SPEC[b.kind].label}.`)
    return true
  }
  const disconnect = (from: string, to: string) => {
    setDesign((d) => ({ ...d, edges: d.edges.filter((e) => !(e.from === from && e.to === to)) }))
    setAnnounce('Connection removed.')
  }
  const activate = (id: string | null) => {
    if (connectFrom && id && id !== connectFrom) {
      if (connect(connectFrom, id)) { setConnectFrom(null); setSelected(id) }
      return
    }
    setConnectFrom(null)
    setSelected(id)
  }
  const loadPreset = (k: PresetKey) => {
    setStored(PRESETS[k].design)
    backlog.current = {}
    setSeries({ lat: [], err: [] })
    setSelected(null)
    setConnectFrom(null)
    setCrash(null)
    setAnnounce(`Loaded the ${PRESETS[k].label} design.`)
  }

  const selNode = design.nodes.find((n) => n.id === selected) ?? null
  const bn = sim?.bottleneck ? design.nodes.find((n) => n.id === sim.bottleneck) : undefined
  const hasQueue = design.nodes.some((n) => n.kind === 'queue')
  const errPct = (sim?.errorRate ?? 0) * 100

  if (!valid && stored !== null) {
    return (
      <ErrorState title="The saved design could not be read" action={<Button size="sm" variant="secondary" icon="refresh" onClick={() => loadPreset('monolith')}>Start from a fresh design</Button>}>
        Something in this browser&apos;s saved board is not a valid design, so nothing was loaded.
      </ErrorState>
    )
  }

  return (
    <div ref={viewRef} className="grid gap-4">
      <p className="sr-only" aria-live="polite">{announce}</p>

      <DemoPanel title="Load" meta={spikeLeft > 0 ? <Badge tone="warn">spike ×3 · {Math.ceil(spikeLeft)} s</Badge> : running ? 'live' : 'paused'}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <Range
            label="Requests per second"
            min={0}
            max={100}
            step={0.5}
            value={fromRps(rps)}
            display={`${fmtRate(rps)} req/s`}
            onChange={(v) => setRps(toRps(v))}
          />
          <Range
            label="Reads vs writes"
            min={0}
            max={100}
            step={5}
            value={readPct}
            display={`${readPct}% reads`}
            onChange={setReadPct}
          />
          <DemoToolbar>
            <Button variant="secondary" icon={running ? 'pause' : 'play'} onClick={() => setRunning((r) => !r)}>
              {running ? 'Pause' : 'Run'}
            </Button>
            <Button variant="secondary" icon="pulse" disabled={spikeLeft > 0} onClick={() => { setSpikeLeft(SPIKE_S); setAnnounce('Traffic spike: three times the load for eight seconds.') }}>
              Spike
            </Button>
          </DemoToolbar>
        </div>
      </DemoPanel>

      <dl className="m-0 grid grid-cols-2 md:grid-cols-4 gap-3" aria-live="off">
        <Metric label="Served OK" value={`${fmtRate(sim?.ok ?? 0)}/s`} sub={`of ${fmtRate(sim?.offered ?? offered)}/s offered`} />
        <Metric
          label="Errors"
          value={`${errPct < 10 && errPct > 0 ? errPct.toFixed(1) : Math.round(errPct)}%`}
          tone={errPct >= 1 ? 'danger' : undefined}
          spark={<Sparkline values={series.err} max={0.05} label="Error rate over the last 20 seconds" stroke="var(--danger)" />}
        />
        <Metric
          label="Mean latency"
          value={sim && sim.ok > 0 ? fmtMs(sim.latency) : '—'}
          tone={(sim?.latency ?? 0) > 300 ? 'danger' : (sim?.latency ?? 0) > 100 ? 'warn' : undefined}
          spark={<Sparkline values={series.lat} max={100} label="Mean latency over the last 20 seconds" stroke="var(--data-1)" />}
        />
        <Metric
          label="Async lag"
          value={hasQueue ? (sim && sim.asyncLag > 0 ? fmtLag(sim.asyncLag) : 'none') : '—'}
          sub={hasQueue ? 'time a write waits in the queue' : 'no queue in this design'}
          tone={sim && sim.asyncLag > 30 ? 'warn' : undefined}
        />
      </dl>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <DemoPanel
          title="Board"
          meta={connectFrom ? <Badge tone="accent">connecting</Badge> : `${design.nodes.length}/${MAX_NODES}`}
          bodyClassName="p-0"
        >
          <div className="flex flex-wrap items-end gap-2 px-4 py-3 border-b border-rule-soft">
            <span className="mono text-ink-2 w-full">Add a component</span>
            {PALETTE.map((k) => (
              <Button key={k} size="sm" variant="secondary" icon="plus" onClick={() => addNode(k)} disabled={design.nodes.length >= MAX_NODES}>
                {SPEC[k].short}
              </Button>
            ))}
          </div>
          <div className="overflow-x-auto" role="region" aria-label="Board, scrolls sideways on small screens" tabIndex={-1}>
            <div className="min-w-[640px]">
              <Canvas
                design={design}
                sim={sim}
                selected={selected}
                connectFrom={connectFrom}
                cloud={cloud}
                animate={running && !reduced && visible}
                onActivate={activate}
                onMove={moveNode}
                onDelete={deleteNode}
                onCancel={() => setConnectFrom(null)}
              />
            </div>
          </div>
          <div className="grid gap-3 px-4 py-3 border-t border-rule-soft">
            <div className="flex flex-wrap items-end gap-4">
              <Select label="Start from" value="" onChange={(e) => { if (e.target.value) loadPreset(e.target.value as PresetKey) }} wrapperClassName="min-w-[12rem]">
                <option value="">Choose a design…</option>
                {PRESET_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
              <Segmented label="Names" options={CLOUDS} value={cloud} onChange={setCloud} />
            </div>
            <p className="m-0 text-00 text-ink-3">
              Drag to move. Select a component, then Connect on the board and tap a highlighted target. Keyboard: Tab to a component, arrows move it, Enter selects, Delete removes.
            </p>
          </div>
        </DemoPanel>

        <div className="grid gap-4 min-w-0">
          <DemoPanel title="Diagnosis" meta={bn ? <Badge tone="danger">{SPEC[bn.kind].short} bottleneck</Badge> : <Badge tone="ok">no bottleneck</Badge>}>
            {crash ? (
              <ErrorState title="The simulation stopped" action={<Button size="sm" variant="secondary" icon="refresh" onClick={() => loadPreset('monolith')}>Reset the board</Button>}>
                {crash}
              </ErrorState>
            ) : sim && sim.hints.length ? (
              <ol className="m-0 p-0 list-none grid gap-2">
                {sim.hints.map((h, i) => (
                  <li key={h} className={cx('flex gap-2 text-0', i === 0 && bn ? 'text-ink' : 'text-ink-2')}>
                    <Icon name={i === 0 && bn ? 'alert' : 'info'} size={16} className={cx('mt-[3px]', i === 0 && bn ? 'text-danger' : 'text-ink-3')} />
                    <span>{h}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="m-0 text-0 text-ink-2">Every component is under 70% busy at this load. Push the slider or hit Spike to find the next limit.</p>
            )}
          </DemoPanel>
          <DemoPanel title="Inspector" meta={selNode ? selNode.id : undefined}>
            <Inspector
              key={selNode?.id ?? 'none'}
              design={design}
              node={selNode}
              sim={sim}
              cloud={cloud}
              connecting={connectFrom !== null}
              onPatch={patchNode}
              onConnect={connect}
              onDisconnect={disconnect}
              onStartConnect={(id) => { setConnectFrom((c) => (c ? null : id)); setAnnounce('Choose a highlighted component to connect to. Escape cancels.') }}
              onDelete={deleteNode}
            />
          </DemoPanel>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, sub, tone, spark }: { label: string; value: string; sub?: string; tone?: 'danger' | 'warn'; spark?: ReactNode }) {
  return (
    <div className="grid gap-1 content-start p-3 bg-surface border border-rule strata:border-rule-soft rounded-2 min-w-0">
      <dt className="mono text-ink-3">{label}</dt>
      <dd className={cx('m-0 display text-3 nums leading-none', tone === 'danger' && 'text-danger', tone === 'warn' && 'text-warn')}>{value}</dd>
      {sub ? <dd className="m-0 text-00 text-ink-3">{sub}</dd> : null}
      {spark ? <dd className="m-0">{spark}</dd> : null}
    </div>
  )
}
