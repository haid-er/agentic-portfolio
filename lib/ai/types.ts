/**
 * AI gateway contract (shared by client, routes and demos). Owner: ai-gateway.
 * Demos NEVER call providers directly; they use lib/ai (client) -> /api/ai/* -> router.
 * Router order (BRIEF 4): groq -> gemini -> deepseek (off unless admin enables) -> browser fallback.
 */
import type { DemoSlug } from '@/lib/demos/slugs'
import type { ProviderId } from '@/lib/content/schema'

export type { ProviderId }
export type AiProvider = ProviderId | 'browser'

export type AiRole = 'system' | 'user' | 'assistant'
export type AiPart =
  | { type: 'text'; text: string }
  /** data:image/png;base64,… (<= 4 MB). Requires `vision: true`. */
  | { type: 'image'; dataUrl: string }

export interface AiMessage {
  role: AiRole
  content: string | AiPart[]
}

/** JSON-schema tool definition (mcp-tool-lab). */
export interface AiToolDef {
  name: string
  description: string
  /** JSON Schema (draft 2020-12 subset) for the arguments object. */
  parameters: Record<string, unknown>
}

export interface AiToolCall {
  id: string
  name: string
  arguments: unknown
}

export interface AiTextRequest {
  /** Which demo is calling (per-demo enable flag, logging, limits). */
  demo: DemoSlug
  messages: AiMessage[]
  system?: string
  /** Clamped server-side to content/ai.json maxTokens. */
  maxTokens?: number
  temperature?: number
  /** Route to a vision-capable model. */
  vision?: boolean
  /** Offer tools; the model may answer with toolCalls instead of text (non-streaming only). */
  tools?: AiToolDef[]
}

/** Wire body of POST /api/ai/object (client adds jsonSchema from the zod schema). */
export interface AiObjectWireRequest extends AiTextRequest {
  schemaName: string
  jsonSchema: Record<string, unknown>
}

export interface AiUsage {
  inputTokens: number
  outputTokens: number
}

export interface AiMeta {
  provider: AiProvider
  model: string
  usage: AiUsage
  latencyMs: number
}

export interface AiTextResult extends AiMeta {
  text: string
  toolCalls?: AiToolCall[]
}

export interface AiObjectResult<T> extends AiMeta {
  object: T
}

export type AiErrorCode =
  | 'rate_limited'      // 429: per-IP limit (Retry-After set)
  | 'input_too_large'   // 413: over maxInputChars / image size
  | 'quota_exhausted'   // 503: every provider failed or budget spent -> "demo quota reached"
  | 'unavailable'       // 503: no provider configured / demo disabled / gateway not built
  | 'invalid_output'    // 502: model output failed schema validation after retry
  | 'bad_request'       // 400: request failed validation
  | 'upstream'          // 502: provider error
  | 'aborted'           // client aborted

export interface AiErrorBody {
  error: { code: AiErrorCode; message: string; retryAfterSec?: number }
}

export class AiError extends Error {
  readonly code: AiErrorCode
  readonly status: number
  readonly retryAfterSec?: number
  constructor(code: AiErrorCode, message: string, status = 0, retryAfterSec?: number) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.status = status
    this.retryAfterSec = retryAfterSec
  }
}

/** GET /api/ai/status */
export interface AiStatus {
  /** true when at least one server provider can serve requests. */
  available: boolean
  providers: Array<{ id: ProviderId; enabled: boolean; configured: boolean; model: string }>
  browserFallback: boolean
  limits: { maxTokens: number; maxInputChars: number; perIpPerMinute: number }
}

/**
 * SSE events of POST /api/ai/chat with {stream:true}:
 *   event: token  data: "<json string chunk>"
 *   event: done   data: AiMeta
 *   event: error  data: AiErrorBody["error"]
 */
export type AiStreamEvent =
  | { event: 'token'; data: string }
  | { event: 'done'; data: AiMeta }
  | { event: 'error'; data: AiErrorBody['error'] }

/** Response headers set by every /api/ai/* route. */
export const AI_HEADERS = {
  provider: 'x-ai-provider',
  model: 'x-ai-model',
  limit: 'ratelimit-limit',
  remaining: 'ratelimit-remaining',
  reset: 'ratelimit-reset',
} as const
