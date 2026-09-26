'use client'
/**
 * Live telemetry: an EventSource reads Server-Sent Events from an edge route that streams
 * simulated fleet or wearable metrics. SVG strip charts, per-metric thresholds with edge-triggered
 * alerts, a frozen view that keeps buffering, automatic resume via Last-Event-ID, and an
 * in-browser fallback that runs the same deterministic generator when the stream is unreachable.
 */
import { useMemo, useState } from 'react'
import {
  Badge, Button, DemoGrid, DemoPanel, DemoToolbar, EmptyState, ErrorState, Loading, Segmented,
  Table, TableWrap, Td, Th, Toggle, Tr, type Tone,
} from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useInView, useLocalStorage, usePageVisible, useReducedMotion } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { Chart, DEVICE_DASH, DEVICE_STROKE } from './Chart'
import { isBreach, SCENARIOS, type ScenarioId } from './generator'
import { Range } from './Range'
import { useTelemetry, type Sample, type Status, type Transport } from './useTelemetry'

export { notes } from './notes'

type Hz = '1' | '2' | '5'
type Win = '30' | '60' | '120'
const SEED = 417

const STATUS: Record<Status, { label: string; tone: Tone }> = {
  idle: { label: 'stopped', tone: 'neutral' },
  connecting: { label: 'connecting', tone: 'warn' },
  open: { label: 'SSE open', tone: 'ok' },
  reconnecting: { label: 'reconnecting', tone: 'warn' },
  held: { label: 'held (not visible)', tone: 'neutral' },
  error: { label: 'stream failed', tone: 'danger' },
  local: { label: 'local simulation', tone: 'accent' },
}

interface Alert { key: string; seq: number; ts: number; device: string; metric: string; unit: string; value: number; dir: 'above' | 'below'; threshold: number; decimals: number }

const utc = (ts: number) => new Date(ts).toISOString().slice(11, 19)

