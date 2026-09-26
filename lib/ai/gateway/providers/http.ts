/** Small HTTP helpers shared by the provider adapters. */
import 'server-only'
import { ProviderError, providerHttpError } from '../errors'

/**
 * POST JSON. Non-2xx becomes a ProviderError. When the provider rejects a request
 * (400/422) and `fallbackBody` is given, retry once with it: that is how optional knobs
 * (reasoning effort, JSON schema mode, usage-in-stream) degrade on models without them.
 */
export async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal,
  fallbackBody?: unknown,
): Promise<Response> {
  const send = (b: unknown) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(b),
      signal,
      cache: 'no-store',
    })

  let res: Response
  try {
    res = await send(body)
    if ((res.status === 400 || res.status === 422) && fallbackBody !== undefined) {
      await res.body?.cancel()
      res = await send(fallbackBody)
    }
  } catch (e) {
    throw networkError(e, signal)
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw providerHttpError(res.status, errorMessage(detail) || res.statusText, res.headers.get('retry-after'))
  }
  return res
}

function errorMessage(raw: string): string {
  try {
    const j = JSON.parse(raw) as { error?: { message?: string } | string; message?: string }
    if (typeof j.error === 'string') return j.error
    return j.error?.message ?? j.message ?? raw
  } catch {
    return raw
  }
}

/** Turn a fetch/read failure into a ProviderError; aborts caused by our timers read as timeouts. */
export function networkError(e: unknown, signal: AbortSignal): unknown {
  if (e instanceof ProviderError) return e
  if (signal.aborted) {
    const r: unknown = signal.reason
    if (r instanceof ProviderError) return r
    return e // client abort: the router rethrows it as `aborted`
  }
  return new ProviderError('network', e instanceof Error ? e.message : 'Network error')
}

/**
 * Iterate SSE `data:` payloads from a fetch response. Throws a timeout ProviderError when
 * the provider stays silent for `idleMs`.
 */
export async function* sseData(res: Response, signal: AbortSignal, idleMs: number): AsyncGenerator<string> {
  if (!res.body) throw new ProviderError('empty', 'Provider returned no stream body')
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  try {
    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined
      const idle = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ProviderError('timeout', `No data for ${idleMs / 1000}s`)), idleMs)
      })
      let chunk: ReadableStreamReadResult<string>
      try {
        chunk = await Promise.race([reader.read(), idle])
      } catch (e) {
        throw networkError(e, signal)
      } finally {
        clearTimeout(timer)
      }
      if (chunk.done) break
      buf += chunk.value
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, '')
        buf = buf.slice(nl + 1)
        if (line.startsWith('data:')) yield line.slice(5).trimStart()
      }
    }
    const tail = buf.trim()
    if (tail.startsWith('data:')) yield tail.slice(5).trimStart()
  } finally {
    reader.cancel().catch(() => {})
  }
}

export function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const comma = dataUrl.indexOf(',')
  const mime = /^data:([^;]+);base64$/.exec(dataUrl.slice(0, comma))?.[1] ?? 'image/png'
  return { mimeType: mime === 'image/jpg' ? 'image/jpeg' : mime, data: dataUrl.slice(comma + 1).replace(/\s/g, '') }
}

export function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}
