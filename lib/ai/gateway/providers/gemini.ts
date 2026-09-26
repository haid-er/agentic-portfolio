/**
 * Google Gemini (native generateContent API). Native rather than the OpenAI shim so we
 * control thinking (it counts against maxOutputTokens), JSON-schema output and vision.
 */
import 'server-only'
import type { AiMessage, AiToolCall, AiUsage } from '../../types'
import { ProviderError } from '../errors'
import { parseDataUrl, postJson, safeJsonParse, sseData } from './http'
import type { ProviderAdapter, ProviderCall, ProviderResult, StreamEnd } from './types'

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

type GPart =
  | { text: string; thought?: boolean }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args?: unknown; id?: string } }

interface GResponse {
  candidates?: Array<{ content?: { parts?: GPart[] }; finishReason?: string }>
  promptFeedback?: { blockReason?: string }
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
  modelVersion?: string
}

function toContents(messages: AiMessage[]) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts:
      typeof m.content === 'string'
        ? [{ text: m.content }]
        : m.content.map((p) => (p.type === 'text' ? { text: p.text } : { inlineData: parseDataUrl(p.dataUrl) })),
  }))
}

/**
 * Keep thinking minimal so the answer fits under the admin token cap. Lite models accept
 * `minimal` (no thoughts); full 3.x Flash/Pro reject it, and even `low` spends roughly
 * 60-100 thought tokens, which count against maxOutputTokens (checked live 2026-09-26).
 */
function thinkingConfig(model: string): Record<string, unknown> | undefined {
  if (/gemini-2\.5-flash/i.test(model)) return { thinkingBudget: 0 }
  if (/gemini-2\.5-pro/i.test(model)) return { thinkingBudget: 128 }
  if (/gemini-\d{1,2}(\.\d)?-flash-lite/i.test(model)) return { thinkingLevel: 'minimal' }
  if (/gemini-(\d{1,2}(\.\d)?-|flash|pro)/i.test(model)) return { thinkingLevel: 'low' }
  return undefined
}

/** Thought tokens a model may spend on top of the answer (it cannot switch thinking off). */
const THINKING_HEADROOM = 256
function thinkingHeadroom(thinking: Record<string, unknown> | undefined): number {
  return thinking && thinking.thinkingLevel === 'low' ? THINKING_HEADROOM : thinking && typeof thinking.thinkingBudget === 'number' ? thinking.thinkingBudget : 0
}

function bodies(call: ProviderCall) {
  const generationConfig: Record<string, unknown> = { maxOutputTokens: call.maxTokens }
  if (call.temperature !== undefined) generationConfig.temperature = call.temperature
  if (call.json) generationConfig.responseMimeType = 'application/json'

  const base: Record<string, unknown> = { contents: toContents(call.messages), generationConfig }
  if (call.system) base.systemInstruction = { parts: [{ text: call.system }] }
  if (call.tools?.length) {
    base.tools = [{
      functionDeclarations: call.tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters })),
    }]
  }

  const thinking = thinkingConfig(call.model)
  // maxOutputTokens covers thoughts too: give thinking its own headroom so a small answer cap still gets an answer.
  const fullConfig: Record<string, unknown> = { ...generationConfig, maxOutputTokens: call.maxTokens + thinkingHeadroom(thinking) }
  if (thinking) fullConfig.thinkingConfig = thinking
  if (call.json) fullConfig.responseJsonSchema = call.json.schema
  return { full: { ...base, generationConfig: fullConfig }, base }
}

function usageOf(j: GResponse): AiUsage | null {
  const u = j.usageMetadata
  if (!u) return null
  return { inputTokens: u.promptTokenCount ?? 0, outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) }
}

function partsOf(j: GResponse): GPart[] {
  return j.candidates?.[0]?.content?.parts ?? []
}

function textOf(parts: GPart[]): string {
  return parts.map((p) => ('text' in p && !p.thought ? p.text : '')).join('')
}

function headers(key: string) {
  return { 'x-goog-api-key': key }
}

export const gemini: ProviderAdapter = {
  async complete(call, key): Promise<ProviderResult> {
    const { full, base } = bodies(call)
    const res = await postJson(`${BASE}/${encodeURIComponent(call.model)}:generateContent`, headers(key), full, call.signal, base)
    const j = (await res.json()) as GResponse
    const parts = partsOf(j)
    const toolCalls: AiToolCall[] = parts.flatMap((p, i) =>
      'functionCall' in p ? [{ id: p.functionCall.id ?? `call_${i}`, name: p.functionCall.name, arguments: p.functionCall.args ?? {} }] : [],
    )
    const text = textOf(parts)
    if (!text && !toolCalls.length) {
      const why = j.promptFeedback?.blockReason ?? j.candidates?.[0]?.finishReason ?? 'no candidates'
      throw new ProviderError('empty', `Empty completion (${why})`)
    }
    return {
      text,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: usageOf(j) ?? { inputTokens: 0, outputTokens: 0 },
      model: j.modelVersion ?? call.model,
    }
  },

  async *stream(call, key, idleMs): AsyncGenerator<string, StreamEnd> {
    const { full, base } = bodies(call)
    const url = `${BASE}/${encodeURIComponent(call.model)}:streamGenerateContent?alt=sse`
    const res = await postJson(url, { ...headers(key), accept: 'text/event-stream' }, full, call.signal, base)
    let usage: AiUsage | null = null
    let model = call.model
    for await (const data of sseData(res, call.signal, idleMs)) {
      const j = safeJsonParse(data) as GResponse | string
      if (typeof j === 'string') continue
      if (j.modelVersion) model = j.modelVersion
      usage = usageOf(j) ?? usage
      if (j.promptFeedback?.blockReason) throw new ProviderError('empty', `Blocked (${j.promptFeedback.blockReason})`)
      const t = textOf(partsOf(j))
      if (t) yield t
    }
    return { usage: usage ?? { inputTokens: 0, outputTokens: 0 }, model }
  },
}
