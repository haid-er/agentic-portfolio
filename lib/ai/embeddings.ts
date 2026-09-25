'use client'
/**
 * In-browser embeddings (transformers.js). Owner: ai-gateway. Used by ask-malik,
 * vector-space-explorer, legal-rag-assistant. Lazy-loads the model on first call
 * (~25 MB, cached by the browser). Never import from server code.
 */
export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2'
export const EMBEDDING_DIM = 384

type Extractor = (texts: string[], opts: { pooling: 'mean'; normalize: boolean }) => Promise<{ data: Float32Array; dims: number[] }>
let extractor: Promise<Extractor> | null = null

/** Load (once) and report progress 0..1 while the model downloads. */
export function loadEmbedder(onProgress?: (p: number) => void): Promise<Extractor> {
  extractor ??= import('@huggingface/transformers').then(async (t) => {
    const pipe = await t.pipeline('feature-extraction', EMBEDDING_MODEL, {
      progress_callback: (e: { status?: string; progress?: number }) => {
        if (e.status === 'progress' && typeof e.progress === 'number') onProgress?.(e.progress / 100)
      },
    })
    return pipe as unknown as Extractor
  }).catch((e) => { extractor = null; throw e })
  return extractor
}

/** Normalised mean-pooled embeddings, one Float32Array(384) per text. */
export async function embed(texts: string[], onProgress?: (p: number) => void): Promise<Float32Array[]> {
  if (!texts.length) return []
  const ex = await loadEmbedder(onProgress)
  const out = await ex(texts, { pooling: 'mean', normalize: true })
  const dim = out.dims[out.dims.length - 1] ?? EMBEDDING_DIM
  return texts.map((_, i) => out.data.slice(i * dim, (i + 1) * dim))
}

/** Cosine similarity (vectors from embed() are already normalised -> dot product). */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { const x = a[i] ?? 0, y = b[i] ?? 0; dot += x * y; na += x * x; nb += y * y }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}
