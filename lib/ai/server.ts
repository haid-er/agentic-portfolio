/**
 * AI gateway: SERVER API. Owner: ai-gateway. STUB — the ai-gateway builder implements it.
 * Only /api/ai/* route handlers import this. Keys are read from process.env here and
 * never leave the server.
 *
 * Responsibilities (BRIEF 4):
 * - Provider router: groq -> gemini -> deepseek (only if content/ai.json enables it) with
 *   per-provider timeouts and failover; hard max_tokens clamp; per-instance DeepSeek budget.
 * - Per-IP rate limit (content/ai.json perIpPerMinute) + input caps (maxInputChars, image size).
 * - Per-demo gate: content/playground.json demo must be enabled.
 * - Structured output: JSON mode + validation against the request's JSON schema.
 * - Usage headers (AI_HEADERS) on every response.
 */
import 'server-only'
import type { AiErrorCode, AiMeta, AiObjectWireRequest, AiStatus, AiTextRequest, AiTextResult } from './types'

export interface GatewayContext {
  ip: string
  signal?: AbortSignal
}

export class GatewayError extends Error {
  constructor(readonly code: AiErrorCode, message: string, readonly status: number, readonly retryAfterSec?: number) {
    super(message)
  }
}

/** Best-effort client IP from Vercel / proxy headers. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? '0.0.0.0').trim()
}

/** STUB: always "unavailable" until the ai-gateway builder lands the router. */
export async function getStatus(): Promise<AiStatus> {
  return {
    available: false,
    providers: [],
    browserFallback: true,
    limits: { maxTokens: 0, maxInputChars: 0, perIpPerMinute: 0 },
  }
}

/** STUB: non-streaming completion (supports tools). */
export async function complete(_req: AiTextRequest, _ctx: GatewayContext): Promise<AiTextResult> {
  throw new GatewayError('unavailable', 'AI gateway not implemented yet', 503)
}

/** STUB: streaming completion; yields text chunks, returns meta. */
export async function* stream(_req: AiTextRequest, _ctx: GatewayContext): AsyncGenerator<string, AiMeta> {
  throw new GatewayError('unavailable', 'AI gateway not implemented yet', 503)
}

/** STUB: structured output (JSON), validated against req.jsonSchema. */
export async function completeObject(_req: AiObjectWireRequest, _ctx: GatewayContext): Promise<AiMeta & { object: unknown }> {
  throw new GatewayError('unavailable', 'AI gateway not implemented yet', 503)
}

/** JSON error response in the AiErrorBody shape. */
export function errorResponse(e: unknown): Response {
  const g = e instanceof GatewayError ? e : new GatewayError('upstream', 'Unexpected error', 502)
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (g.retryAfterSec) headers['retry-after'] = String(g.retryAfterSec)
  return new Response(JSON.stringify({ error: { code: g.code, message: g.message, retryAfterSec: g.retryAfterSec } }), {
    status: g.status,
    headers,
  })
}
