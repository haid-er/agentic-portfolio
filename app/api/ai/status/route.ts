/** GET /api/ai/status — AiStatus. STUB (owner: ai-gateway). */
import { getStatus } from '@/lib/ai/server'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  return Response.json(await getStatus())
}
