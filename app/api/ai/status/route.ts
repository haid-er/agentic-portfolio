/** GET /api/ai/status: AiStatus (+ this IP's rate-limit window; does not spend a request). Owner: ai-gateway. */
import { aiHeaders, clientIp, getStatus, rateFor } from '@/lib/ai/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  return Response.json(await getStatus(), { headers: aiHeaders(rateFor(clientIp(req))) })
}
