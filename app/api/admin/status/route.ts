/** GET /api/admin/status -> Activity (recent content commits + deploy state). Polled by the dashboard. Owner: admin-core. */
import { getActivity } from '@/lib/admin/activity'
import { getAdminSession, noStoreJson } from '@/lib/admin/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  if (!(await getAdminSession())) return noStoreJson({ ok: false, code: 'unauthorized', message: 'Sign in first.' }, { status: 401 })
  const fresh = new URL(req.url).searchParams.get('fresh') === '1'
  return noStoreJson({ ok: true, ...(await getActivity({ fresh })) })
}
