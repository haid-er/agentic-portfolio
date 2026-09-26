'use client'
/**
 * Sensor pipeline: a synthetic raw phone-IMU export walked through the 8 preprocessing
 * steps one at a time. Every step is a pure function (pipeline.ts); the UI shows the file
 * listing, the selected file's contents and the signal with each step's overlay.
 */
import { useEffect, useMemo, useState } from 'react'
import { Button, DemoGrid, DemoPanel, DemoToolbar, EmptyState, Segmented, Select } from '@/components/ui'
import research from '@/content/research.json'
import type { DemoProps } from '@/lib/demos/types'
import { usePageVisible } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { G, rawExport } from './data'
import { Files } from './Files'
import { runPipeline, STEPS, STANDARD, toCsv, type Entry } from './pipeline'
import { Plot, spansFor, type PlotMode } from './Plot'
import { Preview } from './Preview'
import { Range } from './Range'

export { notes } from './notes'

const MODES = [{ value: 'magnitude', label: 'Magnitude' }, { value: 'gravity', label: 'Gravity split' }] as const
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Step titles come from content when the pipeline block is enabled and lists all eight;
 * the demo's own labels otherwise. Only research.json is imported (not the lib/content
 * barrel) so this client chunk stays small; a light shape check stands in for zod.
 */
function stepTitles(): string[] {
  const block: unknown = (research as { pipeline?: unknown }).pipeline
  if (block && typeof block === 'object') {
    const { enabled, steps } = block as { enabled?: unknown; steps?: unknown }
    if (
      enabled === true &&
      Array.isArray(steps) &&
      steps.length === STEPS.length &&
      steps.every((t) => typeof t === 'string' && t.trim() !== '')
    ) {
      return steps as string[]
    }
  }
  return STEPS.map((s) => s.title)
}

