/**
 * carbonintensity.org.uk client (NESO + University of Oxford; free, keyless, CORS-enabled).
 * National: /intensity/{from}/fw48h (actual + forecast per half hour) and /generation (current mix).
 * Regional: /regional/intensity/{from}/fw48h/postcode/{outcode} (forecast + mix per half hour).
 * Replies are validated with zod; the last good snapshot is kept in localStorage for offline use.
 */
import { z } from 'zod'

const Intensity = z.object({ forecast: z.number().nullable(), actual: z.number().nullable().optional(), index: z.string() })
const MixItem = z.object({ fuel: z.string(), perc: z.number() })
const Slot = z.object({ from: z.string(), to: z.string(), intensity: Intensity, generationmix: z.array(MixItem).optional() })

const NationalWire = z.object({ data: z.array(Slot).min(1) })
const GenerationWire = z.object({ data: z.object({ from: z.string(), to: z.string(), generationmix: z.array(MixItem) }) })
const RegionalWire = z.object({
  data: z.object({ shortname: z.string(), postcode: z.string().optional(), data: z.array(Slot).min(1) }),
})

export interface Point { from: string; to: string; value: number; actual: boolean; index: string }
export interface MixEntry { fuel: string; perc: number }
export interface Snapshot {
  /** "GB" or the region's short name. */
  area: string
  postcode: string
  fetchedAt: string
  series: Point[]
  mix: MixEntry[]
  mixFrom: string
}

export const SnapshotSchema = z.object({
  area: z.string(),
  postcode: z.string(),
  fetchedAt: z.string(),
  series: z.array(z.object({ from: z.string(), to: z.string(), value: z.number(), actual: z.boolean(), index: z.string() })),
  mix: z.array(MixItem),
  mixFrom: z.string(),
})

const BASE = 'https://api.carbonintensity.org.uk'

/** ISO minute string the API accepts, floored to the half hour. */
export function halfHourIso(d = new Date()): string {
  const t = new Date(d)
  t.setUTCSeconds(0, 0)
  t.setUTCMinutes(t.getUTCMinutes() < 30 ? 0 : 30)
  return t.toISOString().slice(0, 16) + 'Z'
}

export const OUTCODE = /^[A-Z]{1,2}\d[A-Z\d]?$/

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) {
    if (res.status === 400) throw new FeedError('That postcode area was not recognised.', 'postcode')
    throw new FeedError(`The grid feed returned ${res.status}.`, 'upstream')
  }
  const body: unknown = await res.json()
  // Unknown postcodes can come back as 200 with an { error } body.
  if (body && typeof body === 'object' && 'error' in body) throw new FeedError('That postcode area was not recognised.', 'postcode')
  return body
}

export class FeedError extends Error {
  constructor(message: string, readonly kind: 'postcode' | 'upstream' | 'shape') { super(message) }
}

const toPoint = (s: z.infer<typeof Slot>): Point | null => {
  const actual = s.intensity.actual ?? null
  const value = actual ?? s.intensity.forecast
  return value === null ? null : { from: s.from, to: s.to, value, actual: actual !== null, index: s.intensity.index }
}

export async function fetchSnapshot(postcode: string, signal?: AbortSignal): Promise<Snapshot> {
  const from = halfHourIso()
  const now = Date.now()
  if (postcode) {
    const raw = await getJson(`${BASE}/regional/intensity/${from}/fw48h/postcode/${encodeURIComponent(postcode)}`, signal)
    // Unknown outcodes come back as a 200 with a null body.
    if (raw === null) throw new FeedError('That postcode area was not recognised.', 'postcode')
    const w = RegionalWire.safeParse(raw)
    if (!w.success) throw new FeedError('The regional feed sent an unexpected reply.', 'shape')
    const slots = w.data.data.data
    const current = slots.find((s) => Date.parse(s.from) <= now && now < Date.parse(s.to)) ?? slots[0]
    return {
      area: w.data.data.shortname,
      postcode,
      fetchedAt: new Date().toISOString(),
      series: slots.map(toPoint).filter((p): p is Point => p !== null),
      mix: current?.generationmix ?? [],
      mixFrom: current?.from ?? '',
    }
  }
  const [nat, gen] = await Promise.all([
    getJson(`${BASE}/intensity/${from}/fw48h`, signal),
    getJson(`${BASE}/generation`, signal).catch(() => null),
  ])
  const n = NationalWire.safeParse(nat)
  if (!n.success) throw new FeedError('The national feed sent an unexpected reply.', 'shape')
  const g = gen ? GenerationWire.safeParse(gen) : null
  return {
    area: 'GB',
    postcode: '',
    fetchedAt: new Date().toISOString(),
    series: n.data.data.map(toPoint).filter((p): p is Point => p !== null),
    mix: g?.success ? g.data.data.generationmix : [],
    mixFrom: g?.success ? g.data.data.from : '',
  }
}

/* ---------------- analysis ---------------- */

/**
 * Index of the half hour containing `now`. Before the series starts (clock skew) the first slot
 * is the next reading, so 0; once the series has run out it is -1 and nothing may be shown as "now".
 */
export function currentIndex(series: Point[], now = Date.now()): number {
  const i = series.findIndex((p) => Date.parse(p.from) <= now && now < Date.parse(p.to))
  if (i >= 0) return i
  const first = series[0]
  return first && now < Date.parse(first.from) ? 0 : -1
}

/** A snapshot older than one refresh cycle (plus slack) is labelled with its timestamp. */
export const STALE_MS = 35 * 60 * 1000
export const isStale = (s: Snapshot, now = Date.now()) => now - Date.parse(s.fetchedAt) > STALE_MS

export interface Window { start: number; end: number; avg: number }

/** Lowest-average contiguous window of `slots` half hours, starting at or after `from`. */
export function bestWindow(series: Point[], from: number, slots: number): { best: Window; now: Window } | null {
  const vals = series.slice(from).map((p) => p.value)
  if (vals.length < slots) return null
  let sum = vals.slice(0, slots).reduce((a, b) => a + b, 0)
  const nowAvg = sum / slots
  let bestSum = sum
  let bestAt = 0
  for (let i = slots; i < vals.length; i++) {
    sum += (vals[i] as number) - (vals[i - slots] as number)
    if (sum < bestSum - 1e-9) { bestSum = sum; bestAt = i - slots + 1 }
  }
  return {
    best: { start: from + bestAt, end: from + bestAt + slots - 1, avg: bestSum / slots },
    now: { start: from, end: from + slots - 1, avg: nowAvg },
  }
}

/* ---------------- formatting ---------------- */

const LONDON = 'Europe/London'
export function ukTime(iso: string, withDay = false): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON, hour: '2-digit', minute: '2-digit', hour12: false, ...(withDay ? { weekday: 'short' } : {}),
  }).format(d)
}
export function utcTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

export type Band = 'low' | 'moderate' | 'high'
export const bandOf = (index: string): Band =>
  index === 'very low' || index === 'low' ? 'low' : index === 'moderate' ? 'moderate' : 'high'
export const BAND_INK: Record<Band, string> = { low: 'var(--ok)', moderate: 'var(--warn)', high: 'var(--danger)' }
export const BAND_TONE = { low: 'ok', moderate: 'warn', high: 'danger' } as const
