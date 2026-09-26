'use client'
/**
 * Two embedders behind one interface: the instant offline hash embedder, and
 * all-MiniLM-L6-v2 (384-d, via lib/ai/embeddings) once the visitor opts in to the download.
 * Vectors are memoised per (embedder, text) so switching back and forth is free.
 */
import { useCallback, useRef, useState } from 'react'
import { EMBEDDING_DIM, embed, loadEmbedder } from '@/lib/ai/embeddings'
import { HASH_DIM, hashEmbed } from './vectors'

export type EmbedderId = 'hash' | 'minilm'

export type ModelState =
  | { state: 'idle' }
  | { state: 'loading'; progress: number }
  | { state: 'ready' }
  | { state: 'error'; message: string }

export const EMBEDDERS: Record<EmbedderId, { label: string; short: string; dim: number }> = {
  hash: { label: 'Hashed bag of words', short: 'Hash · offline', dim: HASH_DIM },
  minilm: { label: 'all-MiniLM-L6-v2', short: 'MiniLM · semantic', dim: EMBEDDING_DIM },
}

export type EmbedMany = (texts: string[]) => Promise<Float32Array[]>

export function useEmbedder() {
  const [id, setId] = useState<EmbedderId>('hash')
  const [model, setModel] = useState<ModelState>({ state: 'idle' })
  const cache = useRef(new Map<string, Float32Array>())

  const embedWith = useCallback(async (which: EmbedderId, texts: string[]): Promise<Float32Array[]> => {
    const key = (t: string) => `${which}\u0000${t}`
    const missing = [...new Set(texts.filter((t) => !cache.current.has(key(t))))]
    if (missing.length) {
      if (which === 'hash') {
        for (const t of missing) cache.current.set(key(t), hashEmbed(t))
      } else {
        const BATCH = 16
        for (let i = 0; i < missing.length; i += BATCH) {
          const part = missing.slice(i, i + BATCH)
          const vecs = await embed(part)
          part.forEach((t, j) => { const v = vecs[j]; if (v) cache.current.set(key(t), v) })
          await new Promise((r) => setTimeout(r, 0)) // keep the page responsive
        }
      }
    }
    return texts.map((t) => cache.current.get(key(t)) ?? new Float32Array(EMBEDDERS[which].dim))
  }, [])

  /** Embed with the active embedder. Identity changes when the embedder does. */
  const embedMany = useCallback<EmbedMany>((texts) => embedWith(id, texts), [embedWith, id])

  const loadModel = useCallback(async () => {
    setModel({ state: 'loading', progress: 0 })
    try {
      await loadEmbedder((p) => setModel({ state: 'loading', progress: p }))
      setModel({ state: 'ready' })
      setId('minilm')
    } catch (e) {
      setModel({ state: 'error', message: e instanceof Error ? e.message : String(e) })
      setId('hash')
    }
  }, [])

  const choose = useCallback((next: EmbedderId) => {
    if (next === 'minilm' && model.state !== 'ready') { if (model.state !== 'loading') void loadModel(); return }
    setId(next)
  }, [loadModel, model.state])

  return { id, model, embedMany, choose, loadModel }
}
