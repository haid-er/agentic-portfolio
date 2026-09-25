/** POST /api/ai/object: AiObjectWireRequest -> AiObjectResult<unknown>. Owner: ai-gateway. */
import { admit, aiHeaders, clientIp, completeObject, errorResponse, readJson, GatewayError } from '@/lib/ai/server'
import { AiObjectWireSchema, describeIssues } from '@/lib/ai/wire'
import type { RateState } from '@/lib/ai/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request): Promise<Response> {
  let rate: RateState | undefined
  try {
    rate = admit(clientIp(req))
    const parsed = AiObjectWireSchema.safeParse(await readJson(req))
    if (!parsed.success) throw new GatewayError('bad_request', describeIssues(parsed.error), 400)
    const result = await completeObject(parsed.data, { ip: clientIp(req), signal: req.signal })
    return Response.json(result, { headers: aiHeaders(rate, result) })
  } catch (e) {
    return errorResponse(e, rate)
  }
}
