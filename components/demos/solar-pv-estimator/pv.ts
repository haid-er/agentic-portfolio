/**
 * Data access for the solar estimator.
 * - PVGIS goes through our own proxy (/api/demos/pvgis): PVGIS has no CORS and we cache at the edge.
 *   We always ask for a 1 kWp system with 0% loss. PVGIS output is linear in both peak power
 *   and system loss, so panel count, panel rating and losses rescale instantly in the browser
 *   and only location or orientation changes cost a request.
 * - Geocoding (Open-Meteo) and the UK live grid factor (carbonintensity.org.uk) are keyless and CORS-enabled.
 * Every successful PVGIS answer is kept in localStorage, so a revisited location works offline.
 */
import { z } from 'zod'

export const PvSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  elevation: z.number().nullable(),
  slope: z.number(),
  azimuth: z.number(),
  optimal: z.boolean(),
  radiationDb: z.string(),
  years: z.string(),
  yearlyKwh: z.number(),
  yearlyIrradiation: z.number().nullable(),
  yearlySdKwh: z.number().nullable(),
  totalLossPct: z.number().nullable(),
  monthlyKwh: z.array(z.number()).length(12),
})
export type PvBase = z.infer<typeof PvSchema>

export type Mounting = { kind: 'optimal' } | { kind: 'custom'; angle: number; aspect: number }

export const ORIENTATIONS = [
  { value: '0', label: 'South' },
  { value: '-45', label: 'South-east' },
  { value: '45', label: 'South-west' },
  { value: '-90', label: 'East' },
  { value: '90', label: 'West' },
  { value: '180', label: 'North' },
] as const

export class PvError extends Error {
  constructor(message: string, readonly kind: 'location' | 'rate' | 'network' | 'upstream') { super(message) }
}

const CACHE_KEY = 'ghp:solar-pv-estimator:cache'
const CACHE_MAX = 24

const round3 = (n: number) => Math.round(n * 1000) / 1000
const keyFor = (lat: number, lon: number, m: Mounting) =>
  `${round3(lat)},${round3(lon)},${m.kind === 'optimal' ? 'opt' : `${Math.round(m.angle)}/${Math.round(m.aspect)}`}`

function readCache(): Record<string, { at: number; data: PvBase }> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = z.record(z.string(), z.object({ at: z.number(), data: PvSchema })).safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : {}
  } catch { return {} }
}
function writeCache(key: string, data: PvBase) {
  try {
    const c = readCache()
    c[key] = { at: Date.now(), data }
    const keep = Object.entries(c).sort((a, b) => b[1].at - a[1].at).slice(0, CACHE_MAX)
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keep)))
  } catch { /* storage full or blocked: fine */ }
}

export interface PvFetch { data: PvBase; cachedAt: number | null }

export async function fetchPv(lat: number, lon: number, m: Mounting, signal?: AbortSignal): Promise<PvFetch> {
  const key = keyFor(lat, lon, m)
  const cached = readCache()[key]
  const qs = new URLSearchParams({ lat: String(round3(lat)), lon: String(round3(lon)), kwp: '1', loss: '0' })
  if (m.kind === 'custom') { qs.set('angle', String(Math.round(m.angle))); qs.set('aspect', String(Math.round(m.aspect))) }
  let res: Response
  try {
    res = await fetch(`/api/demos/pvgis?${qs}`, { signal })
  } catch (e) {
    if (signal?.aborted) throw e
    if (cached) return { data: cached.data, cachedAt: cached.at }
    throw new PvError('Could not reach the estimator. Check your connection.', 'network')
  }
  if (!res.ok) {
    let message = `The estimator returned ${res.status}.`
    try {
      const body = (await res.json()) as { error?: { message?: unknown } }
      if (typeof body.error?.message === 'string') message = body.error.message
    } catch { /* generic */ }
    if (res.status === 422 || res.status === 400) throw new PvError(message, 'location')
    if (cached) return { data: cached.data, cachedAt: cached.at }
    throw new PvError(message, res.status === 429 ? 'rate' : 'upstream')
  }
  const parsed = PvSchema.safeParse(await res.json())
  if (!parsed.success) throw new PvError('The estimator sent an unexpected reply.', 'upstream')
  writeCache(key, parsed.data)
  return { data: parsed.data, cachedAt: null }
}

/** Scale a 1 kWp / 0% loss PVGIS answer to the chosen array. */
export function scale(base: PvBase, kwp: number, lossPct: number) {
  const k = kwp * (1 - lossPct / 100)
  return {
    yearlyKwh: base.yearlyKwh * k,
    monthlyKwh: base.monthlyKwh.map((v) => v * k),
    specificYield: base.yearlyKwh * (1 - lossPct / 100),
    sdKwh: base.yearlySdKwh === null ? null : base.yearlySdKwh * k,
  }
}

/* ---------------- geocoding ---------------- */

const GeoSchema = z.object({
  results: z.array(z.object({
    id: z.number(),
    name: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    country: z.string().optional(),
    admin1: z.string().optional(),
  })).optional(),
})
export interface Place { id: number; name: string; detail: string; lat: number; lon: number }

export async function geocode(q: string, signal?: AbortSignal): Promise<Place[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.slice(0, 80))}&count=6&language=en&format=json`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Search returned ${res.status}`)
  const p = GeoSchema.safeParse(await res.json())
  if (!p.success) throw new Error('Unexpected search reply')
  return (p.data.results ?? []).map((r) => ({
    id: r.id, name: r.name, lat: r.latitude, lon: r.longitude,
    detail: [r.admin1, r.country].filter(Boolean).join(', '),
  }))
}

/* ---------------- UK live grid factor ---------------- */

const CiSchema = z.object({
  data: z.array(z.object({
    from: z.string(),
    intensity: z.object({ forecast: z.number().nullable(), actual: z.number().nullable(), index: z.string() }),
  })).min(1),
})
export interface LiveFactor { kgPerKwh: number; at: string; index: string }

export async function fetchUkLive(signal?: AbortSignal): Promise<LiveFactor> {
  const res = await fetch('https://api.carbonintensity.org.uk/intensity', { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Grid feed returned ${res.status}`)
  const p = CiSchema.safeParse(await res.json())
  if (!p.success) throw new Error('Unexpected grid reply')
  const d = p.data.data[0] as z.infer<typeof CiSchema>['data'][number]
  const g = d.intensity.actual ?? d.intensity.forecast
  if (g === null) throw new Error('No reading')
  return { kgPerKwh: g / 1000, at: d.from, index: d.intensity.index }
}

export const fmtCoord = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`
export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-GB')
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
