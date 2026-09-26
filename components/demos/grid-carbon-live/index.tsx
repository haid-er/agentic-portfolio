'use client'
/**
 * Grid carbon live: GB (or regional) grid carbon intensity now, the 48-hour forecast and the
 * current generation mix from carbonintensity.org.uk, plus the lowest-carbon window to run a
 * heat pump (or any shiftable load). Refreshes every 30 minutes while the tab is visible and
 * keeps the last good snapshot for offline use, always labelled with its timestamp.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, DemoGrid, DemoPanel, ErrorState, Loading, Segmented, Select, controlClasses } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage, usePageVisible } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import {
  BAND_TONE, FeedError, OUTCODE, SnapshotSchema, bandOf, bestWindow, currentIndex, fetchSnapshot, isStale, ukTime, utcTime,
  type Snapshot,
} from './api'
import { ForecastChart } from './Forecast'
import { MixStrip } from './Mix'

export { notes } from './notes'

const REFRESH_MS = 30 * 60 * 1000
const HOURS = [{ value: '1', label: '1 h' }, { value: '2', label: '2 h' }, { value: '3', label: '3 h' }, { value: '4', label: '4 h' }, { value: '6', label: '6 h' }] as const
type Hours = (typeof HOURS)[number]['value']
const KW = ['1', '1.5', '2', '3', '4', '5'] as const

type Load =
  | { status: 'loading'; snap: Snapshot | null }
  | { status: 'ok'; snap: Snapshot }
  | { status: 'error'; snap: Snapshot | null; message: string; kind: FeedError['kind'] }

const cacheKey = (pc: string) => `ghp:grid-carbon-live:snap:${pc || 'GB'}`
function readCache(pc: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(cacheKey(pc))
    if (!raw) return null
    const p = SnapshotSchema.safeParse(JSON.parse(raw))
    return p.success ? p.data : null
  } catch { return null }
}
function writeCache(s: Snapshot) {
  try { localStorage.setItem(cacheKey(s.postcode), JSON.stringify(s)) } catch { /* ignore */ }
}

export default function Demo(_props: DemoProps) {
  const visible = usePageVisible()
  const [postcode, setPostcode] = useLocalStorage<string>('grid-carbon-live:postcode', '')
  const [hours, setHours] = useLocalStorage<Hours>('grid-carbon-live:hours', '3')
  const [kw, setKw] = useLocalStorage<string>('grid-carbon-live:kw', '2')
  const [load, setLoad] = useState<Load>({ status: 'loading', snap: null })
  const [tick, setTick] = useState(0)
  const lastFetch = useRef(0)

  const pc = typeof postcode === 'string' && OUTCODE.test(postcode) ? postcode : ''

  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    const ac = new AbortController()
    const cached = readCache(pc)
    setLoad((l) => ({ status: 'loading', snap: l.snap && l.snap.postcode === pc ? l.snap : cached }))
    fetchSnapshot(pc, ac.signal)
      .then((snap) => {
        lastFetch.current = Date.now()
        writeCache(snap)
        setLoad({ status: 'ok', snap })
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return
        const fe = e instanceof FeedError ? e : new FeedError('Could not reach carbonintensity.org.uk.', 'upstream')
        setLoad({ status: 'error', snap: fe.kind === 'postcode' ? null : cached, message: fe.message, kind: fe.kind })
      })
    return () => ac.abort()
  }, [pc, tick])

  // Refresh every 30 minutes while visible, and on return to the tab if the data went stale.
  useEffect(() => {
    if (!visible) return
    if (lastFetch.current && Date.now() - lastFetch.current > REFRESH_MS) refresh()
    const id = window.setInterval(refresh, REFRESH_MS)
    return () => window.clearInterval(id)
  }, [visible, refresh])

  const snap = load.snap
  const offline = load.status === 'error' && snap !== null

  return (
    <div className="grid gap-4">
      <AreaForm value={pc} onApply={(v) => setPostcode(v)} busy={load.status === 'loading'} onRefresh={refresh} />

      {load.status === 'error' && !snap ? (
        <ErrorState
          title={load.kind === 'postcode' ? 'Postcode area not found' : 'Feed unavailable'}
          action={load.kind === 'postcode'
            ? <Button variant="secondary" size="sm" onClick={() => setPostcode('')}>Show all of GB</Button>
            : <Button variant="secondary" size="sm" icon="refresh" onClick={refresh}>Try again</Button>}
        >
          {load.message} {load.kind === 'postcode' ? 'Try the first half of a postcode, like M1 or EH1.' : 'Nothing is estimated.'}
        </ErrorState>
      ) : !snap ? (
        <Loading label="Reading the grid" />
      ) : (
        <Board snap={snap} offline={offline} loading={load.status === 'loading'} onRefresh={refresh} hours={hours} setHours={setHours} kw={kw} setKw={setKw} />
      )}
    </div>
  )
}

