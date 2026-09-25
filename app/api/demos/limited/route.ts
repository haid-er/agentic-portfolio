/** GET /api/demos/limited — rate-limited edge endpoint (429 + RateLimit headers). STUB — owner: demos-backend. */
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  return Response.json({ ok: true })
}
