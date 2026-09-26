'use client'
/**
 * In-browser text generation: the last hop of the router (BRIEF 4) when the free server
 * providers are out of quota. Owner: ai-gateway.
 *
 * A small instruct model runs locally with transformers.js (WASM, int8). It downloads on
 * first use and the browser caches it, so demos should only start it after the visitor
 * opts in (useAI exposes `fallback` + `runInBrowser`).
 * Nothing leaves the device. Quality is far below the server models; label it honestly.
 */
import type * as Transformers from '@huggingface/transformers'
import { BROWSER_MODEL, BROWSER_MODEL_DOWNLOAD, type AiMessage, type AiTextResult } from './types'

export { BROWSER_MODEL, BROWSER_MODEL_DOWNLOAD }

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
type Generator = ((messages: ChatMessage[], opts: Record<string, unknown>) => Promise<Array<{ generated_text: ChatMessage[] | string }>>) & {
  tokenizer: unknown
}
interface Interrupt { interrupt(): void; reset(): void }

let generator: Promise<{ gen: Generator; t: typeof Transformers }> | null = null

/** Load (once) the local model; `onProgress` gets 0..1 while files download. */
export function loadBrowserModel(onProgress?: (p: number) => void) {
  generator ??= import('@huggingface/transformers')
    .then(async (t) => {
      const files = new Map<string, number>()
      const gen = await t.pipeline('text-generation', BROWSER_MODEL, {
        // WASM + int8 runs everywhere (WebGPU fp16 support is still patchy on phones).
        device: 'wasm',
        dtype: 'q8',
        progress_callback: (e: { status?: string; file?: string; progress?: number }) => {
          if (e.status !== 'progress' || typeof e.progress !== 'number') return
          files.set(e.file ?? '', e.progress)
          const all = [...files.values()]
          onProgress?.(all.reduce((a, b) => a + b, 0) / all.length / 100)
        },
      })
      return { gen: gen as unknown as Generator, t }
    })
    .catch((e) => {
      generator = null
      throw e
    })
  return generator
}

function flatten(messages: AiMessage[], system?: string): ChatMessage[] {
  const out: ChatMessage[] = system ? [{ role: 'system', content: system }] : []
  for (const m of messages) {
    const content = typeof m.content === 'string' ? m.content : m.content.map((p) => (p.type === 'text' ? p.text : '[image omitted]')).join('\n')
    out.push({ role: m.role, content })
  }
  return out
}

export interface BrowserGenerateOptions {
  system?: string
  maxNewTokens?: number
  signal?: AbortSignal
  onToken?: (chunk: string) => void
  onProgress?: (p: number) => void
}

/** Generate a reply locally. Resolves with the same shape as the server (provider 'browser'). */
export async function generateInBrowser(messages: AiMessage[], opts: BrowserGenerateOptions = {}): Promise<AiTextResult> {
  const started = performance.now()
  const { gen, t } = await loadBrowserModel(opts.onProgress)
  if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const chat = flatten(messages, opts.system)
  let text = ''
  let outputTokens = 0
  const streamer = new t.TextStreamer(gen.tokenizer as never, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (chunk: string) => {
      text += chunk
      opts.onToken?.(chunk)
    },
    token_callback_function: () => { outputTokens++ },
  })
  const stop = new t.InterruptableStoppingCriteria() as unknown as Interrupt
  const onAbort = () => stop.interrupt()
  opts.signal?.addEventListener('abort', onAbort, { once: true })
  try {
    await gen(chat, {
      max_new_tokens: Math.min(opts.maxNewTokens ?? 256, 512),
      do_sample: false,
      streamer,
      stopping_criteria: stop,
    })
  } finally {
    opts.signal?.removeEventListener('abort', onAbort)
  }
  if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const inputChars = chat.reduce((n, m) => n + m.content.length, 0)
  return {
    provider: 'browser',
    model: BROWSER_MODEL,
    text: text.trim(),
    usage: { inputTokens: Math.ceil(inputChars / 4), outputTokens },
    latencyMs: Math.round(performance.now() - started),
    route: [{ provider: 'browser', outcome: 'ok', ms: Math.round(performance.now() - started) }],
  }
}
