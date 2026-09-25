'use client'
/** Place search (Open-Meteo geocoding), quick presets, "use my location" and exact coordinates. */
import { useEffect, useId, useState } from 'react'
import { Button, Icon, controlClasses } from '@/components/ui'
import { cx } from '@/lib/utils'
import { geocode, type Place } from './pv'
import type { LatLon } from './TileMap'

const PRESETS: readonly (LatLon & { name: string })[] = [
  { name: 'London', lat: 51.507, lon: -0.128 },
  { name: 'Manchester', lat: 53.481, lon: -2.243 },
  { name: 'Edinburgh', lat: 55.953, lon: -3.188 },
  { name: 'Madrid', lat: 40.417, lon: -3.704 },
  { name: 'Lahore', lat: 31.558, lon: 74.351 },
]

export function PlaceSearch({ onPlace }: { onPlace: (p: LatLon, name: string) => void }) {
  const id = useId()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [geoMsg, setGeoMsg] = useState('')

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults(null); setState('idle'); return }
    const ac = new AbortController()
    const t = window.setTimeout(async () => {
      setState('loading')
      try {
        setResults(await geocode(term, ac.signal))
        setState('idle')
      } catch {
        if (!ac.signal.aborted) setState('error')
      }
    }, 350)
    return () => { ac.abort(); window.clearTimeout(t) }
  }, [q])

  const pick = (p: Place) => {
    onPlace({ lat: p.lat, lon: p.lon }, [p.name, p.detail].filter(Boolean).join(', '))
    setResults(null)
    setQ('')
  }

  const locate = () => {
    if (!('geolocation' in navigator)) { setGeoMsg('Location is not available in this browser.'); return }
    setGeoMsg('Asking your browser for a location…')
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeoMsg(''); onPlace({ lat: pos.coords.latitude, lon: pos.coords.longitude }, 'Your location') },
      () => setGeoMsg('Location permission was declined or unavailable.'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    )
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <label htmlFor={id} className="mono text-ink-2">Search a place</label>
        <div className="relative">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
          <input
            id={id}
            type="search"
            value={q}
            maxLength={80}
            autoComplete="off"
            placeholder="Town, city or postcode area"
            aria-describedby={`${id}-status`}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && results?.[0]) { e.preventDefault(); pick(results[0]) } }}
            className={cx(controlClasses, 'pl-10')}
          />
        </div>
        <p id={`${id}-status`} className="m-0 text-00 text-ink-3" aria-live="polite">
          {state === 'loading' ? 'Searching…'
            : state === 'error' ? 'Search is unavailable right now. Pick on the map or type coordinates.'
            : results && !results.length ? 'No places found.'
            : results ? `${results.length} result${results.length === 1 ? '' : 's'}. Enter picks the first.` : ''}
        </p>
        {results?.length ? (
          <ul className="m-0 p-0 list-none grid border border-rule rounded-0 bg-surface divide-y divide-rule-soft">
            {results.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => pick(r)} className="w-full min-h-tap px-3 py-2 text-left hover:bg-bg-2">
                  <span className="text-ink">{r.name}</span>
                  {r.detail ? <span className="text-0 text-ink-3"> · {r.detail}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p.name} variant="secondary" size="sm" onClick={() => onPlace(p, p.name)}>{p.name}</Button>
        ))}
        <Button variant="ghost" size="sm" icon="globe" onClick={locate}>My location</Button>
      </div>
      {geoMsg ? <p className="m-0 text-00 text-ink-3" aria-live="polite">{geoMsg}</p> : null}
    </div>
  )
}

/** Exact coordinates, committed on submit. */
export function CoordForm({ value, onSubmit }: { value: LatLon; onSubmit: (p: LatLon) => void }) {
  const [lat, setLat] = useState(value.lat.toFixed(3))
  const [lon, setLon] = useState(value.lon.toFixed(3))
  const [err, setErr] = useState('')
  useEffect(() => { setLat(value.lat.toFixed(3)); setLon(value.lon.toFixed(3)) }, [value.lat, value.lon])
  const latId = useId()
  const lonId = useId()
  return (
    <form
      className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"
      onSubmit={(e) => {
        e.preventDefault()
        const a = Number(lat)
        const b = Number(lon)
        if (!Number.isFinite(a) || !Number.isFinite(b) || a < -65 || a > 72 || b < -180 || b > 180) {
          setErr('Latitude must be between -65 and 72, longitude between -180 and 180.')
          return
        }
        setErr('')
        onSubmit({ lat: a, lon: b })
      }}
    >
      <div className="grid gap-1 min-w-0">
        <label htmlFor={latId} className="mono text-ink-2">Latitude</label>
        <input id={latId} inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} aria-invalid={Boolean(err) || undefined} aria-describedby={err ? `${latId}-e` : undefined} className={cx(controlClasses, 'nums')} />
      </div>
      <div className="grid gap-1 min-w-0">
        <label htmlFor={lonId} className="mono text-ink-2">Longitude</label>
        <input id={lonId} inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} aria-invalid={Boolean(err) || undefined} aria-describedby={err ? `${latId}-e` : undefined} className={cx(controlClasses, 'nums')} />
      </div>
      <Button type="submit" variant="secondary" size="sm">Go</Button>
      {err ? <p id={`${latId}-e`} className="col-span-3 m-0 flex items-center gap-1 text-0 text-danger"><Icon name="alert" size={16} />{err}</p> : null}
    </form>
  )
}
