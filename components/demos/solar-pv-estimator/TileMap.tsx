'use client'
/**
 * A deliberately tiny slippy map (no map library): Web Mercator maths, OpenStreetMap
 * raster tiles as <img>, pointer drag to pan, tap/click to pick, buttons and keys to zoom.
 * Keyboard: arrows pan, + / - zoom, Enter picks the centre (crosshair shown on focus).
 * Tiles are toned into the current world with a CSS filter; if they fail (offline) the
 * graticule ground stays and the search / coordinate inputs still work.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Icon } from '@/components/ui'
import { cx } from '@/lib/utils'

export interface LatLon { lat: number; lon: number }

const TILE = 256
const MIN_Z = 2
const MAX_Z = 16
const MAX_LAT = 85.0511

const clampLat = (lat: number) => Math.max(-MAX_LAT, Math.min(MAX_LAT, lat))
const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180

export function project({ lat, lon }: LatLon, z: number) {
  const s = TILE * 2 ** z
  const r = (clampLat(lat) * Math.PI) / 180
  return { x: ((lon + 180) / 360) * s, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * s }
}
export function unproject(x: number, y: number, z: number): LatLon {
  const s = TILE * 2 ** z
  const n = Math.PI - (2 * Math.PI * y) / s
  return { lat: clampLat((180 / Math.PI) * Math.atan(Math.sinh(n))), lon: wrapLon((x / s) * 360 - 180) }
}

export function TileMap({ center, zoom, marker, onView, onPick, className }: {
  center: LatLon
  zoom: number
  marker: LatLon | null
  onView: (center: LatLon, zoom: number) => void
  onPick: (p: LatLon) => void
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [failed, setFailed] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [focused, setFocused] = useState(false)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean; id: number } | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const c = project(center, zoom)
  const left = c.x - size.w / 2
  const top = c.y - size.h / 2
  const n = 2 ** zoom
  const tiles: { key: string; src: string; x: number; y: number }[] = []
  if (size.w > 0) {
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty++) {
      if (ty < 0 || ty >= n) continue
      for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++) {
        const wx = ((tx % n) + n) % n
        tiles.push({ key: `${zoom}/${tx}/${ty}`, src: `https://tile.openstreetmap.org/${zoom}/${wx}/${ty}.png`, x: tx * TILE - left, y: ty * TILE - top })
      }
    }
  }

  const toLatLon = (px: number, py: number) => unproject(left + px, top + py, zoom)
  const setZoom = (z: number, anchor?: { px: number; py: number }) => {
    const nz = Math.max(MIN_Z, Math.min(MAX_Z, z))
    if (nz === zoom) return
    if (!anchor) { onView(center, nz); return }
    // Keep the point under the anchor fixed while zooming.
    const p = toLatLon(anchor.px, anchor.py)
    const pp = project(p, nz)
    onView(unproject(pp.x - anchor.px + size.w / 2, pp.y - anchor.py + size.h / 2, nz), nz)
  }
  const pan = (dx: number, dy: number) => onView(unproject(c.x + dx, c.y + dy, zoom), zoom)

  const local = (e: PointerEvent) => {
    const r = (box.current as HTMLDivElement).getBoundingClientRect()
    return { px: e.clientX - r.left, py: e.clientY - r.top }
  }
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, moved: false, id: e.pointerId }
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 6) return
    if (!d.moved) { d.moved = true; e.currentTarget.setPointerCapture(e.pointerId) }
    onView(unproject(d.cx - dx, d.cy - dy, zoom), zoom)
  }
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || d.moved || d.id !== e.pointerId) return
    const { px, py } = local(e)
    onPick(toLatLon(px, py))
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = 80
    const k = e.key
    if (k === 'ArrowLeft') pan(-step, 0)
    else if (k === 'ArrowRight') pan(step, 0)
    else if (k === 'ArrowUp') pan(0, -step)
    else if (k === 'ArrowDown') pan(0, step)
    else if (k === '+' || k === '=') setZoom(zoom + 1)
    else if (k === '-' || k === '_') setZoom(zoom - 1)
    else if (k === 'Enter' || k === ' ') onPick(center)
    else return
    e.preventDefault()
  }

  const m = marker ? project(marker, zoom) : null
  // Nearest wrapped copy of the marker so it stays visible after panning across the antimeridian.
  const mx = m ? m.x - left - Math.round((m.x - c.x) / (TILE * n)) * TILE * n : 0
  const my = m ? m.y - top : 0

  return (
    <div className={cx('relative', className)}>
      <div
        ref={box}
        role="application"
        aria-roledescription="map"
        aria-label="Map. Click or tap to choose a location. Arrow keys pan, plus and minus zoom, Enter picks the centre."
        tabIndex={0}
        onKeyDown={onKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => { drag.current = null }}
        onDoubleClick={(e) => { const { px, py } = local(e as unknown as PointerEvent); setZoom(zoom + 1, { px, py }) }}
        className="relative h-[260px] md:h-[340px] overflow-hidden bg-bg-2 border border-rule rounded-1 cursor-crosshair select-none touch-pan-y"
        style={{ backgroundImage: 'var(--pattern)' }}
      >
        <div aria-hidden="true" className="absolute inset-0 almanac:[filter:grayscale(1)_sepia(.4)_contrast(.92)_brightness(1.02)] strata:[filter:grayscale(1)_invert(.92)_sepia(.45)_brightness(.85)_contrast(1.1)]">
          {tiles.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element -- raw map tiles, next/image adds nothing here
            <img
              key={t.key}
              src={t.src}
              alt=""
              width={TILE}
              height={TILE}
              draggable={false}
              decoding="async"
              onError={() => setFailed((f) => f + 1)}
              onLoad={() => setLoaded((l) => l + 1)}
              className="absolute max-w-none"
              style={{ left: Math.round(t.x), top: Math.round(t.y), width: TILE, height: TILE }}
            />
          ))}
        </div>
        {m ? (
          <span aria-hidden="true" className="absolute -translate-x-1/2 -translate-y-1/2 text-accent-2 pointer-events-none" style={{ left: mx, top: my }}>
            <span className="absolute inset-0 -m-1 rounded-full bg-surface opacity-80" />
            <Icon name="register" size={30} className="relative" />
          </span>
        ) : null}
        {focused ? (
          <span aria-hidden="true" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-ink pointer-events-none">
            <Icon name="plus" size={28} />
          </span>
        ) : null}
        {failed > 0 && loaded === 0 ? (
          <p className="absolute inset-x-3 top-3 m-0 p-2 bg-surface border border-rule text-00 text-ink-2">
            Map tiles unavailable. Search or type coordinates instead.
          </p>
        ) : null}
      </div>
      <div className="absolute right-2 top-2 grid gap-1">
        <MapButton label="Zoom in" icon="plus" onClick={() => setZoom(zoom + 1)} disabled={zoom >= MAX_Z} />
        <MapButton label="Zoom out" icon="minus" onClick={() => setZoom(zoom - 1)} disabled={zoom <= MIN_Z} />
      </div>
      <p className="absolute left-0 bottom-0 m-0 px-2 py-0.5 bg-surface text-00 text-ink-2 border-t border-r border-rule">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap</a>
      </p>
    </div>
  )
}

function MapButton({ label, icon, onClick, disabled }: { label: string; icon: 'plus' | 'minus'; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid place-items-center size-11 bg-surface text-ink border border-rule rounded-0 hover:bg-bg-2 disabled:opacity-50"
    >
      <Icon name={icon} size={18} />
    </button>
  )
}
