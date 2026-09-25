/** GET /api/github — public activity for the profile handle (ISR 6h). STUB — owner: hero-about. */
export const revalidate = 21600

export async function GET(): Promise<Response> {
  return Response.json({ events: [], repos: [], fetchedAt: null })
}
