/** GET /api/demos/pvgis?lat&lon&kwp — PVGIS proxy. STUB — owner: demos-esg-climate. */
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  return Response.json({ error: 'not implemented' }, { status: 501 })
}