function AreaForm({ value, onApply, busy, onRefresh }: { value: string; onApply: (v: string) => void; busy: boolean; onRefresh: () => void }) {
  const [draft, setDraft] = useState(value)
  const [err, setErr] = useState('')
  useEffect(() => setDraft(value), [value])
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        const v = draft.trim().toUpperCase().split(/\s+/)[0] ?? ''
        if (v && !OUTCODE.test(v)) { setErr('Use the first half of a UK postcode, like M1, SW1A or EH1.'); return }
        setErr('')
        onApply(v)
      }}
    >
      <div className="grid gap-1 min-w-0 w-full xs:w-56">
        <label htmlFor="gcl-pc" className="mono text-ink-2">Postcode area (optional)</label>
        <input
          id="gcl-pc"
          value={draft}
          maxLength={8}
          autoComplete="postal-code"
          placeholder="All of GB"
          aria-invalid={Boolean(err) || undefined}
          aria-describedby="gcl-pc-hint"
          onChange={(e) => setDraft(e.target.value)}
          className={cx(controlClasses, 'uppercase')}
        />
      </div>
      <Button type="submit" variant="secondary" size="sm">Show</Button>
      {value ? <Button variant="ghost" size="sm" onClick={() => { setDraft(''); onApply('') }}>All of GB</Button> : null}
      <Button variant="ghost" size="sm" icon="refresh" onClick={onRefresh} disabled={busy} className="ml-auto">
        {busy ? 'Updating' : 'Refresh'}
      </Button>
      <p id="gcl-pc-hint" className={cx('m-0 w-full text-00', err ? 'text-danger' : 'text-ink-3')} role={err ? 'alert' : undefined}>
        {err || 'Only the outward code is sent (e.g. M1), to pick one of 14 DNO regions.'}
      </p>
    </form>
  )
}

function Board({ snap, offline, loading, onRefresh, hours, setHours, kw, setKw }: {
  snap: Snapshot
  offline: boolean
  loading: boolean
  onRefresh: () => void
  hours: Hours
  setHours: (h: Hours) => void
  kw: string
  setKw: (k: string) => void
}) {
  const nowIdx = currentIndex(snap.series)
  const now = nowIdx >= 0 ? snap.series[nowIdx] : undefined
  const slots = (Number(hours) || 3) * 2
  const win = useMemo(() => (nowIdx >= 0 ? bestWindow(snap.series, nowIdx, slots) : null), [snap.series, nowIdx, slots])
  const stale = offline || isStale(snap)
  const ahead = snap.series.slice(nowIdx)
  const lo = ahead.length ? ahead.reduce((a, b) => (b.value < a.value ? b : a)) : null
  const hi = ahead.length ? ahead.reduce((a, b) => (b.value > a.value ? b : a)) : null
  const area = snap.area === 'GB' ? 'Great Britain' : `${snap.area} (${snap.postcode})`

  if (nowIdx < 0 && snap.series.length) {
    return (
      <ErrorState
        title="Saved snapshot has expired"
        action={<Button variant="secondary" size="sm" icon="refresh" onClick={onRefresh} disabled={loading}>{loading ? 'Updating' : 'Try again'}</Button>}
      >
        The saved snapshot from <time dateTime={snap.fetchedAt}>{ukTime(snap.fetchedAt, true)} UK time</time> no longer covers the current half hour.
        {' '}{loading ? 'Fetching a fresh reading…' : 'Reconnect to refresh.'} Nothing is estimated.
      </ErrorState>
    )
  }
  if (!now) {
    return <ErrorState title="No readings in the feed">The grid feed answered without any half-hour readings. Nothing is estimated.</ErrorState>
  }
  return (
    <>
      <section aria-label="Current reading" className="grid gap-3 border-y border-rule py-3 md:grid-cols-[auto_1fr] md:items-end md:gap-8">
        <div>
          <p className="m-0 mono text-ink-3">{area} · now</p>
          <p className="m-0 flex flex-wrap items-baseline gap-x-3 nums leading-none">
            <span className="font-display text-5 text-ink">{now.value}</span>
            <span className="mono text-ink-2">gCO₂/kWh</span>
            <Badge tone={BAND_TONE[bandOf(now.index)]} className="uppercase">{now.index}</Badge>
          </p>
        </div>
        <div className="grid gap-1 text-0 text-ink-2">
          <p className="m-0">
            {now.actual ? 'Measured' : 'Forecast'} for {ukTime(now.from)}–{ukTime(now.to)} UK time · as of <time dateTime={now.from}>{utcTime(now.from)} UTC</time>
          </p>
          {lo && hi ? (
            <p className="m-0 nums">
              Next 48 h: low <strong className="text-ink">{lo.value}</strong> ({ukTime(lo.from, true)}), high <strong className="text-ink">{hi.value}</strong> ({ukTime(hi.from, true)})
            </p>
          ) : null}
          <p className="m-0 flex flex-wrap items-center gap-2 text-00 text-ink-3" aria-live="polite">
            {stale ? <Badge tone="warn">{offline ? 'Offline · ' : ''}Snapshot from {ukTime(snap.fetchedAt, true)} UK</Badge> : null}
            {loading ? <span>Updating…</span> : null}
            <span>
              Source:{' '}
              <a href="https://carbonintensity.org.uk/" target="_blank" rel="noopener noreferrer" className="underline decoration-rule-soft hover:text-ink">carbonintensity.org.uk</a>
            </span>
          </p>
        </div>
      </section>

      <DemoGrid
        aside={
          <>
            <DemoPanel title="Best time to run a heat pump">
              <HeatPumpHint win={win} series={snap.series} hours={hours} setHours={setHours} kw={kw} setKw={setKw} />
            </DemoPanel>
            <DemoPanel title="Generation mix" meta={snap.mixFrom ? `${utcTime(snap.mixFrom)} UTC` : undefined}>
              {snap.mix.length ? <MixStrip mix={snap.mix} /> : <p className="m-0 text-0 text-ink-3">The mix feed is unavailable right now. Nothing is estimated.</p>}
            </DemoPanel>
          </>
        }
      >
        <DemoPanel title="Next 48 hours" meta={`${snap.series.length} half hours`}>
          <ForecastChart series={snap.series} nowIdx={nowIdx} best={win?.best ?? null} bestLabel={`best ${hours} h`} />
        </DemoPanel>
      </DemoGrid>
    </>
  )
}

