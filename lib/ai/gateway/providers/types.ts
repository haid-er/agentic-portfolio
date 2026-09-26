import 'server-only'
import type { AiMessage, AiToolCall, AiToolDef, AiUsage } from '../../types'

/** One provider call, already normalised by the router. */
export interface ProviderCall {
  model: string
  /** All system text merged (request.system + system-role messages + JSON instructions). */
  system: string
  /** user/assistant turns only. */
  messages: AiMessage[]
  maxTokens: number
  temperature?: number
  tools?: AiToolDef[]
  /** Structured output: ask for JSON matching this schema. */
  json?: { name: string; schema: Record<string, unknown>; rootIsObject: boolean }
  signal: AbortSignal
}

export interface ProviderResult {
  text: string
  toolCalls?: AiToolCall[]
  usage: AiUsage
  model: string
}

export interface StreamEnd {
  usage: AiUsage
  model: string
}

export interface ProviderAdapter {
  complete(call: ProviderCall, key: string): Promise<ProviderResult>
  /** Yields raw text deltas (the router filters reasoning tags); returns usage. */
  stream(call: ProviderCall, key: string, idleMs: number): AsyncGenerator<string, StreamEnd>
}
