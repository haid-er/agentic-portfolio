/**
 * Instant baseline classifier: hand-made window features -> softmax regression,
 * trained on synthetic windows in a few milliseconds. Always available, no downloads.
 */
import { ACTIVITIES, CH, HZ } from './signal'

const K = ACTIVITIES.length

function stats(ch: Float32Array, c: number) {
  const n = ch.length / CH
  let s = 0, s2 = 0, mx = -Infinity, mn = Infinity
  for (let i = 0; i < n; i++) {
    const v = ch[i * CH + c]
    s += v; s2 += v * v
    if (v > mx) mx = v
    if (v < mn) mn = v
  }
  const mean = s / n
  return { mean, std: Math.sqrt(Math.max(0, s2 / n - mean * mean)), max: mx, min: mn }
}

const FREQS = Array.from({ length: 38 }, (_, i) => 0.3 + i * 0.1) // 0.3-4 Hz
let trig: { n: number; cos: Float64Array[]; sin: Float64Array[] } | null = null
function tables(n: number) {
  if (trig?.n === n) return trig
  const cos = FREQS.map((f) => Float64Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * f * i) / HZ)))
  const sin = FREQS.map((f) => Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * f * i) / HZ)))
  trig = { n, cos, sin }
  return trig
}

/** Dominant frequency (Hz) and its share of spectral power, 0.3-4 Hz, of one channel. */
function dominant(ch: Float32Array, c: number) {
  const n = ch.length / CH
  const { mean } = stats(ch, c)
  const T = tables(n)
  let best = 0, bestP = 0, total = 1e-9
  for (let fi = 0; fi < FREQS.length; fi++) {
    const cs = T.cos[fi], sn = T.sin[fi]
    let re = 0, im = 0
    for (let i = 0; i < n; i++) {
      const v = ch[i * CH + c] - mean
      re += v * cs[i]
      im -= v * sn[i]
    }
    const p = re * re + im * im
    total += p
    if (p > bestP) { bestP = p; best = FREQS[fi] }
  }
  return { f: best, share: bestP / total }
}

export const FEATURE_NAMES = [
  'mag std', 'mag range', 'vert std', 'horiz mean', 'tilt max', 'tilt end', 'tilt range', 'dom freq', 'dom share', 'tilt freq',
] as const

export function features(ch: Float32Array): number[] {
  const n = ch.length / CH
  const mag = stats(ch, 0)
  const vert = stats(ch, 1)
  const hor = stats(ch, 2)
  const tilt = stats(ch, 3)
  const dm = dominant(ch, 0)
  const dt = dominant(ch, 3)
  const tiltEnd = ch[(n - 1) * CH + 3]
  return [mag.std, mag.max - mag.min, vert.std, hor.mean, tilt.max, tiltEnd, tilt.max - tilt.min, dm.f / 4, dm.share, dt.f / 4]
}

export interface Baseline {
  predict(ch: Float32Array): number[]
  trainAcc: number
}

function softmax(z: number[]) {
  const m = Math.max(...z)
  const e = z.map((v) => Math.exp(v - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

/** Multinomial logistic regression with z-scored features, full-batch gradient descent. */
export function trainBaseline(x: Float32Array[], y: number[], iters = 300, lr = 0.7, l2 = 1e-3): Baseline {
  const F = x.map(features)
  const d = F[0].length
  const mu = new Array<number>(d).fill(0)
  const sd = new Array<number>(d).fill(0)
  for (const f of F) f.forEach((v, j) => { mu[j] += v / F.length })
  for (const f of F) f.forEach((v, j) => { sd[j] += (v - mu[j]) ** 2 / F.length })
  for (let j = 0; j < d; j++) sd[j] = Math.sqrt(sd[j]) || 1
  const Z = F.map((f) => f.map((v, j) => (v - mu[j]) / sd[j]))
  const W = Array.from({ length: K }, () => new Array<number>(d + 1).fill(0))
  const logits = (z: number[]) => W.map((w) => w[d] + z.reduce((s, v, j) => s + v * w[j], 0))
  for (let it = 0; it < iters; it++) {
    const grad = Array.from({ length: K }, () => new Array<number>(d + 1).fill(0))
    Z.forEach((z, i) => {
      const p = softmax(logits(z))
      for (let k = 0; k < K; k++) {
        const e = (p[k] - (y[i] === k ? 1 : 0)) / Z.length
        for (let j = 0; j < d; j++) grad[k][j] += e * z[j]
        grad[k][d] += e
      }
    })
    for (let k = 0; k < K; k++) for (let j = 0; j <= d; j++) W[k][j] -= lr * (grad[k][j] + (j < d ? l2 * W[k][j] : 0))
  }
  const predictZ = (z: number[]) => softmax(logits(z))
  let hit = 0
  Z.forEach((z, i) => { const p = predictZ(z); if (p.indexOf(Math.max(...p)) === y[i]) hit++ })
  return {
    predict: (ch) => predictZ(features(ch).map((v, j) => (v - mu[j]) / sd[j])),
    trainAcc: hit / Z.length,
  }
}
