'use client'
/**
 * Semantic half of the hybrid search: embeds the corpus once per page load with
 * all-MiniLM-L6-v2 (via lib/ai/embeddings, transformers.js in the browser).
 */
import { embed, loadEmbedder } from '@/lib/ai/embeddings'
import { indexText, type Chunk } from './corpus'

let vectors: Promise<Float32Array[]> | null = null

export type SemanticProgress = { phase: 'model'; p: number } | { phase: 'index'; done: number; total: number }

/** Download the model (progress 0..1) then embed every chunk in batches. Memoised. */
export function loadCorpusVectors(chunks: Chunk[], onProgress: (p: SemanticProgress) => void): Promise<Float32Array[]> {
  vectors ??= (async () => {
    await loadEmbedder((p) => onProgress({ phase: 'model', p }))
    const out: Float32Array[] = []
    const BATCH = 12
    for (let i = 0; i < chunks.length; i += BATCH) {
      const part = chunks.slice(i, i + BATCH).map(indexText)
      out.push(...(await embed(part)))
      onProgress({ phase: 'index', done: Math.min(chunks.length, i + BATCH), total: chunks.length })
      // Yield so the page stays responsive while indexing.
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
