'use client'
/**
 * Neural playground: draw points, train a tiny MLP (hand-written backprop + Adam) in the
 * browser and watch the decision boundary or regression curve, the loss and the weights move.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Button, DemoGrid, DemoPanel, DemoToolbar, EmptyState, Segmented, Select, Toggle } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useInView, usePageVisible } from '@/lib/hooks'
import { readTokens, useThemeKey } from '@/lib/theme/client'
import { seeded } from '@/lib/utils'
import { CLASS_PRESETS, makePreset, REG_PRESETS, toXY, withHoldout, type Preset, type Pt } from './datasets'
import { drawPlane, INK_TOKENS, inksFrom, type Inks } from './draw'
import { accuracyOf, createNet, lossOf, paramCount, trainEpoch, type Activation, type Net, type Task } from './mlp'
import { LossChart, NetDiagram, type LossPoint } from './parts'
import { Range } from './Range'
import { useCanvas } from './useCanvas'

export { notes } from './notes'

type Brush = '0' | '1' | 'erase'
type Hidden = '4' | '8' | '8-8' | '16-16'

const TASKS = [{ value: 'classification', label: 'Classify' }, { value: 'regression', label: 'Regress' }] as const
const HIDDEN = [{ value: '4', label: '4' }, { value: '8', label: '8' }, { value: '8-8', label: '8·8' }, { value: '16-16', label: '16·16' }] as const
const ACTS = [{ value: 'tanh', label: 'tanh' }, { value: 'relu', label: 'ReLU' }, { value: 'sigmoid', label: 'sigmoid' }] as const
const LRS = [0.003, 0.01, 0.03, 0.1]
const L2S = [0, 0.0001, 0.001, 0.01]
const MAX_EPOCHS = 20000 // per run, then pause to save battery
const MAX_POINTS = 400

const layersOf = (h: Hidden) => h.split('-').map(Number)

export default function Demo(_props: DemoProps) {
  const visible = usePageVisible()
  const theme = useThemeKey()
  const [wrapRef, inView] = useInView<HTMLDivElement>({ rootMargin: '80px' })
  const [canvasRef, size] = useCanvas()

  const [task, setTask] = useState<Task>('classification')
  const [preset, setPreset] = useState<Preset>('circle')
  const [noise, setNoise] = useState(0.08)
  const [seed, setSeed] = useState(1)
  const [holdout, setHoldout] = useState(false)
  const [pts, setPts] = useState<Pt[]>(() => makePreset('circle', 0.08, 1))
  const [brush, setBrush] = useState<Brush>('1')
  const [hidden, setHidden] = useState<Hidden>('8')
  const [act, setAct] = useState<Activation>('tanh')
  const [lr, setLr] = useState(0.03)
  const [l2, setL2] = useState(0)
  const [training, setTraining] = useState(false)
  const [netSeed, setNetSeed] = useState(3)
  const [tick, setTick] = useState(0) // re-render stats/diagram while training
  const [stopNote, setStopNote] = useState<string | null>(null)

  const net = useRef<Net | null>(null)
  const epoch = useRef(0)
  const stopAt = useRef(MAX_EPOCHS)
  const history = useRef<LossPoint[]>([])
  const ptsRef = useRef(pts)
  const inks = useRef<Inks | null>(null)
  const cursor = useRef<{ x: number; y: number } | null>(null)
  const lastAdd = useRef<{ x: number; y: number } | null>(null)
  const painting = useRef(false)
  const drawRef = useRef<() => void>(() => {})
  ptsRef.current = pts

  // (Re)build the network when its shape changes.
  useEffect(() => {
    net.current = createNet([task === 'classification' ? 2 : 1, ...layersOf(hidden), 1], act, task, seeded(netSeed))
    epoch.current = 0
    history.current = []
    setStopNote(null)
    setTick((t) => t + 1)
  }, [task, hidden, act, netSeed])

  const data = useMemo(() => toXY(pts, task), [pts, task])
  const dataRef = useRef(data)
  dataRef.current = data
  const classes = new Set(pts.filter((p) => !p.test).map((p) => p.label))
  const canTrain = task === 'classification' ? classes.size === 2 : data.X.length >= 2
  const whyNot = task === 'classification' ? 'Add at least one training point of each class.' : 'Add at least two training points.'

  useEffect(() => {
    inks.current = inksFrom(readTokens(INK_TOKENS, canvasRef.current))
    drawRef.current()
  }, [theme, canvasRef])

  drawRef.current = () => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !size.w || !inks.current) return
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0)
    drawPlane(ctx, Math.min(size.w, size.h), epoch.current > 0 ? net.current : null, task, ptsRef.current, inks.current, cursor.current, true)
  }
  useEffect(() => { drawRef.current() }, [size, pts, task, tick])

  const record = useCallback(() => {
    const n = net.current
    if (!n) return
    const d = dataRef.current
    const h = history.current
    h.push({ epoch: epoch.current, train: lossOf(n, d.X, d.Y), test: d.Xt.length ? lossOf(n, d.Xt, d.Yt) : undefined })
    if (h.length > 300) history.current = h.filter((_, i) => i % 2 === 0 || i === h.length - 1)
  }, [])

  const runEpochs = useCallback((budgetMs: number, maxEpochs = Infinity) => {
    const n = net.current
    const d = dataRef.current
    if (!n || !d.X.length) return
    const t0 = performance.now()
    let k = 0
    do {
      trainEpoch(n, d.X, d.Y, lr, l2)
      k++
    } while (performance.now() - t0 < budgetMs && k < maxEpochs)
    epoch.current += k
    record()
  }, [lr, l2, record])

  // Training loop: a few milliseconds of epochs per frame; paused off-screen or in a hidden tab.
  useEffect(() => {
    if (!training || !inView || !visible || !canTrain) return
    let raf = 0
    let frame = 0
    const loop = () => {
      runEpochs(8)
      drawRef.current()
      if (++frame % 4 === 0) setTick((t) => t + 1)
      if (epoch.current >= stopAt.current) {
        setTraining(false)
        setStopNote(`Paused after ${MAX_EPOCHS.toLocaleString()} epochs to save your battery. Press Resume to continue.`)
        setTick((t) => t + 1)
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [training, inView, visible, canTrain, runEpochs])

  const toggleTraining = () => {
    if (!training) stopAt.current = epoch.current + MAX_EPOCHS
    setStopNote(null)
    setTraining((t) => !t)
  }
  const stepOnce = () => { setTraining(false); runEpochs(0, 10); setTick((t) => t + 1) }
  const resetWeights = () => { setTraining(false); setNetSeed((s) => s + 1) }

  /** Load a preset and start from fresh weights. */
  const loadPreset = (p: Preset, s = seed, nz = noise) => {
    setTraining(false)
    setPreset(p)
    setPts(withHoldout(makePreset(p, nz, s), holdout, s + 7))
    setNetSeed((x) => x + 1)
  }

  const chooseTask = (t: Task) => {
    setTraining(false)
    setTask(t)
    const p: Preset = t === 'classification' ? 'circle' : 'sine'
    setPreset(p)
    setPts(withHoldout(makePreset(p, noise, seed), holdout, seed + 7))
    setBrush(t === 'classification' ? '1' : '0')
  }

  // ---- drawing on the plane ----
  const toPlane = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: 1 - ((e.clientY - r.top) / r.height) * 2 }
  }
  const apply = (p: { x: number; y: number }) => {
    if (brush === 'erase') {
      setPts((prev) => prev.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) > 0.07))
      return
    }
    setPts((prev) => (prev.length >= MAX_POINTS ? prev : [...prev, {
      x: Math.max(-1, Math.min(1, p.x)),
      y: Math.max(-1, Math.min(1, p.y)),
      label: task === 'classification' ? Number(brush) : 0,
      test: holdout && Math.random() < 0.2,
    }]))
  }
  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    painting.current = true
    const p = toPlane(e)
    lastAdd.current = p
    apply(p)
  }
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!painting.current) return
    const p = toPlane(e)
    const l = lastAdd.current
    if (!l || Math.hypot(p.x - l.x, p.y - l.y) > (brush === 'erase' ? 0.03 : 0.07)) { lastAdd.current = p; apply(p) }
  }
  const onUp = () => { painting.current = false }

  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const c = cursor.current ?? { x: 0, y: 0 }
    const d = e.shiftKey ? 0.2 : 0.05
    const moves: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }
    if (moves[e.key]) {
      e.preventDefault()
      cursor.current = { x: Math.max(-1, Math.min(1, c.x + moves[e.key][0])), y: Math.max(-1, Math.min(1, c.y + moves[e.key][1])) }
      drawRef.current()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      apply(c)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      setPts((prev) => prev.filter((q) => Math.hypot(q.x - c.x, q.y - c.y) > 0.07))
    }
  }

  const n = net.current
  const d = data
  const last = history.current[history.current.length - 1]
  const trainAcc = n && task === 'classification' && epoch.current ? accuracyOf(n, d.X, d.Y) : null
  const testAcc = n && task === 'classification' && epoch.current && d.Xt.length ? accuracyOf(n, d.Xt, d.Yt) : null
  const brushes = task === 'classification'
    ? [{ value: '0', label: '● Class A' }, { value: '1', label: '■ Class B' }, { value: 'erase', label: 'Erase' }] as const
    : [{ value: '0', label: 'Add point' }, { value: 'erase', label: 'Erase' }] as const

  return (
    <div ref={wrapRef}>
      <DemoGrid
        aside={
          <>
            <DemoPanel title="Data" meta={<span className="nums">{pts.length} points</span>}>
              <div className="grid gap-4">
                <Segmented
                  label="Preset"
                  options={(task === 'classification' ? CLASS_PRESETS : REG_PRESETS) as ReadonlyArray<{ value: Preset; label: string }>}
                  value={preset}
                  onChange={(p) => loadPreset(p)}
                />
                <Range label="Noise" value={noise} min={0} max={0.4} step={0.02} unit="" onChange={(v) => { setNoise(v); loadPreset(preset, seed, v) }} />
                <DemoToolbar>
                  <Button size="sm" variant="secondary" icon="refresh" onClick={() => { const s = seed + 1; setSeed(s); loadPreset(preset, s) }}>New sample</Button>
                  <Button size="sm" variant="ghost" icon="close" onClick={() => { setTraining(false); setPts([]) }}>Clear</Button>
                </DemoToolbar>
                <Toggle
                  label="Hold out 20% as a test set"
                  checked={holdout}
                  onChange={(on) => { setHoldout(on); setPts((prev) => withHoldout(prev, on, seed + 7)) }}
                />
                {holdout ? <p className="m-0 text-00 text-ink-3">Hollow markers are held out: the network never trains on them, so their loss shows over-fitting.</p> : null}
              </div>
            </DemoPanel>

            <DemoPanel title="Network" meta={n ? <span className="nums">{paramCount(n)} params</span> : undefined}>
              <div className="grid gap-4">
                <Segmented label="Hidden layers" options={HIDDEN} value={hidden} onChange={(h) => { setTraining(false); setHidden(h) }} />
                <Segmented label="Activation" options={ACTS} value={act} onChange={(a) => { setTraining(false); setAct(a) }} />
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Learning rate" value={String(lr)} onChange={(e) => setLr(Number(e.target.value))}>
                    {LRS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </Select>
                  <Select label="L2 penalty" value={String(l2)} onChange={(e) => setL2(Number(e.target.value))}>
                    {L2S.map((v) => <option key={v} value={v}>{v || 'none'}</option>)}
                  </Select>
                </div>
                {n ? <NetDiagram net={n} inputs={task === 'classification' ? ['x₁', 'x₂'] : ['x']} /> : null}
              </div>
            </DemoPanel>
          </>
        }
      >
        <DemoPanel
          title={task === 'classification' ? 'Decision boundary' : 'Regression fit'}
          meta={<span className="nums">epoch {epoch.current.toLocaleString()}</span>}
        >
          <div className="grid gap-3">
            <DemoToolbar>
              <Segmented label="Task" options={TASKS} value={task} onChange={chooseTask} />
              <Segmented label="Brush" options={brushes as ReadonlyArray<{ value: Brush; label: string }>} value={brush} onChange={setBrush} />
            </DemoToolbar>
            <div className="relative mx-auto w-full max-w-[520px]">
              <canvas
                ref={canvasRef}
                tabIndex={0}
                role="application"
                aria-label={`Drawing plane, ${pts.length} points. Arrow keys move the cursor, Enter adds a point with the current brush, Delete erases.`}
                className="block w-full aspect-square rounded-1 border border-rule touch-none cursor-crosshair"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                onKeyDown={onKey}
                onFocus={() => { cursor.current ??= { x: 0, y: 0 }; drawRef.current() }}
                onBlur={() => { cursor.current = null; drawRef.current() }}
              />
              {pts.length === 0 ? (
                <div className="absolute inset-0 grid place-items-center p-6 pointer-events-none">
                  <EmptyState title="An empty plane" className="pointer-events-auto">
                    Tap or drag to place points, or pick a preset.
                  </EmptyState>
                </div>
              ) : null}
            </div>
            <p className="m-0 text-00 text-ink-3">
              {task === 'classification'
                ? 'Tap or drag to paint points of the chosen class. Shading shows the predicted class and its confidence; the dark line is where the network is 50/50.'
                : 'Tap or drag to place points. The network learns y from x; the thick line is its prediction.'}
              {' '}Keyboard: focus the plane, arrows move, Enter adds, Delete erases.
            </p>
            <DemoToolbar>
              <Button icon={training ? 'pause' : 'play'} onClick={toggleTraining} disabled={!canTrain}>
                {training ? 'Pause' : epoch.current ? 'Resume training' : 'Train'}
              </Button>
              <Button variant="secondary" icon="step" onClick={stepOnce} disabled={!canTrain}>10 epochs</Button>
              <Button variant="ghost" icon="refresh" onClick={resetWeights}>Reset weights</Button>
            </DemoToolbar>
            {!canTrain ? <p className="m-0 text-0 text-warn" role="status">{whyNot}</p> : null}
            {stopNote ? <p className="m-0 text-0 text-ink-2" role="status">{stopNote}</p> : null}
          </div>
        </DemoPanel>

        <DemoPanel title="Training" meta={task === 'classification' ? 'binary cross-entropy' : 'mean squared error'}>
          <div className="grid gap-3">
            <dl className="grid grid-cols-2 xs:grid-cols-4 gap-3 m-0" aria-live="off">
              <Stat label="Epoch" value={epoch.current.toLocaleString()} />
              <Stat label="Train loss" value={last ? last.train.toFixed(4) : '—'} />
              <Stat label={holdout ? 'Held-out loss' : 'Held-out'} value={last?.test != null ? last.test.toFixed(4) : holdout ? '—' : 'off'} />
              {task === 'classification'
                ? <Stat label="Accuracy" value={trainAcc != null ? `${Math.round(trainAcc * 100)}%${testAcc != null ? ` / ${Math.round(testAcc * 100)}%` : ''}` : '—'} />
                : <Stat label="Points" value={`${d.X.length}${d.Xt.length ? ` + ${d.Xt.length}` : ''}`} />}
            </dl>
            <LossChart history={history.current} hasTest={d.Xt.length > 0} />
          </div>
        </DemoPanel>
      </DemoGrid>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 min-w-0">
      <dt className="mono text-ink-3">{label}</dt>
      <dd className="m-0 display text-2 nums truncate">{value}</dd>
    </div>
  )
}
