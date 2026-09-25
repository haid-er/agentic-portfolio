/**
 * OpenAI-compatible chat completions: Groq and DeepSeek speak this dialect.
 * Vision uses `image_url` parts with data URLs; tools use `function` tools.
 */
import 'server-only'
import type { AiMessage, AiToolCall, AiUsage } from '../../types'
import { ProviderError } from '../errors'
import { postJson, safeJsonParse, sseData } from './http'
import type { ProviderAdapter, ProviderCall, ProviderResult, StreamEnd } from './types'

type OaPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
type OaMessage = { role: 'system' | 'user' | 'assistant'; content: string | OaPart[] }

interface OaUsage { prompt_tokens?: number; completion_tokens?: number }
interface OaChoice {
  message?: { content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }
  delta?: { content?: string | null }
  finish_reason?: string | null
}
interface OaResponse { model?: string; choices?: OaChoice[]; usage?: OaUsage | null; x_groq?: { usage?: OaUsage } }

function toMessages(call: ProviderCall): OaMessage[] {
  const out: OaMessage[] = []
  if (call.system) out.push({ role: 'system', content: call.system })
  for (const m of call.messages) out.push(toMessage(m))
  return out
}

function toMessage(m: AiMessage): OaMessage {
  const role = m.role === 'assistant' ? 'assistant' : 'user'
  if (typeof m.content === 'string') return { role, content: m.content }
  if (role === 'assistant' || !m.content.some((p) => p.type === 'image')) {
    return { role, content: m.content.map((p) => (p.type === 'text' ? p.text : '')).join('\n') }
  }
  return {
    role,
    content: m.content.map((p): OaPart => (p.type === 'text' ? { type: 'text', text: p.text } : { type: 'image_url', image_url: { url: p.dataUrl } })),
  }
}

/** Reasoning models spend output tokens thinking; keep that small under a hard cap. */
function reasoningKnobs(model: string): Record<string, unknown> {
  if (/gpt-oss/i.test(model)) return { reasoning_effort: 'low', include_reasoning: false }
  if (/qwen3|qwq/i.test(model)) return { reasoning_effort: 'none' }
  if (/^deepseek/i.test(model)) return { reasoning_effort: 'low' }
  return {}
}

function usageOf(u: OaUsage | null | undefined): AiUsage | null {
  if (!u) return null
  return { inputTokens: u.prompt_tokens ?? 0, outputTokens: u.completion_tokens ?? 0 }
}

export function openAiCompatible(endpoint: string): ProviderAdapter {
  function bodies(call: ProviderCall, stream: boolean) {
    const base: Record<string, unknown> = {
      model: call.model,
      messages: toMessages(call),
      max_tokens: call.maxTokens,
      stream,
    }
    if (call.temperature !== undefined) base.temperature = call.temperature
    if (call.tools?.length) {
      base.tools = call.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }))
      base.tool_choice = 'auto'
    }
    const full: Record<string, unknown> = { ...base, ...reasoningKnobs(call.model) }
    if (call.json?.rootIsObject) full.response_format = { type: 'json_object' }
    if (stream) full.stream_options = { include_usage: true }
    return { full, base }
  }

  return {
    async complete(call, key): Promise<ProviderResult> {
      const { full, base } = bodies(call, false)
      const res = await postJson(endpoint, { authorization: `Bearer ${key}` }, full, call.signal, base)
      const j = (await res.json()) as OaResponse
      const msg = j.choices?.[0]?.message
      const toolCalls: AiToolCall[] | undefined = msg?.tool_calls?.map((t) => ({
        id: t.id,
        name: t.function.name,
        arguments: safeJsonParse(t.function.arguments || '{}'),
      }))
      const text = msg?.content ?? ''
      if (!text && !toolCalls?.length) throw new ProviderError('empty', `Empty completion (${j.choices?.[0]?.finish_reason ?? 'no choices'})`)
      return {
        text,
        toolCalls: toolCalls?.length ? toolCalls : undefined,
        usage: usageOf(j.usage ?? j.x_groq?.usage) ?? { inputTokens: 0, outputTokens: 0 },
        model: j.model ?? call.model,
      }
    },

    async *stream(call, key, idleMs): AsyncGenerator<string, StreamEnd> {
      const { full, base } = bodies(call, true)
      const res = await postJson(endpoint, { authorization: `Bearer ${key}`, accept: 'text/event-stream' }, full, call.signal, base)
      let usage: AiUsage | null = null
      let model = call.model
      for await (const data of sseData(res, call.signal, idleMs)) {
        if (data === '[DONE]') break
        const j = safeJsonParse(data) as OaResponse | string
        if (typeof j === 'string') continue
        if (j.model) model = j.model
        usage = usageOf(j.usage ?? j.x_groq?.usage) ?? usage
        const delta = j.choices?.[0]?.delta?.content
        if (delta) yield delta
      }
      return { usage: usage ?? { inputTokens: 0, outputTokens: 0 }, model }
    },
  }
}

export const groq = openAiCompatible('https://api.groq.com/openai/v1/chat/completions')
export const deepseek = openAiCompatible('https://api.deepseek.com/chat/completions')
