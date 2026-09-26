'use client'
/** Semantic half of the hybrid retriever: MiniLM vectors for every chunk, memoised per page load. */
import { embed, loadEmbedder } from '@/lib/ai/embeddings'
import { indexText } from './retrieve'
import type { Chunk } from './corpus'

let vectors: Promise<Float32Array[]> | null = null

export type SemanticProgress = { phase: 'model'; p: number } | { phase: 'index'; done: number; total: number }

export function loadChunkVectors(chunks: Chunk[], onProgress: (p: SemanticProgress) => void): Promise<Float32Array[]> {
  vectors ??= (async () => {
    await loadEmbedder((p) => onProgress({ phase: 'model', p }))
    const out: Float32Array[] = []
    const BATCH = 12
    for (let i = 0; i < chunks.length; i += BATCH) {
      out.push(...(await embed(chunks.slice(i, i + BATCH).map(indexText))))
      onProgress({ phase: 'index', done: Math.min(chunks.length, i + BATCH), total: chunks.length })
      await new Promise((r) => setTimeout(r, 0))
    }
    return out
  })().catch((e) => { vectors = null; throw e })
  return vectors
}

export async function embedQuery(q: string): Promise<Float32Array | null> {
  const [v] = await embed([q])
  return v ?? null
}
