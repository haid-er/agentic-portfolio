/**
 * POST /api/ai/chat: AiTextRequest & { stream?: boolean }. Owner: ai-gateway.
 * JSON AiTextResult, or SSE (event: token | done | error) when stream is true.
 */
import { admit, aiHeaders, complete, errorResponse, clientIp, openStream, readJson, GatewayError } from '@/lib/ai/server'
import { AiChatWireSchema, describeIssues } from '@/lib/ai/wire'
import type { RateState } from '@/lib/ai/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const enc = new TextEncoder()
const sse = (event: string, data: unknown) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

export async function POST(req: Request): Promise<Response> {
  let rate: RateState | undefined
  try {
    rate = admit(clientIp(req))
    const parsed = AiChatWireSchema.safeParse(await readJson(req))
    if (!parsed.success) throw new GatewayError('bad_request', describeIssues(parsed.error), 400)
    const { stream, ...body } = parsed.data
    const ctx = { ip: clientIp(req), signal: req.signal }

    if (!stream) {
      const result = await complete(body, ctx)
      return Response.json(result, { headers: aiHeaders(rate, result) })
    }

    const s = await openStream(body, ctx)
    const out = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const r = await s.chunks.next()
          if (r.done) {
            controller.enqueue(sse('done', r.value))
            controller.close()
          } else controller.enqueue(sse('token', r.value))
        } catch (e) {
          if (req.signal.aborted) return // client left; nothing to tell
          const g = e instanceof GatewayError ? e : new GatewayError('upstream', 'The provider stream broke off.', 502)
          try {
            controller.enqueue(sse('error', { code: g.code, message: g.message }))
            controller.close()
          } catch { /* stream already closed */ }
        }
      },
      cancel() {
        // return() alone would not run cleanup if the generator never started; close() always does.
        s.close()
        void s.chunks.return(undefined as never).catch(() => {})
      },
    })
    return new Response(out, {
      headers: {
        ...aiHeaders(rate, { provider: s.provider, model: s.model }),
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        'x-accel-buffering': 'no',
      },
    })
  } catch (e) {
    return errorResponse(e, rate)
  }
}
