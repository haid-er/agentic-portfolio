/**
 * AI gateway: CLIENT API (browser-safe). Owner: ai-gateway. Demos code against this.
 *
 *   import { streamText, generateText, generateObject, useAI, getAiStatus, AiError } from '@/lib/ai'
 *
 *   // streamed chat
 *   const res = await streamText({ demo: 'ask-malik', messages }, { onToken: (t) => setText((s) => s + t), signal })
 *
 *   // structured output validated with zod (server repairs once, client retries once)
 *   const { object } = await generateObject({ demo: 'esg-gap-checker', messages, schema: Findings, schemaName: 'Findings' })
 *
 *   // vision (downscale first: Vercel caps request bodies at 4.5 MB)
 *   const dataUrl = await imageToDataUrl(file)
 *   await generateObject({ demo: 'org-chart-extractor', vision: true, messages: [{ role: 'user', content: [
 *     { type: 'text', text: 'Extract the org chart' }, { type: 'image', dataUrl } ] }], schema: OrgTree, schemaName: 'OrgTree' })
 *
 *   // React: streaming state + honest fallback
 *   const ai = useAI('ask-malik', { system })
 *   ai.run(messages)            // ai.text streams in; ai.meta.route shows groq -> gemini -> ...
 *   if (ai.fallback) <button onClick={() => ai.runInBrowser()}>Run a small model on this device</button>
 *
 * Server side lives in lib/ai/server.ts (never import it from client code).
 * In-browser generation: lib/ai/browser.ts (loaded lazily by useAI().runInBrowser).
 * Embeddings for RAG demos: lib/ai/embeddings.ts (transformers.js, runs in the browser).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import {
  AI_HEADERS,
  AI_LIMITS,
  AiError,
  type AiErrorBody,
  type AiErrorCode,
  type AiMeta,
  type AiObjectResult,
  type AiRateLimit,
  type AiStatus,
  type AiTextRequest,
  type AiTextResult,
} from './types'

export * from './types'

const BASE = '/api/ai'

/* ------------------------------------------------------------------ */
/* transport                                                            */
/* ------------------------------------------------------------------ */

function readRate(res: Response): AiRateLimit | undefined {
  const limit = Number(res.headers.get(AI_HEADERS.limit))
  if (!limit) return undefined
  return {
    limit,
    remaining: Number(res.headers.get(AI_HEADERS.remaining)) || 0,
    resetSec: Number(res.headers.get(AI_HEADERS.reset)) || 0,
  }
}

async function toError(res: Response): Promise<AiError> {
  let body: Partial<AiErrorBody> = {}
  try { body = (await res.json()) as AiErrorBody } catch { /* not json */ }
  const retry = Number(res.headers.get('retry-after')) || body.error?.retryAfterSec
  const fallbackCode: AiErrorCode = res.status === 429 ? 'rate_limited' : res.status === 413 ? 'input_too_large' : res.status >= 500 ? 'unavailable' : 'upstream'
  return new AiError(body.error?.code ?? fallbackCode, body.error?.message ?? (res.statusText || 'AI request failed'), res.status, retry || undefined)
}

function isAbort(e: unknown): boolean {
  return (e instanceof DOMException || e instanceof Error) && e.name === 'AbortError'
}

/** Normalise anything thrown into an AiError (network failures read as `unavailable`). */
function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e
  if (isAbort(e)) return new AiError('aborted', 'Request aborted')
  if (e instanceof TypeError) return new AiError('unavailable', 'Could not reach the AI gateway (offline?)')
  return new AiError('upstream', e instanceof Error ? e.message : String(e))
}

function post(path: string, body: unknown, signal?: AbortSignal, accept = 'application/json') {
  return fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept },
    body: JSON.stringify(body),
    signal,
  })
}

/** True when the demo should show its "demo quota reached" / in-browser fallback path. */
export const isQuotaError = (e: unknown): e is AiError =>
  e instanceof AiError && (e.code === 'quota_exhausted' || e.code === 'unavailable' || e.code === 'rate_limited')

/** A short, honest sentence for an AI error (demos may show e.message instead). */
export function aiErrorMessage(e: unknown): string {
  const err = toAiError(e)
  switch (err.code) {
    case 'rate_limited': return err.retryAfterSec ? `Too many requests. Try again in ${err.retryAfterSec}s.` : 'Too many requests. Try again in a minute.'
    case 'quota_exhausted': return 'Demo quota reached: the free AI providers are busy right now.'
    case 'unavailable': return 'AI is unavailable right now.'
    case 'input_too_large': return err.message || 'That input is too large for this demo.'
    case 'invalid_output': return 'The model answered in the wrong shape. Try again.'
    case 'aborted': return 'Stopped.'
    default: return err.message || 'Something went wrong upstream.'
  }
}

/* ------------------------------------------------------------------ */
/* one-shot, streaming, structured                                      */
/* ------------------------------------------------------------------ */

