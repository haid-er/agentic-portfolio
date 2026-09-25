/** /api/demos/lab/* — layered API lab routes. STUB — owner: demos-backend. */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  return Response.json({ error: 'not implemented' }, { status: 501 })
}
export const POST = GET
