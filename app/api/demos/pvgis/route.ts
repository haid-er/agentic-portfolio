/**
 * GET /api/demos/pvgis?lat&lon&kwp[&loss][&angle&aspect]
 *
 * Server proxy to the EU JRC PVGIS "PVcalc" API (free, keyless, no CORS), used by the
 * solar-pv-estimator demo. It only ever calls one fixed host, validates and rounds input
 * (better cache hits, no arbitrary query passthrough), rate-limits per IP, trims the reply
 * to what the demo draws, and caches at the edge for a day (PVGIS is a long-term average).
 */
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const PVGIS = 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc'
const TIMEOUT_MS = 12_000
const PER_MINUTE = 20

const Query = z.object({
  lat: z.coerce.number().min(-65).max(72),
  lon: z.coerce.number().min(-180).max(180),
  kwp: z.coerce.number().min(0.1).max(100),
  loss: z.coerce.number().min(0).max(40).default(14),
  /** Omit angle and aspect to let PVGIS optimise both. */
  angle: z.coerce.number().min(0).max(90).optional(),
  /** PVGIS convention: 0 = south, -90 = east, 90 = west. */
  aspect: z.coerce.number().min(-180).max(180).optional(),
})

const Month = z.object({ month: z.number(), E_m: z.number(), 'H(i)_m': z.number().optional() })
const Wire = z.object({
  inputs: z.object({
    location: z.object({ latitude: z.number(), longitude: z.number(), elevation: z.number().nullable().optional() }),
    meteo_data: z.object({ radiation_db: z.string(), year_min: z.number(), year_max: z.number() }).partial(),
    mounting_system: z.object({
      fixed: z.object({
        slope: z.object({ value: z.number(), optimal: z.boolean().optional() }),
        azimuth: z.object({ value: z.number(), optimal: z.boolean().optional() }),
      }),
    }),
  }),
  outputs: z.object({
    monthly: z.object({ fixed: z.array(Month).length(12) }),
    totals: z.object({
      fixed: z.object({
        E_y: z.number(),
        'H(i)_y': z.number().optional(),
        SD_y: z.number().optional(),
        l_total: z.number().optional(),
      }),
    }),
  }),
})

export interface PvgisResult {
  lat: number
  lon: number
  elevation: number | null
  kwp: number
  loss: number
  slope: number
  azimuth: number
  optimal: boolean
  radiationDb: string
  years: string
  yearlyKwh: number
  yearlyIrradiation: number | null
  yearlySdKwh: number | null
  totalLossPct: number | null
  monthlyKwh: number[]
}

/* Best-effort per-instance limiter (serverless instances are short-lived; the edge cache does the heavy lifting). */
const hits = new Map<string, { n: number; reset: number }>()
function limited(ip: string): number {
  const now = Date.now()
  if (hits.size > 5000) hits.clear()
  const h = hits.get(ip)
  if (!h || h.reset < now) { hits.set(ip, { n: 1, reset: now + 60_000 }); return 0 }
  h.n += 1
  return h.n > PER_MINUTE ? Math.ceil((h.reset - now) / 1000) : 0
}

const err = (status: number, code: string, message: string, headers: Record<string, string> = {}) =>
  Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store', ...headers } })

export async function GET(req: Request): Promise<Response> {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'anon'
  const retry = limited(ip)
  if (retry) return err(429, 'rate_limited', 'Too many estimates in a minute. Try again shortly.', { 'retry-after': String(retry) })

  const url = new URL(req.url)
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return err(400, 'bad_request', 'Latitude, longitude or system size is out of range.')
  const q = parsed.data
  const optimal = q.angle === undefined || q.aspect === undefined

  const up = new URL(PVGIS)
  up.searchParams.set('lat', q.lat.toFixed(3))
  up.searchParams.set('lon', q.lon.toFixed(3))
  up.searchParams.set('peakpower', String(Math.round(q.kwp * 100) / 100))
  up.searchParams.set('loss', String(Math.round(q.loss)))
  up.searchParams.set('outputformat', 'json')
  if (optimal) up.searchParams.set('optimalangles', '1')
  else {
    up.searchParams.set('angle', String(Math.round(q.angle as number)))
    up.searchParams.set('aspect', String(Math.round(q.aspect as number)))
  }

  let res: Response
  try {
    res = await fetch(up, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 86_400 },
    })
  } catch {
    return err(504, 'upstream', 'PVGIS did not answer in time.')
  }

  if (!res.ok) {
    // PVGIS explains location problems ("Location over the sea…") in a JSON message.
    let message = `PVGIS returned ${res.status}.`
    try {
      const body = (await res.json()) as { message?: unknown }
      if (typeof body.message === 'string') message = body.message.slice(0, 200)
    } catch { /* keep the generic message */ }
    return err(res.status >= 500 ? 502 : 422, res.status >= 500 ? 'upstream' : 'location', message)
  }

  let json: unknown
  try { json = await res.json() } catch { return err(502, 'upstream', 'PVGIS sent an unreadable reply.') }
  const w = Wire.safeParse(json)
  if (!w.success) return err(502, 'upstream', 'PVGIS sent an unexpected reply.')

  const { inputs, outputs } = w.data
  const t = outputs.totals.fixed
  const md = inputs.meteo_data
  const out: PvgisResult = {
    lat: inputs.location.latitude,
    lon: inputs.location.longitude,
    elevation: inputs.location.elevation ?? null,
    kwp: Math.round(q.kwp * 100) / 100,
    loss: Math.round(q.loss),
    slope: inputs.mounting_system.fixed.slope.value,
    azimuth: inputs.mounting_system.fixed.azimuth.value,
    optimal,
    radiationDb: md.radiation_db ?? '',
    years: md.year_min && md.year_max ? `${md.year_min}–${md.year_max}` : '',
    yearlyKwh: t.E_y,
    yearlyIrradiation: t['H(i)_y'] ?? null,
    yearlySdKwh: t.SD_y ?? null,
    totalLossPct: t.l_total ?? null,
    monthlyKwh: outputs.monthly.fixed.map((m) => m.E_m),
  }
  return Response.json(out, {
    headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
  })
}