export default function Demo(_props: DemoProps) {
  const reduced = useReducedMotion()
  const visible = usePageVisible()
  const [viewRef, inView] = useInView<HTMLDivElement>({ rootMargin: '200px' })
  const [transport, setTransport] = useState<Transport>(() => (typeof navigator !== 'undefined' && navigator.onLine === false ? 'local' : 'sse'))
  const [scenarioRaw, setScenario] = useLocalStorage<ScenarioId>('live-telemetry:scenario', 'fleet')
  const scenario: ScenarioId = scenarioRaw in SCENARIOS ? scenarioRaw : 'fleet'
  const [hz, setHz] = useState<Hz>('2')
  const [win, setWin] = useState<Win>('60')
  const [want, setWant] = useState(!reduced)
  const [frozenAt, setFrozenAt] = useState<number | null>(null)
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [hidden, setHidden] = useState<boolean[]>([false, false, false])
  const [hoverSeq, setHoverSeq] = useState<number | null>(null)
  const [announceAlerts, setAnnounceAlerts] = useState(false)

  const def = SCENARIOS[scenario]
  const hzN = Number(hz)
  const t = useTelemetry({ scenario, hz: hzN, seed: SEED, transport, want, live: visible && inView }, def.devices.length)
  const thresholds = def.metrics.map((m) => overrides[`${scenario}:${m.id}`] ?? m.threshold)

  const view = useMemo(() => (frozenAt === null ? t.samples : t.samples.filter((s) => s.seq <= frozenAt)), [t.samples, frozenAt])
  const pending = frozenAt === null ? 0 : t.samples.filter((s) => s.seq > frozenAt).length
  const span = Number(win) * hzN

  const thresholdKey = thresholds.join('|')
  const alerts = useMemo(() => findAlerts(t.samples, scenario, thresholdKey.split('|').map(Number)), [t.samples, scenario, thresholdKey])
  const last = t.samples[t.samples.length - 1]
  const stats = useMemo(() => streamStats(t.samples), [t.samples])
  const newest = alerts[0]

  const switchTransport = (v: Transport) => { setTransport(v); setFrozenAt(null); setWant(true) }
  const status = STATUS[t.status]

  return (
    <div ref={viewRef} className="grid gap-4 min-w-0">
      <p className="sr-only" aria-live="polite">
        {announceAlerts && newest ? `Alert: ${newest.device} ${newest.metric} ${newest.value} ${newest.unit}, ${newest.dir} ${newest.threshold}.` : ''}
      </p>

      <DemoToolbar>
        <div className="flex flex-wrap gap-2">
          {want
            ? <Button variant="secondary" icon="close" onClick={() => setWant(false)}>Disconnect</Button>
            : <Button icon="play" onClick={() => setWant(true)}>{transport === 'sse' ? 'Connect stream' : 'Start simulation'}</Button>}
          <Button
            variant="secondary"
            icon={frozenAt === null ? 'pause' : 'play'}
            disabled={!t.samples.length}
            onClick={() => setFrozenAt(frozenAt === null ? (last?.seq ?? 0) : null)}
          >
            {frozenAt === null ? 'Freeze view' : `Resume view${pending ? ` (+${pending})` : ''}`}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="status" aria-live="polite">
          <Badge tone={status.tone}>{status.label}</Badge>
          {frozenAt !== null ? <Badge tone="warn">view frozen · still buffering</Badge> : null}
        </div>
      </DemoToolbar>

      <DemoGrid
        aside={
          <>
            <DemoPanel title="Stream">
              <div className="grid gap-4">
                <Segmented label="Transport" options={[{ value: 'sse', label: 'SSE · edge' }, { value: 'local', label: 'Local' }] as const} value={transport} onChange={switchTransport} />
                <Segmented label="Scenario" options={[{ value: 'fleet', label: 'Fleet' }, { value: 'wearables', label: 'Wearables' }] as const} value={scenario} onChange={(v) => { setScenario(v); setFrozenAt(null) }} />
                <Segmented label="Sample rate" options={[{ value: '1', label: '1 Hz' }, { value: '2', label: '2 Hz' }, { value: '5', label: '5 Hz' }] as const} value={hz} onChange={(v) => { setHz(v); setFrozenAt(null) }} />
                <Segmented label="Window" options={[{ value: '30', label: '30 s' }, { value: '60', label: '60 s' }, { value: '120', label: '120 s' }] as const} value={win} onChange={setWin} />
                <p className="m-0 text-00 text-ink-3">
                  {transport === 'sse'
                    ? 'Samples arrive over one HTTP response from an edge function. Changing scenario or rate opens a fresh stream.'
                    : 'The same generator runs on a timer in this tab. Nothing is streamed; use this offline.'}
                </p>
              </div>
            </DemoPanel>
            <DemoPanel title="Thresholds">
              <div className="grid gap-4">
                {def.metrics.map((m, i) => (
                  <Range
                    key={`${scenario}-${m.id}`}
                    label={`${m.label} (${m.dir})`}
                    value={thresholds[i] ?? m.threshold}
                    min={m.min}
                    max={m.max}
                    step={10 ** -Math.min(m.decimals, 1)}
                    format={(v) => `${v.toFixed(Math.min(m.decimals, 1))} ${m.unit}`}
                    onChange={(v) => setOverrides((o) => ({ ...o, [`${scenario}:${m.id}`]: v }))}
                  />
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" icon="refresh" onClick={() => setOverrides({})}>Default thresholds</Button>
                </div>
                <Toggle label="Announce new alerts" checked={announceAlerts} onChange={setAnnounceAlerts} />
              </div>
            </DemoPanel>
            <DemoPanel title="Devices">
              <div className="grid gap-2">
                {def.devices.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={!hidden[i]}
                    onClick={() => setHidden((h) => h.map((x, j) => (j === i ? !x : x)))}
                    className={cx('min-h-tap flex items-center gap-3 px-3 border border-rule rounded-1 font-mono text-00 text-left', hidden[i] ? 'bg-bg-2 text-ink-3' : 'bg-surface text-ink')}
                  >
                    <svg width="28" height="8" aria-hidden="true"><line x1="0" x2="28" y1="4" y2="4" className={DEVICE_STROKE[i]} strokeWidth={2.5} strokeDasharray={DEVICE_DASH[i]} /></svg>
                    <span>{d}</span>
                    <span className="ml-auto">{hidden[i] ? 'hidden' : 'shown'}</span>
                  </button>
                ))}
              </div>
            </DemoPanel>
          </>
        }
      >
        <DemoPanel
          title={`${def.label} telemetry`}
          meta={last ? <span className="nums">as of {utc(last.ts)} UTC · seq {last.seq}</span> : 'no data yet'}
        >
          <StatusBody status={t.status} error={t.error} hasData={t.samples.length > 0} transport={transport}
            onRetry={() => { setWant(false); window.setTimeout(() => setWant(true), 0) }}
            onLocal={() => switchTransport('local')}
            onStart={() => setWant(true)}
          />
          {view.length ? (
            <div className="grid gap-5 mt-2">
              {def.metrics.map((m, i) => (
                <Chart
                  key={`${scenario}-${m.id}`}
                  metric={m}
                  metricIndex={i}
                  samples={view}
                  span={span}
                  windowSec={Number(win)}
                  threshold={thresholds[i] ?? m.threshold}
                  hidden={hidden}
                  devices={def.devices}
                  hoverSeq={hoverSeq}
                  onHover={setHoverSeq}
                />
              ))}
            </div>
          ) : null}
        </DemoPanel>

        <dl className="m-0 grid grid-cols-2 xs:grid-cols-4 gap-px bg-rule-soft border border-rule rounded-2 overflow-hidden strata:border-rule-soft">
          <Stat label="Events / s" value={stats.rate.toFixed(1)} />
          <Stat label="Delivery lag" value={stats.lag === null ? '—' : `${stats.lag} ms`} note={transport === 'sse' ? 'clock skew included' : 'in-tab'} />
          <Stat label="Resumes" value={String(t.reconnects)} note="via Last-Event-ID" />
          <Stat label="Buffered" value={String(t.samples.length)} note={t.malformed ? `${t.malformed} malformed dropped` : undefined} />
        </dl>
      </DemoGrid>

      <div className="grid gap-4 lg:grid-cols-2 min-w-0">
        <DemoPanel title="Alerts" meta={`${alerts.length} in buffer`}>
          {alerts.length ? (
            <ol className="m-0 p-0 list-none grid gap-1 max-h-72 overflow-y-auto" tabIndex={0} aria-label="Threshold alerts, newest first">
              {alerts.slice(0, 30).map((a) => (
                <li key={a.key} className="flex flex-wrap items-baseline gap-x-2 gap-y-0 py-1 border-b border-rule-soft font-mono text-00">
                  <span className="text-ink-3 nums">{utc(a.ts)}</span>
                  <span className="text-ink">{a.device}</span>
                  <span className="text-ink-2">{a.metric}</span>
                  <span className="text-danger nums ml-auto">{a.dir === 'above' ? '▲' : '▼'} {a.value.toFixed(a.decimals)} {a.unit}</span>
                  <span className="text-ink-3 nums">({a.dir} {a.threshold.toFixed(Math.min(a.decimals, 1))})</span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No threshold crossings">
              {t.samples.length ? 'Nothing has crossed a threshold in the buffer. Drag a threshold closer to the traces to see alerts fire.' : 'Alerts appear here once data is flowing.'}
            </EmptyState>
          )}
        </DemoPanel>

        <DemoPanel title="Latest readings">
          {last ? (
            <TableWrap label="Latest reading per device">
              <Table>
                <thead>
                  <Tr><Th>Device</Th>{def.metrics.map((m) => <Th key={m.id} className="text-right">{m.label} ({m.unit})</Th>)}</Tr>
                </thead>
                <tbody>
                  {def.devices.map((d, di) => (
                    <Tr key={d}>
                      <Td className="font-mono">{d}</Td>
                      {def.metrics.map((m, mi) => {
                        const v = last.values[di]?.[mi] ?? 0
                        const bad = isBreach(m, v, thresholds[mi] ?? m.threshold)
                        return (
                          <Td key={m.id} className={cx('text-right whitespace-nowrap', bad && 'text-danger font-semibold')}>
                            {v.toFixed(m.decimals)}{bad ? ' ALERT' : ''}
                          </Td>
                        )
                      })}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          ) : (
            <EmptyState title="No readings yet">Connect the stream or start the local simulation.</EmptyState>
          )}
        </DemoPanel>
      </div>

      <DemoPanel title="On the wire" meta={transport === 'sse' ? 'text/event-stream' : 'local mode'}>
        {transport === 'sse' && t.raw.length ? (
          <pre className="m-0 p-3 bg-bg-2 border border-rule-soft rounded-1 text-00 leading-[1.6] overflow-x-auto max-w-full whitespace-pre-wrap [overflow-wrap:anywhere]" tabIndex={0} aria-label="Most recent raw server-sent events">
            <code>{t.raw.map((r) => r.text).join('\n\n')}</code>
          </pre>
        ) : (
          <p className="m-0 text-0 text-ink-2">
            {transport === 'sse'
              ? 'The last few raw events (id, event and data lines) will show here once the stream is open.'
              : 'Local mode calls the generator directly, so there is no wire format to show. Switch to SSE to see the raw events.'}
          </p>
        )}
      </DemoPanel>
    </div>
  )
}

function StatusBody({ status, error, hasData, transport, onRetry, onLocal, onStart }: {
  status: Status; error: string | null; hasData: boolean; transport: Transport
  onRetry: () => void; onLocal: () => void; onStart: () => void
}) {
  if (status === 'error') {
    return (
      <ErrorState
        title="The live stream is unavailable"
        className="mb-3"
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon="refresh" onClick={onRetry}>Retry</Button>
            <Button size="sm" icon="play" onClick={onLocal}>Use local simulation</Button>
          </div>
        }
      >
        <p className="m-0">{error ?? 'The connection failed.'} Nothing is estimated: the charts only show samples that actually arrived.</p>
      </ErrorState>
    )
  }
  if (hasData) return null
  if (status === 'connecting' || status === 'reconnecting') return <Loading label="Opening the event stream" />
  if (status === 'held') return <p className="m-0 text-0 text-ink-2">The stream is closed while this demo is off-screen or the tab is hidden. It resumes when you come back.</p>
  if (status === 'idle') {
    return (
      <EmptyState title="Stream stopped" action={<Button icon="play" onClick={onStart}>{transport === 'sse' ? 'Connect stream' : 'Start simulation'}</Button>}>
        {transport === 'sse' ? 'Connect to open a Server-Sent Events stream from the edge route.' : 'Start the in-browser generator.'}
      </EmptyState>
    )
  }
  return <Loading label="Waiting for the first sample" />
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-surface px-3 py-2 min-w-0">
      <dt className="mono text-ink-3">{label}</dt>
      <dd className="m-0 display text-3 nums">{value}</dd>
      {note ? <dd className="m-0 font-mono text-[.6875rem] text-ink-3">{note}</dd> : null}
    </div>
  )
}

/** Edge-triggered alerts: one entry each time a series crosses into its alert zone. Newest first. */
function findAlerts(samples: Sample[], scenario: ScenarioId, thresholds: number[]): Alert[] {
  const def = SCENARIOS[scenario]
  const out: Alert[] = []
  def.devices.forEach((device, d) => {
    def.metrics.forEach((m, mi) => {
      const th = thresholds[mi] ?? m.threshold
      let prev = false
      samples.forEach((s) => {
        const v = s.values[d]?.[mi]
        if (v === undefined) return
        const now = isBreach(m, v, th)
        if (now && !prev) out.push({ key: `${s.seq}-${d}-${mi}`, seq: s.seq, ts: s.ts, device, metric: m.label, unit: m.unit, value: v, dir: m.dir, threshold: th, decimals: m.decimals })
        prev = now
      })
    })
  })
  return out.sort((a, b) => b.seq - a.seq)
}

function streamStats(samples: Sample[]): { rate: number; lag: number | null } {
  const last = samples[samples.length - 1]
  if (!last) return { rate: 0, lag: null }
  const recent = samples.filter((s) => s.rx > last.rx - 5000)
  const first = recent[0] as Sample
  const spanS = (last.rx - first.rx) / 1000
  const rate = recent.length > 1 && spanS > 0 ? (recent.length - 1) / spanS : 0
  const lags = samples.slice(-20).map((s) => s.rx - s.ts).sort((a, b) => a - b)
  const lag = lags.length ? Math.max(0, Math.round(lags[Math.floor(lags.length / 2)] as number)) : null
  return { rate, lag }
}
