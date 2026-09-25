/**
 * Retrieval for the legal assistant: plain-language query expansion, BM25 over
 * chunk text + heading, optional MiniLM cosine, fused with Reciprocal Rank Fusion.
 */
import type { Chunk } from './corpus'

const STOP = new Set(
  'a an the of to in on at for from by with and or but is are was were be been being it its this that these those as into do does did can could may might i me my you your we our they them their he she his her what which who whom how when where why if any all shall will would should have has had not no nor there than so such get'.split(' '),
)

/** Tiny suffix stemmer: good enough to join "searches"/"search" and "voting"/"vote". */
export function stem(w: string): string {
  if (w.length <= 3) return w
  return w
    .replace(/ies$/, 'y')
    .replace(/(sses|ss)$/, 'ss')
    .replace(/([^s])s$/, '$1')
    .replace(/(ing|ed)$/, '')
    .replace(/e$/, '')
}

export function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOP.has(w)).map(stem)
}

/** Everyday words -> the Constitution's vocabulary (shown to the visitor as an expansion step). */
const EXPANSIONS: Record<string, string[]> = {
  lawyer: ['counsel', 'defence'], attorney: ['counsel', 'defence'], lawyers: ['counsel'],
  police: ['searches', 'seizures', 'warrants'], cop: ['searches', 'warrants'], raid: ['searches', 'seizures'],
  gun: ['arms'], guns: ['arms'], firearm: ['arms'], firearms: ['arms'], weapon: ['arms'],
  twice: ['jeopardy', 'offence'], again: ['jeopardy'], double: ['jeopardy'],
  silent: ['witness', 'against', 'himself'], myself: ['himself'], say: ['speech'], talk: ['speech'], criticise: ['speech', 'press'], criticize: ['speech', 'press'], testify: ['witness'], incriminate: ['witness', 'against', 'himself'],
  jail: ['bail', 'punishment'], prison: ['punishment'], torture: ['cruel', 'unusual', 'punishments'],
  home: ['house', 'houses'], house: ['houses'], housed: ['quartered'], troops: ['soldier'], soldiers: ['soldier'],
  women: ['sex'], woman: ['sex'], gender: ['sex'], female: ['sex'], race: ['race', 'color'],
  old: ['age', 'years'], older: ['age'], young: ['age'], age: ['age', 'years'],
  religion: ['religion', 'religious'], church: ['religion', 'establishment'], faith: ['religion'],
  protest: ['assemble', 'petition'], speak: ['speech'], newspaper: ['press'], journalist: ['press'],
  slave: ['slavery', 'servitude'], forced: ['involuntary', 'servitude'],
  born: ['born', 'naturalized', 'citizens'], citizenship: ['citizens', 'naturalized'],
  land: ['property', 'compensation'], property: ['property', 'compensation'], seize: ['seizures', 'taken'],
  fair: ['due', 'process', 'impartial'], quick: ['speedy'], trial: ['trial', 'jury'],
  president: ['president', 'office'], term: ['elected', 'twice'], terms: ['elected', 'twice'],
  detained: ['habeas', 'corpus'], detention: ['habeas', 'corpus'], lawsuit: ['suits', 'common', 'law'],
  retroactive: ['ex', 'post', 'facto'], states: ['states', 'reserved'],
}

export interface Expanded {
  terms: string[]
  added: Array<{ from: string; to: string[] }>
}

export function expandQuery(q: string): Expanded {
  const words = q.toLowerCase().match(/[a-z0-9]+/g) ?? []
  const added: Expanded['added'] = []
  const out = new Set(terms(q))
  for (const w of new Set(words)) {
    const to = EXPANSIONS[w]
    if (!to) continue
    const fresh = to.filter((t) => !out.has(stem(t)))
    fresh.forEach((t) => out.add(stem(t)))
    if (fresh.length) added.push({ from: w, to: fresh })
  }
  return { terms: [...out], added }
}

export interface Bm25 {
  docs: Array<Map<string, number>>
  lens: number[]
  avg: number
  df: Map<string, number>
}

export const indexText = (c: Chunk) => `${c.provision.heading}. ${c.text}`

export function buildBm25(chunks: Chunk[]): Bm25 {
  const docs = chunks.map((c) => {
    const tf = new Map<string, number>()
    for (const t of terms(indexText(c))) tf.set(t, (tf.get(t) ?? 0) + 1)
    return tf
  })
  const lens = docs.map((d) => [...d.values()].reduce((a, b) => a + b, 0))
  const df = new Map<string, number>()
  for (const d of docs) for (const t of d.keys()) df.set(t, (df.get(t) ?? 0) + 1)
  return { docs, lens, avg: lens.reduce((a, b) => a + b, 0) / (lens.length || 1), df }
}

export function bm25Scores(ix: Bm25, qTerms: string[], k1 = 1.2, b = 0.75): number[] {
  const n = ix.docs.length
  return ix.docs.map((tf, i) => {
    let s = 0
    for (const t of qTerms) {
      const f = tf.get(t)
      if (!f) continue
      const df = ix.df.get(t) ?? 0
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * (ix.lens[i] ?? 0)) / ix.avg)))
    }
    return s
  })
}

export interface Hit {
  chunk: Chunk
  bm25: number
  cosine: number | null
  /** Fused score (RRF when semantic is on, else normalised BM25). */
  score: number
  /** 1-based rank in each retriever (null = no signal). */
  lexRank: number | null
  semRank: number | null
}

const RRF_K = 60

function ranks(scores: number[], floor: number): Array<number | null> {
  const order = scores.map((s, i) => [s, i] as const).filter(([s]) => s > floor).sort((a, b) => b[0] - a[0])
  const out: Array<number | null> = scores.map(() => null)
  order.forEach(([, i], r) => { out[i] = r + 1 })
  return out
}

/** Rank every chunk; returns all chunks with any signal, best first. */
export function retrieve(opts: { chunks: Chunk[]; ix: Bm25; qTerms: string[]; queryVec?: Float32Array | null; vectors?: Float32Array[] | null }): Hit[] {
  const { chunks, ix, qTerms, queryVec, vectors } = opts
  const lex = bm25Scores(ix, qTerms)
  const cos = queryVec && vectors ? vectors.map((v) => dot(queryVec, v)) : null
  const lexR = ranks(lex, 0)
  // Only cosine matches above a small floor count as semantic evidence.
  const semR = cos ? ranks(cos, 0.2) : chunks.map(() => null)
  const maxLex = Math.max(...lex, 0) || 1
  const hits: Hit[] = chunks.map((chunk, i) => {
    const lr = lexR[i] ?? null, sr = semR[i] ?? null
    const score = cos ? (lr ? 1 / (RRF_K + lr) : 0) + (sr ? 1 / (RRF_K + sr) : 0) : (lex[i] ?? 0) / maxLex
    return { chunk, bm25: lex[i] ?? 0, cosine: cos ? (cos[i] ?? 0) : null, score, lexRank: lr, semRank: sr }
  })
  return hits.filter((h) => h.score > 0).sort((a, b) => b.score - a.score)
}

function dot(a: Float32Array, b: Float32Array) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * (b[i] ?? 0)
  return s
}
