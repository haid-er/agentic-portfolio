/** GET/POST /api/demos/items — paginated demo API for the query-cache lab. STUB — owner: demos-realtime-chat. */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  return Response.json({ items: [], page: 1, pageCount: 0 })
}
