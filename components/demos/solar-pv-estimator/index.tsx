'use client'
/**
 * Solar PV estimator: choose a site (map, search, presets, GPS or coordinates), size an
 * array, and get the PVGIS long-term yearly yield through our server proxy, plus the CO₂
 * a year of that output would avoid at a grid factor you choose (UK live, UK annual or custom).
 */
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, DemoGrid, DemoPanel, ErrorState, Loading, Segmented, Select } from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage } from '@/lib/hooks'
import { Range } from './Range'
import { MonthlyBars, Provenance } from './Results'
import { CoordForm, PlaceSearch } from './Search'
import { TileMap, type LatLon } from './TileMap'
import {
  ORIENTATIONS, PvError, fetchPv, fetchUkLive, fmtCoord, fmtInt, scale,
  type LiveFactor, type Mounting, type PvBase,
} from './pv'

export { notes } from './notes'

type FactorMode = 'live' | 'annual' | 'custom'
type MountKind = 'optimal' | 'custom'
interface Setup {
  place: LatLon & { name: string }
  panels: number
  watts: number
  loss: number
  mount: MountKind
  tilt: number
  aspect: string
  factorMode: FactorMode
  customFactor: number
}

const DEFAULT: Setup = {
  place: { lat: 51.507, lon: -0.128, name: 'London' },
  panels: 10, watts: 430, loss: 14, mount: 'optimal', tilt: 35, aspect: '0', factorMode: 'annual', customFactor: 0.4,
}
/** Same rounded UK factor the GHG calculator uses. */
const UK_ANNUAL = 0.207

const MOUNT_OPTIONS = [{ value: 'optimal', label: 'Optimal' }, { value: 'custom', label: 'My roof' }] as const
const FACTOR_OPTIONS = [{ value: 'annual', label: 'UK annual' }, { value: 'live', label: 'UK live' }, { value: 'custom', label: 'Custom' }] as const

type Fetch =
  | { status: 'loading'; prev: PvBase | null }
  | { status: 'ok'; data: PvBase; cachedAt: number | null }
  | { status: 'error'; message: string; kind: PvError['kind'] }

function safeSetup(v: unknown): Setup {
  if (!v || typeof v !== 'object') return DEFAULT
  const s = { ...DEFAULT, ...(v as Partial<Setup>) }
  const p = s.place
  const okPlace = p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && typeof p.name === 'string'
  return { ...s, place: okPlace ? p : DEFAULT.place }
}