function HeatPumpHint({ win, series, hours, setHours, kw, setKw }: {
  win: ReturnType<typeof bestWindow>
  series: Snapshot['series']
  hours: Hours
  setHours: (h: Hours) => void
  kw: string
  setKw: (k: string) => void
}) {
  const h = Number(hours) || 3
  const power = Number(kw) || 2
  const kwh = h * power
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Segmented label="Run for" options={HOURS} value={hours} onChange={setHours} />
        <Select label="Electrical draw" value={kw} onChange={(e) => setKw(e.target.value)} wrapperClassName="w-32">
          {KW.map((k) => <option key={k} value={k}>{k} kW</option>)}
        </Select>
      </div>
      {!win ? (
        <p className="m-0 text-0 text-ink-3">The forecast is too short for a {h}-hour window.</p>
      ) : (
        <HintResult win={win} series={series} kwh={kwh} h={h} />
      )}
      <p className="m-0 text-00 text-ink-3">
        Heat pumps are most efficient running steadily, so the practical lever is shifting what can move: hot-water cycles and pre-heating before a high-carbon evening peak.
      </p>
    </div>
  )
}

function HintResult({ win, series, kwh, h }: { win: NonNullable<ReturnType<typeof bestWindow>>; series: Snapshot['series']; kwh: number; h: number }) {
  const start = series[win.best.start]
  const end = series[win.best.end]
  if (!start || !end) return null
  const isNow = win.best.start === win.now.start
  const saving = win.now.avg > 0 ? Math.round(((win.now.avg - win.best.avg) / win.now.avg) * 100) : 0
  const kgNow = (kwh * win.now.avg) / 1000
  const kgBest = (kwh * win.best.avg) / 1000
  return (
    <div className="grid gap-2" aria-live="polite">
      <p className="m-0 mono text-ink-3">{isNow ? 'Start' : 'Start at'}</p>
      <p className="m-0 font-display text-4 leading-none text-ink nums">
        {isNow ? 'Now' : ukTime(start.from, true)}
        <span className="mono text-0 text-ink-2"> → {ukTime(end.to)} UK</span>
      </p>
      <p className="m-0 text-0 text-ink-2 nums">
        {isNow ? (
          <>Starting now is already the lowest {h}-hour window in the forecast, averaging <strong className="text-ink">{Math.round(win.best.avg)} g/kWh</strong>.</>
        ) : (
          <>
            Averages <strong className="text-ink">{Math.round(win.best.avg)} g/kWh</strong> against {Math.round(win.now.avg)} if you start now:
            {' '}<strong className="text-accent-ink">{saving}% less carbon</strong>.
          </>
        )}
      </p>
      <dl className="m-0 grid grid-cols-2 gap-2 border-t border-rule-soft pt-2">
        <div>
          <dt className="mono text-ink-3">{kwh.toFixed(1)} kWh now</dt>
          <dd className="m-0 font-display text-2 nums text-ink">{kgNow.toFixed(2)} kg</dd>
        </div>
        <div>
          <dt className="mono text-ink-3">In best window</dt>
          <dd className="m-0 font-display text-2 nums text-ink">{kgBest.toFixed(2)} kg</dd>
        </div>
      </dl>
    </div>
  )
}