/** One-shot text (also the only path that supports tools/toolCalls). */
export async function generateText(req: AiTextRequest, opts: { signal?: AbortSignal } = {}): Promise<AiTextResult> {
  try {
    const res = await post('chat', { ...req, stream: false }, opts.signal)
    if (!res.ok) throw await toError(res)
    const body = (await res.json()) as AiTextResult
    return { ...body, rateLimit: readRate(res) }
  } catch (e) { throw toAiError(e) }
}

/** Streamed text over SSE. Resolves with the full text + meta when done. */
export async function streamText(
  req: Omit<AiTextRequest, 'tools'>,
  opts: { signal?: AbortSignal; onToken?: (chunk: string) => void } = {},
): Promise<AiTextResult> {
  try {
    const res = await post('chat', { ...req, stream: true }, opts.signal, 'text/event-stream')
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
    if (!meta) throw new AiError('upstream', 'The stream ended early')
    return { ...meta, text, rateLimit: readRate(res) }
  } catch (e) { throw toAiError(e) }
}

/** Structured output: JSON-schema guided on the server, validated with zod here (1 retry). */
export async function generateObject<S extends z.ZodType>(
  req: AiTextRequest & { schema: S; schemaName: string },
  opts: { signal?: AbortSignal } = {},
): Promise<AiObjectResult<z.infer<S>>> {
  const { schema, schemaName, tools: _tools, ...rest } = req // tools are ignored for structured output
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>
  let lastIssue = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response
    try {
      res = await post('object', { ...rest, schemaName, jsonSchema }, opts.signal)
    } catch (e) { throw toAiError(e) }
    if (!res.ok) {
      const err = await toError(res)
      if (err.code === 'invalid_output' && attempt === 0) { lastIssue = err.message; continue }
      throw err
    }
    const body = (await res.json()) as AiObjectResult<unknown>
    const parsed = schema.safeParse(body.object)
    if (parsed.success) return { ...body, object: parsed.data as z.infer<S>, rateLimit: readRate(res) }
    lastIssue = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
  }
  throw new AiError('invalid_output', `Model output did not match ${schemaName}: ${lastIssue}`, 502)
}

/** GET /api/ai/status (cached per page load; failures are not cached). */
let statusPromise: Promise<AiStatus> | null = null
export function getAiStatus(opts: { fresh?: boolean } = {}): Promise<AiStatus> {
  if (opts.fresh) statusPromise = null
  statusPromise ??= fetch(`${BASE}/status`, { cache: 'no-store' }).then(async (r) => {
    if (!r.ok) throw await toError(r)
    return (await r.json()) as AiStatus
  }).catch((e) => { statusPromise = null; throw toAiError(e) })
  return statusPromise
}

/* ------------------------------------------------------------------ */
/* images                                                               */
/* ------------------------------------------------------------------ */

/**
 * Downscale an image file to a JPEG/WebP data URL that fits the gateway caps
 * (longest side `maxSide`, decoded size under 4 MB and the 4.5 MB request body).
 */
export async function imageToDataUrl(
  file: Blob,
  opts: { maxSide?: number; type?: 'image/jpeg' | 'image/webp'; quality?: number } = {},
): Promise<string> {
  const { maxSide = 1600, type = 'image/jpeg' } = opts
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new AiError('bad_request', 'Canvas is not available in this browser')
  ctx.fillStyle = '#fff' // flatten transparency for JPEG
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const budget = Math.min(AI_LIMITS.maxImageBytes, AI_LIMITS.maxBodyBytes * 0.7) * (4 / 3) // base64 chars
  for (let q = opts.quality ?? 0.85; q >= 0.4; q -= 0.15) {
    const url = canvas.toDataURL(type, q)
    if (url.length < budget) return url
  }
  throw new AiError('input_too_large', 'Image is too large even after downscaling. Try a smaller one.', 413)
}

/* ------------------------------------------------------------------ */
/* useAI                                                                */
/* ------------------------------------------------------------------ */

export type AiRunStatus = 'idle' | 'loading' | 'streaming' | 'done' | 'error'

type RunExtra = Partial<Omit<AiTextRequest, 'demo' | 'messages' | 'tools'>>

export interface UseAIOptions extends RunExtra {
  /** Allow runInBrowser() when the server is out of quota (admin's ai.browserFallback also applies). Default true. */
  browserFallback?: boolean
}

/**
 * React hook around streamText with abort, state and an honest fallback path.
 *
 *   const ai = useAI('ask-malik', { system })
 *   ai.run(messages)          -> ai.text streams; ai.status: idle | loading | streaming | done | error
 *   ai.error / ai.retryIn     -> AiError + live countdown after a 429
 *   ai.fallback               -> true when the server is out of quota and in-browser generation is allowed
 *   ai.runInBrowser()         -> re-run the last messages on a small local model (ai.loadProgress 0..1)
 *   ai.meta                   -> provider, model, usage, latency, route, rateLimit
 */