export default function Demo(_props: DemoProps) {
  const visible = usePageVisible()
  const raw = useMemo(() => rawExport(), [])
  const titles = useMemo(stepTitles, [])
  const [step, setStep] = useState(0)
  const [windowSec, setWindowSec] = useState(5)
  const [fallG, setFallG] = useState(2.5)
  const [mode, setMode] = useState<PlotMode>('magnitude')
  const [cutoff, setCutoff] = useState(0.3)
  const [source, setSource] = useState('r5')
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)

  const stages = useMemo(() => runPipeline(raw, { windowSec, fallG }), [raw, windowSec, fallG])
  const stage = stages[step]
  const recordings = raw.filter((f) => f.kind === 'recording')
  const full = stages[4].sources.get(source) ?? []
  const forSource = stage.entries.filter((e) => e.source === source)
  const entry: Entry | undefined = forSource.find((e) => e.key === pickedKey) ?? forSource[0]
  const def = STEPS[step - 1]

  // Play through: one step every 1.8 s, paused in a hidden tab.
  useEffect(() => {
    if (!playing || !visible) return
    if (step >= STEPS.length) { setPlaying(false); return }
    const id = window.setTimeout(() => setStep((s) => Math.min(STEPS.length, s + 1)), 1800)
    return () => window.clearTimeout(id)
  }, [playing, visible, step])

  const go = (n: number) => { setPlaying(false); setStep(Math.max(0, Math.min(STEPS.length, n))) }
  const selectEntry = (e: Entry) => { setSource(e.source); setPickedKey(e.key) }

  // Overlays for the plot at this step.
  const win = Math.round(windowSec * 50)
  const spans = step >= 5 ? spansFor(stage.entries, source) : []
  const windows = spans.filter((s) => s.kind === 'window').map((s) => ({ start: s.start, end: s.end, label: `w${pad(s.index)}`, active: s.key === entry?.key }))
  const segSpan = spans.find((s) => s.kind === 'segment')
  const srcActivity = forSource[0]?.activity ?? stages[2].entries.find((e) => e.source === source)?.activity ?? ''
  const isFall = srcActivity.startsWith('fall')
  const droppedAtCleanup = step >= 7 && !(STANDARD as readonly string[]).includes(srcActivity)

  const download = () => {
    if (!entry?.rows) return
    const blob = new Blob([toCsv(entry.rows)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = entry.kind === 'recording' ? `${entry.subject}_${entry.activity}.csv` : entry.file.replace(/\.json$/, '.csv')
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="grid gap-4">
      <DemoPanel title="Pipeline" meta={<span className="nums">step {step} of {STEPS.length}</span>}>
        <div className="grid gap-4">
          <ol className="grid grid-cols-3 md:grid-cols-9 gap-2 m-0 p-0 list-none">
            {['Raw export', ...titles].map((t, i) => {
              const on = i === step
              const done = i < step
              return (
                <li key={i} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={on ? 'step' : undefined}
                    className={cx(
                      'w-full h-full min-h-tap flex flex-col items-start gap-1 p-2 text-left border rounded-1 transition-colors duration-[var(--dur-fast)]',
                      on ? 'bg-ink text-bg border-ink' : done ? 'bg-bg-2 border-rule text-ink' : 'bg-surface border-rule-soft text-ink-2 hover:border-rule',
                    )}
                  >
                    <span className={cx('display text-2 leading-none nums', on ? '' : done ? 'text-accent-ink' : 'text-ink-3')}>{pad(i)}</span>
                    <span className="text-00 leading-snug line-clamp-3">{t}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <DemoToolbar>
            <Button size="sm" variant="secondary" onClick={() => go(step - 1)} disabled={step === 0}>Previous</Button>
            <Button size="sm" onClick={() => go(step + 1)} disabled={step === STEPS.length} arrow>Next step</Button>
            <Button
              size="sm"
              variant="ghost"
              icon={playing ? 'pause' : 'play'}
              onClick={() => { if (step >= STEPS.length) setStep(0); setPlaying((p) => !p) }}
            >
              {playing ? 'Pause' : 'Play through'}
            </Button>
            <Button size="sm" variant="ghost" icon="refresh" onClick={() => { go(0); setWindowSec(5); setFallG(2.5) }}>Reset</Button>
          </DemoToolbar>
        </div>
      </DemoPanel>

      <DemoGrid
        aside={
          <>
            <DemoPanel title="Parameters">
              <div className="grid gap-4">
                <Range label="Window length" value={windowSec} min={2} max={10} step={1} unit=" s" onChange={setWindowSec} hint="The pipeline uses 5 s atomic windows. Try others and watch the tails change." />
                <Range label="Fall threshold" value={fallG} min={1.5} max={5} step={0.1} unit=" g" onChange={setFallG} hint="Peak acceleration a recording must pass to count as an impact (step 8)." />
                {mode === 'gravity' ? (
                  <Range label="Gravity cut-off" value={cutoff} min={0.1} max={2} step={0.1} unit=" Hz" onChange={setCutoff} hint="Low-pass corner frequency for the gravity estimate." />
                ) : null}
              </div>
            </DemoPanel>
            <DemoPanel title="Log" meta={step ? `step ${pad(step)}` : 'export'}>
              <ol className="grid gap-1.5 m-0 pl-5 text-0 text-ink-2 [overflow-wrap:anywhere]" aria-live="polite">
                {stage.log.map((l, i) => <li key={i}>{l}</li>)}
              </ol>
            </DemoPanel>
            <DemoPanel title="Files">
              <Files stage={stage} selectedKey={entry?.key ?? null} onSelect={selectEntry} />
            </DemoPanel>
          </>
        }
      >
        <DemoPanel title={step ? `Step ${pad(step)}` : 'Raw export'}>
          {def ? (
            <div className="grid gap-3">
              <h3 className="display text-3 m-0">{titles[step - 1]}</h3>
              <p className="m-0 measure">{def.what}</p>
              <figure className="m-0 grid gap-1">
                <pre tabIndex={0} aria-label="pandas equivalent" className="m-0 p-3 overflow-x-auto bg-bg-2 border border-rule-soft rounded-1 font-mono text-00 leading-[1.6] whitespace-pre">{def.pandas}</pre>
                <figcaption className="text-00 text-ink-3">pandas equivalent, illustrative (the demo runs the same logic in TypeScript in your browser)</figcaption>
              </figure>
            </div>
          ) : (
            <div className="grid gap-3">
              <h3 className="display text-3 m-0">A messy export</h3>
              <p className="m-0 measure">
                Eight phone recordings (accelerometer and gyroscope at 50 Hz) as a data-collection app might leave them: hand-typed folder names, a truncated last line in every file and a couple of stray files. Step through to turn it into clean ADL and Fall datasets.
              </p>
            </div>
          )}
        </DemoPanel>

        <DemoPanel
          title="Signal"
          meta={step < 4 ? 'parsed for plotting' : undefined}
        >
          <div className="grid gap-3">
            <DemoToolbar>
              <Select label="Recording" value={source} onChange={(e) => { setSource(e.target.value); setPickedKey(null) }} wrapperClassName="min-w-[12rem] flex-1">
                {recordings.map((r) => {
                  const cur = stages[Math.min(step, 2)].entries.find((e) => e.source === r.id)
                  return <option key={r.id} value={r.id}>{cur ? `${cur.subject} · ${cur.activity}` : r.path}</option>
                })}
              </Select>
              <Segmented label="View" options={MODES} value={mode} onChange={setMode} />
            </DemoToolbar>
            {full.length ? (
              <Plot
                rows={full}
                mode={mode}
                cutoff={cutoff}
                windows={step === 8 && isFall ? undefined : windows}
                tailFrom={step >= 5 && !(step === 8 && isFall) ? Math.floor(full.length / win) * windowSec : undefined}
                segment={step === 8 && isFall && segSpan ? segSpan : null}
                threshold={step === 8 && isFall ? fallG * G : undefined}
                removed={droppedAtCleanup || (step === 8 && isFall && !segSpan)}
                stageLabel={step ? titles[step - 1] : 'Raw export'}
              />
            ) : (
              <EmptyState title="No samples in this recording" />
            )}
            {windows.length > 1 ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Windows of this recording">
                {windows.map((w, i) => {
                  const key = spans.filter((s) => s.kind === 'window')[i]?.key
                  return (
                    <button
                      key={w.label}
                      type="button"
                      aria-pressed={w.active}
                      onClick={() => key && setPickedKey(key)}
                      className={cx('min-h-tap min-w-tap px-3 font-mono text-00 border rounded-pill', w.active ? 'bg-ink text-bg border-ink' : 'border-rule text-ink hover:bg-bg-2')}
                    >
                      {w.label}
                    </button>
                  )
                })}
              </div>
            ) : null}
            {step === 5 && isFall ? (
              <p className="m-0 text-0 text-ink-2">Notice how fixed windows cut straight through the fall. Step 8 fixes that.</p>
            ) : null}
            {droppedAtCleanup ? <p className="m-0 text-0 text-danger">This recording was removed in step 7: its activity is not in the standard list.</p> : null}
            {step === 8 && isFall && !segSpan ? <p className="m-0 text-0 text-danger">No impact passed the threshold, so this recording is held back for review.</p> : null}
          </div>
        </DemoPanel>

        <DemoPanel
          title="File contents"
          meta={entry ? <span className="[overflow-wrap:anywhere]">{entry.path}</span> : undefined}
          actions={entry?.rows ? <Button size="sm" variant="secondary" icon="download" onClick={download}>CSV</Button> : null}
        >
          <Preview entry={entry} step={step} />
        </DemoPanel>
      </DemoGrid>
    </div>
  )
}
