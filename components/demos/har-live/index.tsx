'use client'
/**
 * HAR live: phone accelerometer (or a synthetic desktop replay) -> 25 Hz strip chart ->
 * 5 s windows -> orientation-invariant channels -> two in-browser classifiers:
 * an instant feature baseline and an optional CNN-LSTM trained with TensorFlow.js.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, Button, DemoGrid, DemoPanel, DemoToolbar, EmptyState, ErrorState, Loading, Segmented } from '@/components/ui'
import { useInView, usePageVisible, useReducedMotion } from '@/lib/hooks'
import type { DemoProps } from '@/lib/demos/types'
import { readTokens, useThemeKey } from '@/lib/theme/client'
import { trainBaseline, type Baseline } from './baseline'
import { LAYERS_SUMMARY, trainCnnLstm, type CnnLstm, type EpochLog } from './cnnLstm'
import { AXIS_DASH, drawStrip, INK_TOKENS, inksFrom, VIEW_S, type Inks } from './draw'
import { argmax, LossSpark, pct, pick, ProbBars, WindowTape, type WindowResult } from './parts'
import { ACTIVITIES, ACTIVITY_HINT, ACTIVITY_LABEL, HZ, sampleSession, toChannels, trainingSet, WIN, type Activity, type Session } from './signal'
import { motionSupport, SampleBuffer, startMotion, type SensorStatus } from './stream'
import { useCanvas } from './useCanvas'

export { notes } from './notes'

type Source = 'replay' | 'sensor'
type Model = 'baseline' | 'cnn'
type TrainState = 'idle' | 'loading' | 'training' | 'ready' | 'error'

const EPOCHS = 12
const SOURCES = [{ value: 'replay', label: 'Sample replay' }, { value: 'sensor', label: 'My phone' }] as const
const SPEEDS = [{ value: '1', label: '1×' }, { value: '3', label: '3×' }] as const

const SENSOR_COPY: Record<SensorStatus, string> = {
  idle: 'Tap “Allow motion access” to stream this device’s accelerometer. Nothing leaves your browser.',
  requesting: 'Waiting for your permission…',
  waiting: 'Listening for motion events…',
  live: 'Live: 25 Hz accelerometer including gravity.',
  denied: 'Motion access was declined. On iPhone, reload the page and allow Motion & Orientation when asked.',
  unsupported: 'This browser has no motion sensors (usual on desktop).',
  insecure: 'Motion sensors need a secure (https) page.',
  'no-data': 'No motion events arrived. This is normal on laptops and desktops.',
}

function accuracy(model: Baseline | CnnLstm, test: { x: Float32Array[]; y: number[] }) {
  let hit = 0
  test.x.forEach((x, i) => { if (argmax(model.predict(x)) === test.y[i]) hit++ })
  return hit / Math.max(1, test.x.length)
}

export default function Demo(_props: DemoProps) {
  const reduced = useReducedMotion()
  const visible = usePageVisible()
  const theme = useThemeKey()
  const [wrapRef, inView] = useInView<HTMLDivElement>({ rootMargin: '80px' })
  const [canvasRef, size] = useCanvas()

  const [source, setSource] = useState<Source>('replay')
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<'1' | '3'>('1')
  const [sensor, setSensor] = useState<SensorStatus>('idle')
  const [results, setResults] = useState<WindowResult[]>([])
  const [model, setModel] = useState<Model>('baseline')
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [baseAcc, setBaseAcc] = useState<number | null>(null)
  const [train, setTrain] = useState<TrainState>('idle')
  const [trainLog, setTrainLog] = useState<EpochLog[]>([])
  const [trainError, setTrainError] = useState<string | null>(null)
  const [cnnInfo, setCnnInfo] = useState<{ params: number; backend: string; acc: number } | null>(null)

  const buf = useRef(new SampleBuffer(60))
  const baseline = useRef<Baseline | null>(null)
  const cnn = useRef<CnnLstm | null>(null)
  const session = useRef<Session | null>(null)
  const testSet = useRef<{ x: Float32Array[]; y: number[] } | null>(null)
  const replay = useRef({ pos: 0, acc: 0, last: 0 })
  const labels = useRef(new Map<number, string>())
  const modelRef = useRef<Model>('baseline')
  const sourceRef = useRef<Source>('replay')
  const inks = useRef<Inks | null>(null)
  const stopSensor = useRef<(() => void) | null>(null)
  const abortTrain = useRef<AbortController | null>(null)
  const drawRef = useRef<() => void>(() => {})

  modelRef.current = model
  sourceRef.current = source

  /** Relabel the chart's windows with the chosen model. */
  const relabel = useCallback((list: WindowResult[], m: Model) => {
    labels.current = new Map(list.map((r) => {
      const p = pick(r, m)
      const k = argmax(p)
      return [r.start, `W${r.n} · ${ACTIVITY_LABEL[ACTIVITIES[k] as Activity]} ${pct(p[k])}`]
    }))
  }, [])

  const classify = useCallback((start: number) => {
    const b = baseline.current
    if (!b) return
    const ch = toChannels(buf.current.slice(start, WIN))
    const r: WindowResult = {
      n: start / WIN + 1,
      start,
      truth: sourceRef.current === 'replay' ? buf.current.majority(start, WIN) : -1,
      baseline: b.predict(ch),
      cnn: cnn.current?.predict(ch),
    }
    setResults((prev) => {
      const next = [...prev, r].slice(-40)
      relabel(next, modelRef.current)
      return next
    })
  }, [relabel])

  const push = useCallback((x: number, y: number, z: number, truth = -1) => {
    const B = buf.current
    B.push(x, y, z, truth)
    if (B.count % WIN === 0) classify(B.count - WIN)
  }, [classify])

  const pushReplay = useCallback((n: number) => {
    const s = session.current
    if (!s) return
    const R = replay.current
    for (let i = 0; i < n; i++) {
      const p = R.pos
      push(s.xyz[p * 3], s.xyz[p * 3 + 1], s.xyz[p * 3 + 2], s.truth[p])
      R.pos = (p + 1) % s.n
    }
  }, [push])

  const resetStream = useCallback((prefill: boolean) => {
    buf.current.reset()
    replay.current = { pos: 0, acc: 0, last: 0 }
    labels.current = new Map()
    setResults([])
    if (prefill) pushReplay(VIEW_S * HZ) // a full still frame: two classified windows
  }, [pushReplay])

  // 1. Build the synthetic replay and train the instant baseline (tens of milliseconds).
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const data = trainingSet(60, 7)
        testSet.current = trainingSet(25, 99)
        baseline.current = trainBaseline(data.x, data.y)
        setBaseAcc(accuracy(baseline.current, testSet.current))
        session.current = sampleSession()
        resetStream(true)
        setReady(true)
      } catch (e) {
        setInitError(e instanceof Error ? e.message : 'Unknown error')
      }
    }, 30) // let the loading state paint first
    return () => window.clearTimeout(id)
  }, [resetStream])

  // Autoplay the replay unless the reader asked for reduced motion (still frame + Play).
  useEffect(() => { if (ready && !reduced) setPlaying(true) }, [ready, reduced])

  // Theme inks for the canvas.
  useEffect(() => {
    inks.current = inksFrom(readTokens(INK_TOKENS, canvasRef.current))
    drawRef.current()
  }, [theme, canvasRef])

  drawRef.current = () => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !size.w || !inks.current) return
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0)
    const frac = source === 'replay' && playing ? Math.min(0.99, replay.current.acc) : 0
    drawStrip(ctx, size.w, size.h, buf.current, inks.current, labels.current, frac)
  }

  // Redraw on resize or when results change while paused.
  useEffect(() => { drawRef.current() }, [size, results, ready])

  // 2. The frame loop: advance the replay clock and draw. Paused off-screen or in a hidden tab.
  const running = ready && inView && visible && (source === 'sensor' ? sensor === 'live' : playing)
  useEffect(() => {
    if (!running) return
    let raf = 0
    replay.current.last = 0
    const frame = (ts: number) => {
      if (sourceRef.current === 'replay') {
        const R = replay.current
        const dt = R.last ? Math.min(100, ts - R.last) : 0
        R.last = ts
        R.acc += (dt / 1000) * HZ * Number(speed)
        const n = Math.floor(R.acc)
        R.acc -= n
        if (n) pushReplay(n)
      }
      drawRef.current()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, speed, pushReplay])

  useEffect(() => () => { stopSensor.current?.(); abortTrain.current?.abort(); cnn.current?.dispose() }, [])

  const chooseSource = (s: Source) => {
    if (s === source) return
    stopSensor.current?.()
    stopSensor.current = null
    setSource(s)
    sourceRef.current = s
    const support = motionSupport()
    setSensor(s === 'sensor' && support !== 'ok' ? support : 'idle')
    resetStream(s === 'replay')
    if (s === 'replay' && !reduced) setPlaying(true)
  }

  // Called straight from the click: iOS needs the permission request inside the gesture.
  const allowMotion = () => {
    stopSensor.current?.()
    resetStream(false)
    stopSensor.current = startMotion((x, y, z) => push(x, y, z), setSensor)
  }

  const chooseModel = (m: Model) => {
    setModel(m)
    modelRef.current = m
    setResults((prev) => { relabel(prev, m); return prev })
    drawRef.current()
  }

  const trainCnn = async () => {
    abortTrain.current?.abort()
    const ctrl = new AbortController()
    abortTrain.current = ctrl
    setTrain('loading')
    setTrainLog([])
    setTrainError(null)
    try {
      const data = trainingSet(40, 11)
      const m = await trainCnnLstm(data, {
        epochs: EPOCHS,
        signal: ctrl.signal,
        onEpoch: (l) => { setTrain('training'); setTrainLog((prev) => [...prev, l]) },
      })
      cnn.current?.dispose()
      cnn.current = m
      setCnnInfo({ params: m.params, backend: m.backend, acc: testSet.current ? accuracy(m, testSet.current) : m.valAcc })
      setTrain('ready')
      chooseModel('cnn')
    } catch (e) {
      if (ctrl.signal.aborted) { setTrain(cnn.current ? 'ready' : 'idle'); return }
      setTrain('error')
      setTrainError(e instanceof Error ? e.message : 'TensorFlow.js failed to start.')
    }
  }

  if (initError) {
    return <ErrorState title="The classifier could not start">{initError}. Nothing is estimated.</ErrorState>
  }

  const latest = results.at(-1)
  const graded = results.filter((r) => r.truth >= 0 && (model === 'baseline' || r.cnn))
  const agree = graded.filter((r) => argmax(pick(r, model)) === r.truth).length
  const lastLog = trainLog.at(-1)
  const sensorBad = source === 'sensor' && ['denied', 'unsupported', 'insecure', 'no-data'].includes(sensor)

  return (
    <div ref={wrapRef}>
      <DemoGrid
        aside={
          <>
            <DemoPanel title="Classifier" meta={model === 'cnn' ? 'CNN-LSTM' : 'feature baseline'}>
              <div className="grid gap-3">
                <Segmented
                  label="Model"
                  options={[{ value: 'baseline', label: 'Baseline' }, ...(cnnInfo ? [{ value: 'cnn', label: 'CNN-LSTM' }] : [])] as Array<{ value: Model; label: string }>}
                  value={model}
                  onChange={chooseModel}
                />
                <p className="m-0 text-0 text-ink-2">
                  Baseline: 10 window features into softmax regression, trained on synthetic windows when the page opened.
                  {baseAcc != null ? <> Held-out synthetic accuracy <span className="nums font-semibold">{pct(baseAcc)}</span>.</> : null}
                </p>
                {train === 'idle' || train === 'error' ? (
                  <Button variant="secondary" icon="step" onClick={trainCnn} disabled={!ready}>Train a CNN-LSTM here</Button>
                ) : null}
                {train === 'loading' ? <Loading label="Loading TensorFlow.js" /> : null}
                {train === 'training' ? (
                  <div className="grid gap-2" aria-live="polite">
                    <p className="m-0 mono text-ink-2 nums">
                      Epoch {lastLog?.epoch ?? 0}/{EPOCHS} · loss {lastLog?.loss.toFixed(3)} · val acc {lastLog ? pct(lastLog.valAcc) : '—'}
                    </p>
                    <LossSpark log={trainLog} epochs={EPOCHS} />
                    <Button variant="ghost" size="sm" icon="close" onClick={() => abortTrain.current?.abort()}>Stop training</Button>
                  </div>
                ) : null}
                {train === 'ready' && cnnInfo ? (
                  <div className="grid gap-2">
                    <LossSpark log={trainLog} epochs={EPOCHS} />
                    <p className="m-0 text-0 text-ink-2">
                      Trained in this tab: <span className="nums">{cnnInfo.params.toLocaleString()}</span> parameters on the {cnnInfo.backend} backend.
                      Held-out synthetic accuracy <span className="nums font-semibold">{pct(cnnInfo.acc)}</span>.
                    </p>
                    <p className="m-0 mono text-ink-3">{LAYERS_SUMMARY.join(' → ')}</p>
                    <Button variant="ghost" size="sm" icon="refresh" onClick={trainCnn}>Retrain</Button>
                  </div>
                ) : null}
                {train === 'error' ? (
                  <ErrorState title="TensorFlow.js did not start">
                    {trainError} The baseline keeps classifying.
                  </ErrorState>
                ) : null}
              </div>
            </DemoPanel>

            {source === 'sensor' ? (
              <DemoPanel title="Try these">
                <ul className="grid gap-2 m-0 p-0 list-none text-0">
                  {ACTIVITIES.map((a) => (
                    <li key={a}><span className="font-semibold">{ACTIVITY_LABEL[a]}:</span> <span className="text-ink-2">{ACTIVITY_HINT[a]}</span></li>
                  ))}
                </ul>
              </DemoPanel>
            ) : null}
          </>
        }
      >
        <DemoPanel
          title="Accelerometer incl. gravity · m/s²"
          meta={`${HZ} Hz · ${WIN / HZ} s windows`}
        >
          <div className="grid gap-3">
            <div className="grid gap-3">
              <DemoToolbar>
                <Segmented label="Signal" options={SOURCES} value={source} onChange={chooseSource} />
                {source === 'replay' ? (
                  <>
                    <Button size="sm" variant="secondary" icon={playing ? 'pause' : 'play'} onClick={() => setPlaying((p) => !p)} disabled={!ready}>
                      {playing ? 'Pause' : 'Play'}
                    </Button>
                    <Segmented label="Speed" options={SPEEDS} value={speed} onChange={setSpeed} />
                  </>
                ) : null}
              </DemoToolbar>
              {source === 'sensor' ? (
                <div className="grid gap-3 justify-items-start" aria-live="polite">
                  <p className="m-0 text-0 text-ink-2">{SENSOR_COPY[sensor]}</p>
                  <div className="flex flex-wrap gap-2">
                    {sensor === 'idle' || sensor === 'denied' || sensor === 'no-data' ? (
                      <Button icon="phone" onClick={allowMotion}>Allow motion access</Button>
                    ) : null}
                    {sensorBad ? (
                      <Button variant="secondary" icon="play" onClick={() => chooseSource('replay')}>Use the sample replay</Button>
                    ) : null}
                  </div>
                  {sensor === 'requesting' || sensor === 'waiting' ? <Loading label="Waiting for sensors" /> : null}
                </div>
              ) : (
                <p className="m-0 text-0 text-ink-2">
                  A seeded, synthetic 80 s session (still, walking, jogging, squats, bending, sitting down) replayed at 25 Hz. On a phone, switch to “My phone” to use your own motion.
                </p>
              )}
            </div>
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="block w-full h-[200px] md:h-[260px] bg-bg rounded-1 border border-rule-soft"
                role="img"
                aria-label={latest
                  ? `Strip chart of the last ${VIEW_S} seconds. Latest window ${latest.n}: ${ACTIVITY_LABEL[ACTIVITIES[argmax(pick(latest, model))] as Activity]}.`
                  : `Strip chart of the last ${VIEW_S} seconds.`}
              />
              {!ready ? <div className="absolute inset-0 grid place-items-center"><Loading label="Training the baseline" /></div> : null}
              {ready && source === 'sensor' && sensor !== 'live' && buf.current.count === 0 ? (
                <div className="absolute inset-0 grid place-items-center p-4">
                  <EmptyState title="No signal yet">{SENSOR_COPY[sensor]}</EmptyState>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ul className="flex flex-wrap gap-3 m-0 p-0 list-none mono text-ink-2" aria-label="Axes">
                {(['x', 'y', 'z'] as const).map((a, i) => (
                  <li key={a} className="inline-flex items-center gap-1.5">
                    <svg width="22" height="6" aria-hidden="true">
                      <line x1="0" x2="22" y1="3" y2="3" strokeWidth="2" style={{ stroke: `var(--data-${i + 1})` }} strokeDasharray={AXIS_DASH[a].join(' ') || undefined} />
                    </svg>
                    {a}
                  </li>
                ))}
              </ul>
              <Badge tone={source === 'replay' ? 'neutral' : sensor === 'live' ? 'ok' : 'warn'}>
                {source === 'replay' ? 'Synthetic replay' : sensor === 'live' ? 'Live from this device' : 'Sensor off'}
              </Badge>
            </div>
            {reduced && source === 'replay' && !playing ? (
              <p className="m-0 text-00 text-ink-3">Reduced motion is on, so this is a still frame. Press Play to run the replay.</p>
            ) : null}
          </div>
        </DemoPanel>

        <DemoPanel title="Latest 5 s window" meta={latest ? `W${latest.n}` : undefined}>
          {latest ? (
            <div className="grid gap-4">
              <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live={source === 'sensor' ? 'polite' : 'off'}>
                <span className="display text-4">{ACTIVITY_LABEL[ACTIVITIES[argmax(pick(latest, model))] as Activity]}</span>
                <span className="mono nums text-ink-2">{pct(Math.max(...pick(latest, model)))} · {model === 'cnn' && latest.cnn ? 'CNN-LSTM' : 'baseline'}</span>
              </p>
              <ProbBars result={latest} />
            </div>
          ) : (
            <EmptyState title="Waiting for the first full window">Each window is 5 seconds ({WIN} samples) and is classified the moment it closes.</EmptyState>
          )}
        </DemoPanel>

        <DemoPanel
          title="Window tape"
          meta={graded.length ? <span className="nums">agrees with script: {agree} of {graded.length}</span> : undefined}
        >
          {results.length ? (
            <div className="grid gap-2">
              <WindowTape results={results} model={model} />
              <p className="m-0 text-00 text-ink-3">
                {source === 'replay'
                  ? 'A tick means the window matches the replay script; a cross shows what the script says instead.'
                  : 'Live windows have no ground truth, so there is nothing to grade.'}
              </p>
            </div>
          ) : <EmptyState title="No windows yet" />}
        </DemoPanel>
      </DemoGrid>
    </div>
  )
}