export function useAI(demo: AiTextRequest['demo'], options: UseAIOptions = {}) {
  const [status, setStatus] = useState<AiRunStatus>('idle')
  const [text, setText] = useState('')
  const [error, setError] = useState<AiError | null>(null)
  const [meta, setMeta] = useState<AiMeta | null>(null)
  const [retryIn, setRetryIn] = useState<number | null>(null)
  const [loadProgress, setLoadProgress] = useState<number | null>(null)
  const [browserAllowed, setBrowserAllowed] = useState<boolean | null>(null)

  const ctrl = useRef<AbortController | null>(null)
  const last = useRef<{ messages: AiTextRequest['messages']; extra: RunExtra } | null>(null)
  const opts = useRef(options)
  opts.current = options

  const mounted = useRef(false)

  // Silently cancel whatever is in flight (used before a new run and on unmount).
  const cancelInFlight = useCallback(() => { ctrl.current?.abort(); ctrl.current = null }, [])

  // User-facing Stop: cancel and return the UI to idle (the superseded run's catch is ignored).
  const abort = useCallback(() => {
    const had = ctrl.current
    cancelInFlight()
    if (!had || !mounted.current) return
    setStatus((s) => (s === 'loading' || s === 'streaming' ? 'idle' : s))
    setLoadProgress(null)
  }, [cancelInFlight])

  // Abort on unmount; never set state on an unmounted demo.
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; cancelInFlight() }
  }, [cancelInFlight])

  // Live countdown after a rate limit.
  useEffect(() => {
    if (!retryIn) return
    const id = setTimeout(() => setRetryIn((s) => (s && s > 1 ? s - 1 : null)), 1000)
    return () => clearTimeout(id)
  }, [retryIn])

  const begin = useCallback(() => {
    cancelInFlight()
    const c = new AbortController()
    ctrl.current = c
    setStatus('loading'); setText(''); setError(null); setMeta(null); setRetryIn(null)
    return c
  }, [cancelInFlight])

  const fail = useCallback((e: unknown, c: AbortController) => {
    if (ctrl.current !== c) return // superseded by a newer run
    const err = toAiError(e)
    if (err.code === 'aborted') { setStatus('idle'); return }
    setError(err); setStatus('error')
    if (err.retryAfterSec) setRetryIn(err.retryAfterSec)
    if (isQuotaError(err)) {
      getAiStatus().then((s) => setBrowserAllowed(s.browserFallback)).catch(() => setBrowserAllowed(true))
    }
  }, [])

  const run = useCallback(async (messages: AiTextRequest['messages'], extra: RunExtra = {}): Promise<AiTextResult | null> => {
    const { browserFallback: _bf, ...defaults } = opts.current
    const merged = { ...defaults, ...extra }
    last.current = { messages, extra: merged }
    const c = begin()
    try {
      const res = await streamText({ demo, messages, ...merged }, {
        signal: c.signal,
        onToken: (t) => {
          if (ctrl.current !== c) return
          setStatus('streaming'); setText((s) => s + t)
        },
      })
      if (ctrl.current !== c) return null
      setMeta(res); setStatus('done')
      return res
    } catch (e) {
      fail(e, c)
      return null
    }
  }, [begin, demo, fail])

  const runInBrowser = useCallback(async (messages?: AiTextRequest['messages']): Promise<AiTextResult | null> => {
    const input = messages ?? last.current?.messages
    if (!input) return null
    const extra = last.current?.extra ?? {}
    const c = begin()
    setLoadProgress(0)
    try {
      const { generateInBrowser } = await import('./browser')
      const res = await generateInBrowser(input, {
        system: extra.system,
        maxNewTokens: extra.maxTokens,
        signal: c.signal,
        onProgress: (p) => { if (ctrl.current === c) setLoadProgress(p) },
        onToken: (t) => {
          if (ctrl.current !== c) return
          setLoadProgress(null); setStatus('streaming'); setText((s) => s + t)
        },
      })
      if (ctrl.current !== c) return null
      setMeta(res); setStatus('done'); setLoadProgress(null)
      return res
    } catch (e) {
      if (ctrl.current === c) setLoadProgress(null)
      fail(isAbort(e) ? e : new AiError('unavailable', `The on-device model could not run here: ${e instanceof Error ? e.message : String(e)}`), c)
      return null
    }
  }, [begin, fail])

  const reset = useCallback(() => {
    cancelInFlight()
    setStatus('idle'); setText(''); setError(null); setMeta(null); setRetryIn(null); setLoadProgress(null)
  }, [cancelInFlight])

  const fallback = Boolean(
    error && isQuotaError(error) && error.code !== 'rate_limited' && (options.browserFallback ?? true) && browserAllowed !== false,
  )

  return {
    run,
    runInBrowser,
    abort,
    reset,
    status,
    text,
    error,
    meta,
    busy: status === 'loading' || status === 'streaming',
    /** Server is out of quota / unavailable and the visitor may run the in-browser model. */
    fallback,
    /** Seconds until a rate-limited request may be retried (counts down), else null. */
    retryIn,
    /** 0..1 while the in-browser model downloads, else null. */
    loadProgress,
  }
}
