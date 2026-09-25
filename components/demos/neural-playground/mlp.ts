/**
 * A from-scratch multilayer perceptron: dense layers, tanh / ReLU / sigmoid hidden units,
 * a sigmoid output with binary cross-entropy (classification) or a linear output with
 * mean squared error (regression), full-batch backpropagation and the Adam optimiser.
 * Written out by hand so every moving part is visible; tf.layers.dense does the same.
 */
export type Activation = 'tanh' | 'relu' | 'sigmoid'
export type Task = 'classification' | 'regression'

export interface Net {
  sizes: number[]
  act: Activation
  task: Task
  W: Float64Array[] // W[l][o * in + i]
  b: Float64Array[]
  mW: Float64Array[]; vW: Float64Array[]; mb: Float64Array[]; vb: Float64Array[]
  t: number
}

const f = {
  tanh: (x: number) => Math.tanh(x),
  relu: (x: number) => (x > 0 ? x : 0.01 * x), // leaky, so units never die for good
  sigmoid: (x: number) => 1 / (1 + Math.exp(-x)),
}
/** Derivative expressed through the activation's output y (and input z for ReLU). */
const df = {
  tanh: (y: number) => 1 - y * y,
  relu: (_y: number, z: number) => (z > 0 ? 1 : 0.01),
  sigmoid: (y: number) => y * (1 - y),
}

export function createNet(sizes: number[], act: Activation, task: Task, rng: () => number): Net {
  const W: Float64Array[] = [], b: Float64Array[] = []
  for (let l = 0; l < sizes.length - 1; l++) {
    const nin = sizes[l], nout = sizes[l + 1]
    const scale = act === 'relu' ? Math.sqrt(2 / nin) : Math.sqrt(1 / nin)
    const w = new Float64Array(nin * nout)
    for (let k = 0; k < w.length; k++) w[k] = (rng() * 2 - 1) * scale * 1.7
    W.push(w)
    b.push(new Float64Array(nout))
  }
  const zeros = (a: Float64Array[]) => a.map((x) => new Float64Array(x.length))
  return { sizes, act, task, W, b, mW: zeros(W), vW: zeros(W), mb: zeros(b), vb: zeros(b), t: 0 }
}

interface Trace { a: Float64Array[]; z: Float64Array[] }

function forward(net: Net, x: readonly number[]): Trace {
  const a: Float64Array[] = [Float64Array.from(x)]
  const z: Float64Array[] = [Float64Array.from(x)]
  const L = net.W.length
  for (let l = 0; l < L; l++) {
    const nin = net.sizes[l], nout = net.sizes[l + 1]
    const w = net.W[l], bias = net.b[l], prev = a[l]
    const zl = new Float64Array(nout), al = new Float64Array(nout)
    for (let o = 0; o < nout; o++) {
      let s = bias[o]
      for (let i = 0; i < nin; i++) s += w[o * nin + i] * prev[i]
      zl[o] = s
      const last = l === L - 1
      al[o] = last ? (net.task === 'classification' ? f.sigmoid(s) : s) : f[net.act](s)
    }
    z.push(zl); a.push(al)
  }
  return { a, z }
}

export function predict(net: Net, x: readonly number[]): number {
  const t = forward(net, x)
  return t.a[t.a.length - 1][0]
}

/** Loss over a set (BCE or MSE) without training. */
export function lossOf(net: Net, X: readonly number[][], Y: readonly number[]): number {
  if (!X.length) return 0
  let s = 0
  X.forEach((x, i) => {
    const p = predict(net, x)
    s += net.task === 'classification'
      ? -(Y[i] * Math.log(Math.max(1e-7, p)) + (1 - Y[i]) * Math.log(Math.max(1e-7, 1 - p)))
      : (p - Y[i]) ** 2
  })
  return s / X.length
}

export function accuracyOf(net: Net, X: readonly number[][], Y: readonly number[]): number {
  if (!X.length) return 0
  let hit = 0
  X.forEach((x, i) => { if ((predict(net, x) >= 0.5 ? 1 : 0) === Y[i]) hit++ })
  return hit / X.length
}

/** One full-batch epoch of backprop + Adam. Returns the training loss before the update. */
export function trainEpoch(net: Net, X: readonly number[][], Y: readonly number[], lr: number, l2: number): number {
  const L = net.W.length
  const gW = net.W.map((w) => new Float64Array(w.length))
  const gb = net.b.map((b) => new Float64Array(b.length))
  let loss = 0
  const n = X.length
  for (let s = 0; s < n; s++) {
    const { a, z } = forward(net, X[s])
    const p = a[L][0]
    const y = Y[s]
    loss += net.task === 'classification'
      ? -(y * Math.log(Math.max(1e-7, p)) + (1 - y) * Math.log(Math.max(1e-7, 1 - p)))
      : (p - y) ** 2
    // dLoss/dz at the output: sigmoid+BCE and linear+MSE both reduce to (p - y) (x2 for MSE)
    let delta = Float64Array.of(net.task === 'classification' ? p - y : 2 * (p - y))
    for (let l = L - 1; l >= 0; l--) {
      const nin = net.sizes[l], nout = net.sizes[l + 1]
      const prev = a[l]
      for (let o = 0; o < nout; o++) {
        gb[l][o] += delta[o]
        for (let i = 0; i < nin; i++) gW[l][o * nin + i] += delta[o] * prev[i]
      }
      if (l > 0) {
        const next = new Float64Array(nin)
        for (let i = 0; i < nin; i++) {
          let s2 = 0
          for (let o = 0; o < nout; o++) s2 += net.W[l][o * nin + i] * delta[o]
          next[i] = s2 * df[net.act](a[l][i], z[l][i])
        }
        delta = next
      }
    }
  }
  // Adam
  net.t++
  const b1 = 0.9, b2 = 0.999, eps = 1e-8
  const c1 = 1 - b1 ** net.t, c2 = 1 - b2 ** net.t
  const step = (p: Float64Array, g: Float64Array, m: Float64Array, v: Float64Array, decay: boolean) => {
    for (let k = 0; k < p.length; k++) {
      const gk = g[k] / n + (decay ? l2 * p[k] : 0)
      m[k] = b1 * m[k] + (1 - b1) * gk
      v[k] = b2 * v[k] + (1 - b2) * gk * gk
      p[k] -= (lr * (m[k] / c1)) / (Math.sqrt(v[k] / c2) + eps)
    }
  }
  for (let l = 0; l < L; l++) {
    step(net.W[l], gW[l], net.mW[l], net.vW[l], true)
    step(net.b[l], gb[l], net.mb[l], net.vb[l], false)
  }
  return loss / Math.max(1, n)
}

export const paramCount = (net: Net) => net.W.reduce((s, w) => s + w.length, 0) + net.b.reduce((s, b) => s + b.length, 0)
