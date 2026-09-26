/**
 * GET /api/github: public activity for the profile handle, cached with ISR (6 h).
 * Same data the homepage "On GitHub" section renders; never includes private repos,
 * star counts or commit messages. On failure: 200 with `ok: false` (nothing estimated).
 */
import { getSite } from '@/lib/content'
import { makeExcluded, siteExcluded } from '@/lib/content/privacy'
import { getGitHubActivity } from '@/lib/github/server'

export const revalidate = 21600

export async function GET(): Promise<Response> {
  const data = await getGitHubActivity()
  if (!data.handle) return Response.json({ error: { code: 'not_found', message: 'No GitHub profile configured.' } }, { status: 404 })
  // Branch and tag names can carry client terms; drop any excluded ref (CONTRACTS 7).
  const isExcluded = makeExcluded(siteExcluded(getSite()))
  const events = data.events.map((e) => (e.ref && isExcluded(e.ref) ? { ...e, ref: '' } : e))
  return Response.json({ ...data, events }, {
    headers: { 'cache-control': `public, s-maxage=${revalidate}, stale-while-revalidate=86400` },
  })
}
