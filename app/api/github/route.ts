/**
 * GET /api/github: public activity for the profile handle, cached with ISR (6 h).
 * Same data the homepage "On GitHub" section renders; never includes private repos,
 * star counts or commit messages. On failure: 200 with `ok: false` (nothing estimated).
 */
import { getGitHubActivity } from './activity'

export const revalidate = 21600

export async function GET(): Promise<Response> {
  const data = await getGitHubActivity()
  if (!data.handle) return Response.json({ error: { code: 'not_found', message: 'No GitHub profile configured.' } }, { status: 404 })
  return Response.json(data, {
    headers: { 'cache-control': `public, s-maxage=${revalidate}, stale-while-revalidate=86400` },
  })
}
