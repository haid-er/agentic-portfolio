'use client'
/**
 * Layered API lab: send requests to real routes (/api/demos/lab/*) and watch them pass through
 * router -> middleware (body parser, Zod) -> controller -> service -> repository, with typed
 * errors caught by one error handler and Winston-style log lines. The same code can run in the
 * browser when the server is unreachable.
 */
import { useState } from 'react'
import { Badge, Button, DemoGrid, DemoPanel, ErrorState, Segmented } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { cx } from '@/lib/utils'
import type { Layer } from './api/types'
import { LogView } from './LogView'
import { PRESETS, type Preset } from './presets'
import { RequestForm, type Draft } from './RequestForm'
import { ResponseView } from './ResponseView'
import { LAYER_LABEL, SOURCES, type Flavour } from './sources'
import { TraceView } from './TraceView'
import { useLab, type RunMode } from './useLab'

export { notes } from './notes'

const MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'server', label: 'Server only' },
  { value: 'browser', label: 'In browser' },
] as const

const first = PRESETS[0] as Preset

export default function Demo(_props: DemoProps) {
  const lab = useLab()
  const [draft, setDraft] = useState<Draft>({ method: first.method, path: first.path, body: first.body ?? '' })
  const [preset, setPreset] = useState<Preset | null>(first)
  const [mode, setMode] = useState<RunMode>('auto')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [layer, setLayer] = useState<Layer>('controller')
  const [flavour, setFlavour] = useState<Flavour>('express')
  const [announce, setAnnounce] = useState('')

  const current = lab.history.find((h) => h.id === selectedId) ?? lab.history[0] ?? null

  const send = async (d: Draft = draft) => {
    const ex = await lab.send(d.method, d.path, d.body, mode)
    if (!ex) return
    setSelectedId(ex.id)
    const origin = [...ex.trace].reverse().find((s) => s.outcome === 'threw')
    setLayer(origin?.layer ?? 'repository')
    setAnnounce(`${d.method} ${d.path} answered ${ex.status}${origin ? `; ${origin.label} threw` : ''}.`)
  }

  const pickPreset = (p: Preset) => {
    const d = { method: p.method, path: p.path, body: p.body ?? '' }
    setPreset(p)
    setDraft(d)
    void send(d)
  }

  return (
    <div className="grid gap-4 min-w-0">
      <p className="sr-only" aria-live="polite">{announce}</p>

      <DemoGrid
        aside={
          <>
            <DemoPanel title="Response" meta={current ? <span className="nums">{current.method} {current.path}</span> : undefined}>
              {lab.error ? (
                <ErrorState title="Request failed" action={<Button size="sm" variant="secondary" onClick={() => { setMode('browser'); lab.clearError() }}>Run in browser instead</Button>}>
                  <p className="m-0">{lab.error}</p>
                </ErrorState>
              ) : current ? (
                <ResponseView ex={current} />
              ) : (
                <p className="m-0 text-0 text-ink-2">Responses show here with status, headers and body.</p>
              )}
            </DemoPanel>
            <DemoPanel title="Logs" meta="winston · json">
              <LogView logs={current?.logs ?? []} />
            </DemoPanel>
          </>
        }
      >
        <DemoPanel
          title="Request"
          actions={<Button size="sm" variant="ghost" icon="refresh" onClick={() => { void lab.reset(); setSelectedId(null); setAnnounce('Sample data reset.') }}>Reset data</Button>}
        >
          <div className="grid gap-4">
            <Segmented<RunMode> label="Run on" options={MODES} value={mode} onChange={setMode} />
            <RequestForm
              draft={draft}
              onChange={(d) => { setDraft(d); setPreset(null) }}
              onSend={() => void send()}
              onPreset={pickPreset}
              activePreset={preset?.id ?? null}
              busy={lab.busy}
            />
            {preset ? <p className="m-0 text-0 text-ink-2 measure"><span className="mono text-ink-3">Watch: </span>{preset.watch}</p> : null}
          </div>
        </DemoPanel>

        <DemoPanel
          title="Trace"
          meta={current ? <span className="nums">{current.trace.length} steps · {current.durationMs} ms in app</span> : undefined}
        >
          <TraceView trace={current?.trace ?? []} status={current?.status ?? null} selected={layer} onSelect={setLayer} runKey={current?.id ?? 0} />
        </DemoPanel>

        <DemoPanel
          title={`Source · ${LAYER_LABEL[layer]}`}
          actions={<Segmented<Flavour> label="Flavour" options={[{ value: 'express', label: 'Express' }, { value: 'nest', label: 'NestJS' }]} value={flavour} onChange={setFlavour} />}
        >
          <pre className="m-0 p-3 bg-bg-2 rounded-0 font-mono text-00 leading-relaxed overflow-auto max-h-96" tabIndex={0} aria-label={`${LAYER_LABEL[layer]} source, ${flavour === 'nest' ? 'NestJS' : 'Express'}`}>
            <code>{SOURCES[layer][flavour]}</code>
          </pre>
          <p className="m-0 mt-2 text-00 text-ink-3">
            {flavour === 'express' ? 'Mirrors the TypeScript that actually handled your request.' : 'The same layer shaped as a NestJS provider; illustrative, not executed.'}
          </p>
        </DemoPanel>
      </DemoGrid>

      {lab.history.length > 1 ? (
        <DemoPanel title="History" meta={`${lab.history.length} requests`}>
          <ol className="m-0 p-0 list-none flex flex-wrap gap-2" aria-label="Request history">
            {lab.history.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(h.id)}
                  aria-current={current?.id === h.id ? 'true' : undefined}
                  className={cx('min-h-tap px-3 py-1 border rounded-pill flex items-center gap-2 font-mono text-00', current?.id === h.id ? 'border-ink bg-bg-2' : 'border-rule-soft bg-surface hover:bg-bg-2')}
                >
                  <Badge tone={h.status >= 500 ? 'danger' : h.status >= 400 ? 'warn' : 'ok'}>{h.status}</Badge>
                  <span className="[overflow-wrap:anywhere]">{h.method} {h.path}</span>
                </button>
              </li>
            ))}
          </ol>
        </DemoPanel>
      ) : null}
    </div>
  )
}
