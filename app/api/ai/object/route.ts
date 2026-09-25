/** POST /api/ai/object — AiObjectWireRequest -> AiObjectResult. STUB (owner: ai-gateway). */
import { errorResponse, GatewayError } from '@/lib/ai/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(): Promise<Response> {
  return errorResponse(new GatewayError('unavailable', 'AI gateway not implemented yet', 503))
}
