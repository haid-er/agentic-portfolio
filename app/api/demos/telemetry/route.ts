/** GET /api/demos/telemetry — SSE stream of simulated metrics. STUB — owner: demos-realtime. */
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  return new Response('event: done\ndata: {}\n\n', { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' } })
}
