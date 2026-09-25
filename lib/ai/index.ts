/**
 * AI gateway: CLIENT API (browser-safe). Owner: ai-gateway. Demos code against this.
 *
 *   import { streamText, generateText, generateObject, useAI, getAiStatus, AiError } from '@/lib/ai'
 *
 *   // streamed chat
 *   const res = await streamText({ demo: 'ask-malik', messages }, { onToken: (t) => setText((s) => s + t), signal })
 *
 *   // structured output validated with zod (retry once on invalid output)
 *   const { object } = await generateObject({ demo: 'esg-gap-checker', messages, schema: Findings, schemaName: 'Findings' })
 *
 *   // vision
 *   await generateObject({ demo: 'org-chart-extractor', vision: true, messages: [{ role: 'user', content: [
 *     { type: 'text', text: 'Extract the org chart' }, { type: 'image', dataUrl } ] }], schema: OrgTree, schemaName: 'OrgTree' })
 *
 *   // in-browser fallback when the server says 'unavailable' / 'quota_exhausted'
 *   if (e instanceof AiError && isQuotaError(e)) showDemoQuotaMessage()
 *
 * Server side lives in lib/ai/server.ts (never import it from client code).
 * Embeddings for RAG demos: lib/ai/embeddings.ts (transformers.js, runs in the browser).
 */
import { useCallback, useRef, useState } from 'react'
import { z } from 'zod'
import {
  AiError,
  type AiErrorBody,
  type AiMeta,
  type AiObjectResult,
  type AiStatus,
  type AiTextRequest,
  type AiTextResult,
} from './types'

export * from './types'

const BASE = '/api/ai'

async function toError(res: Response): Promise<AiError> {
  let body: Partial<AiErrorBody> = {}
  try { body = (await res.json()) as AiErrorBody } catch { /* not json */ }
  const retry = Number(res.headers.get('retry-after')) || body.error?.retryAfterSec
  return new AiError(body.error?.code ?? (res.status === 429 ? 'rate_limited' : 'upstream'), body.error?.message ?? res.statusText, res.status, retry || undefined)
}

function wrapAbort(e: unknown): never {
  if (e instanceof DOMException && e.name === 'AbortError') throw new AiError('aborted', 'Request aborted')
  throw e
}

/** True when the demo should show its "demo quota reached" / in-browser fallback path. */
export const isQuotaError = (e: unknown): e is AiError =>
  e instanceof AiError && (e.code === 'quota_exhausted' || e.code === 'unavailable' || e.code === 'rate_limited')

/** One-shot text (also the only path that supports tools/toolCalls). */
export async function generateText(req: AiTextRequest, opts: { signal?: AbortSignal } = {}): Promise<AiTextResult> {
  try {
    const res = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...req, stream: false }),
      signal: opts.signal,
    })
    if (!res.ok) throw await toError(res)
    return (await res.json()) as AiTextResult
  } catch (e) { return wrapAbort(e) }
}

/** Streamed text over SSE. Resolves with the full text + meta when done. */
export async function streamText(
  req: Omit<AiTextRequest, 'tools'>,
  opts: { signal?: AbortSignal; onToken?: (chunk: string) => void } = {},
): Promise<AiTextResult> {
  try {
    const res = await fetch(`${BASE}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({ ...req, stream: true }),
      signal: opts.signal,
    })
    if (!res.ok || !res.body) throw await toError(res)
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    let buf = ''
    let text = ''
    let meta: AiMeta | null = null
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += value
      let i: number
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i)
        buf = buf.slice(i + 2)
        const ev = /^event: (.+)$/m.exec(block)?.[1]
        const data = /^data: (.*)$/m.exec(block)?.[1]
        if (!ev || data == null) continue
        if (ev === 'token') { const t = JSON.parse(data) as string; text += t; opts.onToken?.(t) }
        else if (ev === 'done') meta = JSON.parse(data) as AiMeta
        else if (ev === 'error') {
          const err = JSON.parse(data) as AiErrorBody['error']
          throw new AiError(err.code, err.message, 0, err.retryAfterSec)
        }
      }
    }
    if (!meta) throw new AiError('upstream', 'Stream ended without a result')
    return { ...meta, text }
  } catch (e) { return wrapAbort(e) }
}

/** Structured output: JSON-schema guided on the server, validated with zod here (1 retry). */
export async function generateObject<S extends z.ZodType>(
  req: AiTextRequest & { schema: S; schemaName: string },
  opts: { signal?: AbortSignal } = {},
): Promise<AiObjectResult<z.infer<S>>> {
  const { schema, schemaName, ...rest } = req
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>
  let lastIssue = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${BASE}/object`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...rest, schemaName, jsonSchema }),
        signal: opts.signal,
      })
      if (!res.ok) throw await toError(res)
      const body = (await res.json()) as AiObjectResult<unknown>
      const parsed = schema.safeParse(body.object)
      if (parsed.success) return { ...body, object: parsed.data as z.infer<S> }
      lastIssue = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    } catch (e) { wrapAbort(e) }
  }
  throw new AiError('invalid_output', `Model output did not match ${schemaName}: ${lastIssue}`, 502)
}

/** GET /api/ai/status (cached per page load). */
let statusPromise: Promise<AiStatus> | null = null
export function getAiStatus(): Promise<AiStatus> {
  statusPromise ??= fetch(`${BASE}/status`).then(async (r) => {
    if (!r.ok) throw await toError(r)
    return (await r.json()) as AiStatus
  }).catch((e) => { statusPromise = null; throw e })
  return statusPromise
}

export type AiRunStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error'

/**
 * React hook around streamText with abort + state.
 *   const ai = useAI('ask-malik'); ai.run(messages); ai.text / ai.status / ai.error / ai.abort()
 */
export function useAI(demo: AiTextRequest['demo']) {
  const [status, setStatus] = useState<AiRunStatus>('idle')
  const [text, setText] = useState('')
  const [error, setError] = useState<AiError | null>(null)
  const [meta, setMeta] = useState<AiMeta | null>(null)
  const ctrl = useRef<AbortController | null>(null)

  const abort = useCallback(() => { ctrl.current?.abort(); ctrl.current = null }, [])

  const run = useCallback(async (messages: AiTextRequest['messages'], extra: Partial<Omit<AiTextRequest, 'demo' | 'messages' | 'tools'>> = {}) => {
    abort()
    const c = new AbortController()
    ctrl.current = c
    setStatus('loading'); setText(''); setError(null); setMeta(null)
    try {
      const res = await streamText({ demo, messages, ...extra }, {
        signal: c.signal,
        onToken: (t) => { setStatus('streaming'); setText((s) => s + t) },
      })
      setMeta(res); setStatus('done')
      return res
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError('upstream', e instanceof Error ? e.message : String(e))
      if (err.code !== 'aborted') { setError(err); setStatus('error') } else setStatus('idle')
      return null
    }
  }, [abort, demo])

  return { run, abort, status, text, error, meta, busy: status === 'loading' || status === 'streaming' }
}
