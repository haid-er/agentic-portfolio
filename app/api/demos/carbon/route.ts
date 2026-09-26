/**
 * GET /api/demos/carbon?path=/intensity/<iso>/fw48h | /generation | /regional/intensity/<iso>/fw48h/postcode/<outcode>
 *
 * Fallback proxy for the grid-carbon-live demo. The demo reads carbonintensity.org.uk
 * straight from the browser (the API allows CORS); when that request fails (a network
 * that blocks the host, a TLS-intercepting proxy, a flaky connection) it retries here.
 * Only those three path shapes on one fixed host are forwarded, the reply is passed
 * through unchanged (the demo validates it with Zod), a best-effort per-IP limit applies,
 * and replies are cached for 15 minutes (the feed updates every half hour).
 */
export const dynamic = 'force-dynamic'

const HOST = 'https://api.carbonintensity.org.uk'
const TIMEOUT_MS = 10_000
const PER_MINUTE = 30

const ISO = String.raw`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z`
const ALLOWED = [
  new RegExp(`^/intensity/${ISO}/fw48h$`),
  /^\/generation$/,
  new RegExp(`^/regional/intensity/${ISO}/fw48h/postcode/[A-Z]{1,2}\\d[A-Z\\d]?$`),
]

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
  if (retry) return err(429, 'rate_limited', 'Too many grid readings in a minute. Try again shortly.', { 'retry-after': String(retry) })

  const path = new URL(req.url).searchParams.get('path') ?? ''
  if (!ALLOWED.some((re) => re.test(path))) return err(400, 'bad_request', 'Unsupported grid feed path.')

  let res: Response
  try {
    res = await fetch(`${HOST}${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 900 },
    })
  } catch {
    return err(504, 'upstream', 'carbonintensity.org.uk did not answer in time.')
  }
  if (!res.ok) return err(res.status === 400 ? 400 : 502, res.status === 400 ? 'bad_request' : 'upstream', `The grid feed returned ${res.status}.`)
  let body: unknown
  try { body = await res.json() } catch { return err(502, 'upstream', 'The grid feed sent an unreadable reply.') }
  return Response.json(body, { headers: { 'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=3600' } })
}
