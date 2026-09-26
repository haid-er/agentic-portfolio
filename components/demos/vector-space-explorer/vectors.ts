/**
 * Vector maths for the explorer: an offline "hashed bag of words" embedder,
 * cosine top-k, and a 2-component PCA used to draw 384-d vectors on a page.
 */
import { seeded } from '@/lib/utils'

export const HASH_DIM = 256

const STOP = new Set(
  'a an the of to in on at for from by with and or but is are was were be been it its this that these those as into when until so than then do does i my you your we our their them they every each some'.split(' '),
)

/** Lower-case word tokens with a tiny suffix stemmer (walking -> walk, clips -> clip). */
export function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .filter((w) => !STOP.has(w))
    .map((w) => w.replace(/(ing|ed|es|s)$/, '') || w)
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function normalise(v: Float32Array): Float32Array {
  let n = 0
  for (let i = 0; i < v.length; i++) n += v[i] * v[i]
  n = Math.sqrt(n)
  if (n > 0) for (let i = 0; i < v.length; i++) v[i] /= n
  return v
}

/**
 * Feature hashing: each word (weight 1) and each in-word character trigram (weight .35)
 * is hashed into one of 256 signed buckets. Instant and offline, but it only knows spelling.
 */
export function hashEmbed(text: string): Float32Array {
  const v = new Float32Array(HASH_DIM)
  const add = (feature: string, w: number) => {
    const h = fnv1a(feature)
    v[h % HASH_DIM] += h & 0x80000000 ? -w : w
  }
  for (const w of words(text)) {
    add(`w:${w}`, 1)
    const padded = `^${w}$`
    for (let i = 0; i + 3 <= padded.length; i++) add(`t:${padded.slice(i, i + 3)}`, 0.35)
  }
  return normalise(v)
}

/** Dot product; equals cosine similarity for normalised vectors. */
export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) s += a[i] * b[i]
  return s
}

export interface Hit {
  index: number
  score: number
}

/** Brute-force exact k-nearest neighbours by cosine (what a vector index approximates). */
export function topK(query: Float32Array, vectors: Float32Array[], k: number, allow?: (i: number) => boolean): Hit[] {
  const hits: Hit[] = []
  vectors.forEach((v, index) => {
    if (!allow || allow(index)) hits.push({ index, score: dot(query, v) })
  })
  return hits.sort((a, b) => b.score - a.score).slice(0, k)
}

/* ------------------------------------------------------------------ */
/* PCA (power iteration with deflation)                                */
/* ------------------------------------------------------------------ */

export interface Basis {
  mean: Float32Array
  axes: [Float32Array, Float32Array]
  /** Share of total variance each axis explains (0..1). */
  explained: [number, number]
}

function powerAxis(rows: Float32Array[], dim: number, prior: Float32Array | null, seed: number): { axis: Float32Array; value: number } {
  const rnd = seeded(seed)
  let v = new Float32Array(dim).map(() => rnd() - 0.5)
  normalise(v)
  let value = 0
  for (let iter = 0; iter < 60; iter++) {
    // w = X^T X v, with the prior axis projected out (deflation).
    const w = new Float32Array(dim)
    for (const r of rows) {
      const p = dot(r, v)
      for (let j = 0; j < dim; j++) w[j] += p * r[j]
    }
    if (prior) {
      const p = dot(w, prior)
      for (let j = 0; j < dim; j++) w[j] -= p * prior[j]
    }
    value = Math.sqrt(dot(w, w))
    if (value === 0) break
    for (let j = 0; j < dim; j++) w[j] /= value
    v = w
  }
  return { axis: v, value }
}

/** Fit the 2 principal axes of a set of vectors. */
export function fitPca(vectors: Float32Array[]): Basis {
  const dim = vectors[0]?.length ?? 1
  const mean = new Float32Array(dim)
  for (const v of vectors) for (let j = 0; j < dim; j++) mean[j] += v[j] / vectors.length
  const rows = vectors.map((v) => v.map((x, j) => x - mean[j]))
  const total = rows.reduce((s, r) => s + dot(r, r), 0) || 1
  const a = powerAxis(rows, dim, null, 417)
  const b = powerAxis(rows, dim, a.axis, 1729)
  return { mean, axes: [a.axis, b.axis], explained: [a.value / total, b.value / total] }
}

export function project(basis: Basis, v: Float32Array): [number, number] {
  let x = 0, y = 0
  for (let j = 0; j < v.length; j++) {
    const c = v[j] - basis.mean[j]
    x += c * basis.axes[0][j]
    y += c * basis.axes[1][j]
  }
  return [x, y]
}

/** Map raw 2-D coordinates into a [0,1] box (with a margin); y grows downwards for SVG. */
export function fitBox(points: Array<[number, number]>): (p: [number, number]) => [number, number] {
  if (!points.length) return () => [0.5, 0.5]
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const sx = maxX - minX || 1, sy = maxY - minY || 1
  return ([x, y]) => [0.06 + ((x - minX) / sx) * 0.88, 0.94 - ((y - minY) / sy) * 0.88]
}