export default function Demo(_props: DemoProps) {
  const [raw, setRaw] = useLocalStorage<Setup>('solar-pv-estimator:setup', DEFAULT)
  const setup = safeSetup(raw)
  const set = (patch: Partial<Setup>) => setRaw((prev) => ({ ...safeSetup(prev), ...patch }))

  const [view, setView] = useState<{ center: LatLon; zoom: number }>({ center: setup.place, zoom: 5 })
  const [fetchState, setFetchState] = useState<Fetch>({ status: 'loading', prev: null })
  const [retry, setRetry] = useState(0)
  const [live, setLive] = useState<{ status: 'loading' } | { status: 'ok'; f: LiveFactor } | { status: 'error' }>({ status: 'loading' })

  const { lat, lon } = setup.place
  const mounting: Mounting = useMemo(
    () => (setup.mount === 'optimal' ? { kind: 'optimal' } : { kind: 'custom', angle: setup.tilt, aspect: Number(setup.aspect) }),
    [setup.mount, setup.tilt, setup.aspect],
  )

  // Location or orientation changed: ask PVGIS (debounced, abortable). Size and losses rescale locally.
  useEffect(() => {
    const ac = new AbortController()
    setFetchState((s) => ({ status: 'loading', prev: s.status === 'ok' ? s.data : s.status === 'loading' ? s.prev : null }))
    const t = window.setTimeout(async () => {
      try {
        const r = await fetchPv(lat, lon, mounting, ac.signal)
        setFetchState({ status: 'ok', data: r.data, cachedAt: r.cachedAt })
      } catch (e) {
        if (ac.signal.aborted) return
        const pe = e instanceof PvError ? e : new PvError('Something went wrong fetching the estimate.', 'upstream')
        setFetchState({ status: 'error', message: pe.message, kind: pe.kind })
      }
    }, 450)
    return () => { ac.abort(); window.clearTimeout(t) }
  }, [lat, lon, mounting, retry])

  useEffect(() => {
    const ac = new AbortController()
    fetchUkLive(ac.signal).then((f) => setLive({ status: 'ok', f })).catch(() => { if (!ac.signal.aborted) setLive({ status: 'error' }) })
    return () => ac.abort()
  }, [])

  // Keep the marker in view when the place changes from storage, search or coordinates.
  useEffect(() => {
    setView((v) => {
      const span = 360 / 2 ** v.zoom
      return Math.abs(v.center.lat - lat) > span / 2 || Math.abs(v.center.lon - lon) > span ? { ...v, center: { lat, lon } } : v
    })
  }, [lat, lon])

  const goTo = (p: LatLon, name: string, zoom?: number) => {
    set({ place: { lat: p.lat, lon: p.lon, name } })
    setView((v) => ({ center: p, zoom: zoom ?? Math.max(v.zoom, 9) }))
  }

  const kwp = (setup.panels * setup.watts) / 1000
  const factor =
    setup.factorMode === 'live' && live.status === 'ok' ? live.f.kgPerKwh
    : setup.factorMode === 'custom' ? setup.customFactor
    : UK_ANNUAL
  const base = fetchState.status === 'ok' ? fetchState.data : fetchState.status === 'loading' ? fetchState.prev : null

  return (
    <DemoGrid
      aside={
        <>
          <DemoPanel title="Estimated yield" meta={`${kwp.toFixed(2)} kWp`}>
            <ResultBody state={fetchState} base={base} kwp={kwp} loss={setup.loss} factor={factor} onRetry={() => setRetry((n) => n + 1)} />
          </DemoPanel>
          <DemoPanel title="Grid factor for CO₂ avoided">
            <div className="grid gap-3">
              <Segmented label="Displaced electricity" options={FACTOR_OPTIONS} value={setup.factorMode} onChange={(v: FactorMode) => set({ factorMode: v })} />
              {setup.factorMode === 'annual' ? (
                <p className="m-0 text-0 text-ink-2">UK grid annual average, {UK_ANNUAL} kgCO₂e/kWh (rounded, DESNZ-style). Suits UK sites.</p>
              ) : setup.factorMode === 'live' ? (
                live.status === 'ok' ? (
                  <p className="m-0 text-0 text-ink-2">
                    GB grid right now: <strong className="nums text-ink">{Math.round(live.f.kgPerKwh * 1000)} g/kWh</strong>{' '}
                    <Badge tone="neutral">{live.f.index}</Badge> as of {utcTime(live.f.at)} UTC. A single half-hour, so treat it as a what-if.
                  </p>
                ) : live.status === 'loading' ? <Loading label="Reading the grid" /> : (
                  <p className="m-0 text-0 text-danger" role="alert">Live grid feed unavailable. Falling back to the UK annual factor; nothing is estimated.</p>
                )
              ) : (
                <Range label="Custom factor" value={setup.customFactor} min={0} max={1} step={0.01}
                  format={(v) => `${v.toFixed(2)} kg/kWh`} onChange={(v) => set({ customFactor: v })}
                  hint="Use your country's published grid factor for non-UK sites." />
              )}
            </div>
          </DemoPanel>
        </>
      }
    >
      <DemoPanel title="Site" meta={fmtCoord(lat, lon)}>
        <div className="grid gap-4">
          <p className="m-0 flex flex-wrap items-baseline gap-x-2">
            <span className="mono text-ink-3">Selected</span>
            <span className="font-display text-2 text-ink [overflow-wrap:anywhere]">{setup.place.name || 'Pinned point'}</span>
          </p>
          <PlaceSearch onPlace={(p, name) => goTo(p, name)} />
          <TileMap
            center={view.center}
            zoom={view.zoom}
            marker={setup.place}
            onView={(center, zoom) => setView({ center, zoom })}
            onPick={(p) => set({ place: { lat: p.lat, lon: p.lon, name: 'Pinned point' } })}
          />
          <CoordForm value={setup.place} onSubmit={(p) => goTo(p, 'Pinned point')} />
        </div>
      </DemoPanel>

      <DemoPanel title="Array">
        <div className="grid gap-4 md:grid-cols-2">
          <Range label="Panels" value={setup.panels} min={1} max={40} onChange={(v) => set({ panels: v })} format={(v) => `${v}`} />
          <Range label="Panel rating" value={setup.watts} min={300} max={500} step={5} onChange={(v) => set({ watts: v })} format={(v) => `${v} W`} />
          <Range label="System losses" value={setup.loss} min={5} max={30} onChange={(v) => set({ loss: v })} format={(v) => `${v}%`}
            hint="Inverter, cabling, soiling. PVGIS suggests 14% for a typical system." />
          <div className="grid gap-3 content-start">
            <Segmented label="Mounting" options={MOUNT_OPTIONS} value={setup.mount} onChange={(v: MountKind) => set({ mount: v })} />
            {setup.mount === 'optimal' ? (
              <p className="m-0 text-00 text-ink-3">PVGIS picks the tilt and azimuth that maximise yearly yield here.</p>
            ) : null}
          </div>
          {setup.mount === 'custom' ? (
            <>
              <Range label="Roof tilt" value={setup.tilt} min={0} max={90} onChange={(v) => set({ tilt: v })} format={(v) => `${v}°`} />
              <Select label="Facing" value={setup.aspect} onChange={(e) => set({ aspect: e.target.value })}>
                {ORIENTATIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </>
          ) : null}
        </div>
      </DemoPanel>
    </DemoGrid>
  )
}

function ResultBody({ state, base, kwp, loss, factor, onRetry }: {
  state: Fetch
  base: PvBase | null
  kwp: number
  loss: number
  factor: number
  onRetry: () => void
}) {
  if (state.status === 'error') {
    return (
      <ErrorState title={state.kind === 'location' ? 'PVGIS cannot model this spot' : 'Estimate unavailable'}
        action={state.kind === 'location' ? undefined : <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>Try again</Button>}>
        {state.message} {state.kind === 'location' ? 'Pick a point on land.' : 'Nothing is estimated.'}
      </ErrorState>
    )
  }
  if (!base) return <Loading label="Asking PVGIS" />
  const r = scale(base, kwp, loss)
  const co2Kg = r.yearlyKwh * factor
  return (
    <div className="grid gap-4" aria-busy={state.status === 'loading'}>
      <div aria-live="polite" className={state.status === 'loading' ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <p className="m-0 mono text-ink-3">Per year</p>
        <p className="m-0 nums leading-none">
          <span className="font-display text-5 text-ink">{fmtInt(r.yearlyKwh)}</span> <span className="mono text-ink-2">kWh</span>
        </p>
        <p className="m-0 mt-1 text-0 text-ink-2 nums">
          {fmtInt(r.specificYield)} kWh per kWp
          {r.sdKwh !== null ? <> · ±{fmtInt(r.sdKwh)} kWh year to year</> : null}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 border-y border-rule py-3">
        <div>
          <p className="m-0 mono text-ink-3">CO₂e avoided / yr</p>
          <p className="m-0 font-display text-3 nums text-accent-ink">
            {co2Kg >= 1000 ? `${(co2Kg / 1000).toFixed(2)} t` : `${fmtInt(co2Kg)} kg`}
          </p>
        </div>
        <div>
          <p className="m-0 mono text-ink-3">At factor</p>
          <p className="m-0 font-display text-3 nums text-ink">{factor.toFixed(3)}</p>
          <p className="m-0 text-00 text-ink-3">kgCO₂e / kWh</p>
        </div>
      </div>
      <MonthlyBars monthly={r.monthlyKwh} />
      <Provenance base={base} />
      <p className="m-0 text-00 text-ink-3" aria-live="polite">
        {state.status === 'loading' ? 'Updating from PVGIS…'
          : state.status === 'ok' && state.cachedAt ? `Offline: showing the saved PVGIS result from ${new Date(state.cachedAt).toLocaleString('en-GB')}.`
          : 'Source: PVGIS (EU JRC), long-term average, via this site’s proxy.'}
      </p>
    </div>
  )
}

function utcTime(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

