/**
 * Hybrid retrieval: BM25 (lexical, instant, offline) + cosine over MiniLM embeddings
 * (semantic, optional), fused with Reciprocal Rank Fusion. No libraries.
 */
import { indexText, sentences, type Chunk } from './corpus'

const STOP = new Set(
  ('a an and are as at be but by did do does for from had has have he her his how i in into is it its of on or our she so ' +
    'that the their them then there these they this to was we were what when where which who whom why will with you your ' +
    'about can could would should me my tell show give any some much many does doing done been being also than just').split(' '),
)

/** Lowercase, keep tokens like "c++", "node.js" -> "node", "js"; light suffix stemming. */
export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().replace(/c\+\+/g, ' cplusplus ').replace(/c#/g, ' csharp ').match(/[a-z0-9]+/g) ?? []
  const out: string[] = []
  for (const t of raw) {
    if (STOP.has(t) || (t.length < 2 && !/\d/.test(t))) continue
    out.push(stem(t))
  }
  return out
}

function stem(t: string): string {
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3)
  if (t.length > 4 && t.endsWith('ies')) return `${t.slice(0, -3)}y`
  if (t.length > 4 && t.endsWith('ed')) return t.slice(0, -2)
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1)
  return t
}

/** Tiny query expansion so everyday words reach the site's vocabulary (the semantic model does the rest). */
const EXPAND: Record<string, string[]> = {
  study: ['education', 'degree', 'university'], studi: ['education', 'degree', 'university'], school: ['education'], degree: ['education'],
  job: ['role', 'experience'], work: ['role', 'experience'], employer: ['role', 'experience'], career: ['experience', 'role'],
  publish: ['research', 'paper', 'journal'], paper: ['research', 'journal'], research: ['paper', 'journal'],
  hire: ['contact', 'service'], contact: ['email'], email: ['contact'], build: ['project'], built: ['project'],
  award: ['achievement'], certificate: ['certification'], certifi: ['certification'], agent: ['agentic', 'autonomou'],
}

export function expandQuery(tokens: string[]): string[] {
  const out = new Set(tokens)
  for (const t of tokens) for (const x of EXPAND[t] ?? []) out.add(stem(x))
  return [...out]
}

export interface Bm25Index {
  docs: Array<Map<string, number>>
  lengths: number[]
  avgLen: number
  df: Map<string, number>
  n: number
  /** Query words ignored at search time (e.g. the person's name). */
  ignore: Set<string>
}

export function buildBm25(chunks: Chunk[], ignore: string[] = []): Bm25Index {
  const docs: Array<Map<string, number>> = []
  const lengths: number[] = []
  const df = new Map<string, number>()
  for (const c of chunks) {
    // Title tokens count twice: short chunks still match on what they are about.
    const toks = [...tokenize(c.title), ...tokenize(indexText(c))]
    const tf = new Map<string, number>()
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1)
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1)
    docs.push(tf)
    lengths.push(toks.length)
  }
  const avgLen = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length)
  return { docs, lengths, avgLen, df, n: chunks.length, ignore: new Set(ignore.map(stem)) }
}

/** Okapi BM25 (k1 = 1.2, b = 0.75). */
export function bm25Scores(index: Bm25Index, query: string, k1 = 1.2, b = 0.75): number[] {
  const q = expandQuery([...new Set(tokenize(query))].filter((t) => !index.ignore.has(t)))
  return index.docs.map((tf, i) => {
    let s = 0
    for (const term of q) {
      const f = tf.get(term)
      if (!f) continue
      const df = index.df.get(term) ?? 0
      const idf = Math.log(1 + (index.n - df + 0.5) / (df + 0.5))
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * (index.lengths[i] ?? 0)) / index.avgLen)))
    }
    return s
  })
}

export interface Hit {
  chunk: Chunk
  bm25: number
  /** Cosine similarity, when semantic search is loaded. */
  cosine: number | null
  /** 1-based ranks in each list (null = not ranked). */
  lexRank: number | null
  vecRank: number | null
  /** Reciprocal Rank Fusion score. */
  fused: number
}

const RRF_K = 60

function ranks(scores: number[], min: number): Map<number, number> {
  const order = scores.map((s, i) => [s, i] as const).filter(([s]) => s > min).sort((a, b) => b[0] - a[0])
  return new Map(order.map(([, i], r) => [i, r + 1]))
}

/**
 * Rank chunks for a query. With `queryVec` + `vectors` it fuses both lists with RRF
 * (score = sum of 1 / (60 + rank)); otherwise it is pure BM25.
 */
export function hybridSearch(opts: {
  chunks: Chunk[]
  index: Bm25Index
  query: string
  queryVec?: Float32Array | null
  vectors?: Float32Array[] | null
  k?: number
}): Hit[] {
  const { chunks, index, query, queryVec, vectors, k = 6 } = opts
  const lex = bm25Scores(index, query)
  const cos = queryVec && vectors ? vectors.map((v) => dot(v, queryVec)) : null
  const lexR = ranks(lex, 0)
  // Semantic list: cosine below ~0.15 is noise for MiniLM, keep it out of the fusion.
  const vecR = cos ? ranks(cos, 0.15) : new Map<number, number>()
  const hits: Hit[] = chunks.map((chunk, i) => {
    const lr = lexR.get(i) ?? null
    const vr = vecR.get(i) ?? null
    const fused = (lr ? 1 / (RRF_K + lr) : 0) + (vr ? 1 / (RRF_K + vr) : 0)
    return { chunk, bm25: lex[i] ?? 0, cosine: cos ? (cos[i] ?? 0) : null, lexRank: lr, vecRank: vr, fused }
  })
  return hits.filter((h) => h.fused > 0).sort((a, b) => b.fused - a.fused || b.bm25 - a.bm25).slice(0, k)
}

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (b[i] ?? 0)
  return s
}

/** Pick the sentence of a chunk that best overlaps the query (used for extractive answers + snippets). */
export function bestSentence(text: string, query: string): string {
  const q = new Set(tokenize(query))
  const list = sentences(text)
  let best = list[0] ?? text
  let bestScore = -1
  for (const s of list) {
    const toks = tokenize(s)
    const overlap = toks.filter((t) => q.has(t)).length
    const score = overlap + Math.min(toks.length, 30) / 100 // prefer substantive sentences on ties
    if (score > bestScore) { bestScore = score; best = s }
  }
  return best
}
