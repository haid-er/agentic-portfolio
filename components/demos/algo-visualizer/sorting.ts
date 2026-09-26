/**
 * Sorting algorithms recorded as operation traces (compare / swap / write / mark-sorted),
 * so the stage can replay any step. Values are small positive integers.
 */
import { seeded } from '@/lib/utils'

export type SortAlgo = 'bubble' | 'insertion' | 'merge' | 'quick'

export const SORT_ALGOS: Record<SortAlgo, { label: string; name: string; blurb: string; best: string; avg: string; worst: string; space: string; stable: boolean }> = {
  bubble: {
    label: 'Bubble', name: 'Bubble sort',
    blurb: 'Swaps neighbours that are out of order; the largest value bubbles to the end each pass. Stops early after a pass with no swaps.',
    best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true,
  },
  insertion: {
    label: 'Insertion', name: 'Insertion sort',
    blurb: 'Grows a sorted prefix, sliding each new value left until it fits. Excellent on nearly sorted input.',
    best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)', stable: true,
  },
  merge: {
    label: 'Merge', name: 'Merge sort',
    blurb: 'Splits in half, sorts each half, then merges them with an auxiliary buffer. Always n log n, at the cost of O(n) extra memory.',
    best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)', stable: true,
  },
  quick: {
    label: 'Quick', name: 'Quicksort (Lomuto)',
    blurb: 'Partitions around the last element, then recurses on each side. Fast on random data; already sorted input is its worst case with this pivot rule.',
    best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)', stable: false,
  },
}

export type SortOp =
  | { t: 'cmp'; i: number; j: number }
  | { t: 'swap'; i: number; j: number }
  | { t: 'set'; i: number; v: number }
  | { t: 'done'; i: number }
  | { t: 'pivot'; i: number }

export interface SortTrace {
  algo: SortAlgo
  input: number[]
  ops: SortOp[]
  /** Cumulative comparisons / writes after op k (index 0 = before any op). */
  cmps: Int32Array
  writes: Int32Array
}

function record(algo: SortAlgo, input: number[]): SortOp[] {
  const a = input.slice()
  const ops: SortOp[] = []
  const cmp = (i: number, j: number) => { ops.push({ t: 'cmp', i, j }); return a[i] - a[j] }
  const swap = (i: number, j: number) => { ops.push({ t: 'swap', i, j }); [a[i], a[j]] = [a[j], a[i]] }
  const done = (i: number) => ops.push({ t: 'done', i })
  const n = a.length

  if (algo === 'bubble') {
    let end = n
    for (;;) {
      let swapped = false
      for (let i = 1; i < end; i++) if (cmp(i - 1, i) > 0) { swap(i - 1, i); swapped = true }
      end--
      done(end)
      if (!swapped) { for (let i = 0; i < end; i++) done(i); break }
      if (end <= 1) { if (end === 1) done(0); break }
    }
  } else if (algo === 'insertion') {
    for (let i = 1; i < n; i++) {
      for (let j = i; j > 0 && cmp(j - 1, j) > 0; j--) swap(j - 1, j)
    }
    for (let i = 0; i < n; i++) done(i)
  } else if (algo === 'merge') {
    const aux = new Array<number>(n)
    const sort = (lo: number, hi: number) => {
      if (hi - lo < 1) return
      const mid = (lo + hi) >> 1
      sort(lo, mid)
      sort(mid + 1, hi)
      for (let k = lo; k <= hi; k++) aux[k] = a[k]
      let i = lo, j = mid + 1
      for (let k = lo; k <= hi; k++) {
        let v: number
        if (i > mid) v = aux[j++]
        else if (j > hi) v = aux[i++]
        else {
          ops.push({ t: 'cmp', i, j })
          v = aux[j] < aux[i] ? aux[j++] : aux[i++]
        }
        a[k] = v
        ops.push({ t: 'set', i: k, v })
      }
    }
    sort(0, n - 1)
    for (let i = 0; i < n; i++) done(i)
  } else {
    const part = (lo: number, hi: number) => {
      ops.push({ t: 'pivot', i: hi })
      let store = lo
      for (let i = lo; i < hi; i++) if (cmp(i, hi) < 0) { if (i !== store) swap(i, store); store++ }
      if (store !== hi) swap(store, hi)
      return store
    }
    const sort = (lo: number, hi: number) => {
      if (lo > hi) return
      if (lo === hi) { done(lo); return }
      const p = part(lo, hi)
      done(p)
      sort(lo, p - 1)
      sort(p + 1, hi)
    }
    sort(0, n - 1)
  }
  return ops
}

export function runSort(algo: SortAlgo, input: number[]): SortTrace {
  const ops = record(algo, input)
  const cmps = new Int32Array(ops.length + 1)
  const writes = new Int32Array(ops.length + 1)
  ops.forEach((op, k) => {
    cmps[k + 1] = cmps[k] + (op.t === 'cmp' ? 1 : 0)
    writes[k + 1] = writes[k] + (op.t === 'swap' ? 2 : op.t === 'set' ? 1 : 0)
  })
  return { algo, input, ops, cmps, writes }
}

export interface SortFrame {
  values: number[]
  sorted: boolean[]
  /** The op that produced this frame (null at step 0). */
  last: SortOp | null
  pivot: number
}

/** Replay the first `step` ops. O(step), cheap for n <= 64. */
export function frameAt(trace: SortTrace, step: number): SortFrame {
  const values = trace.input.slice()
  const sorted = new Array<boolean>(values.length).fill(false)
  let pivot = -1
  const end = Math.min(step, trace.ops.length)
  for (let k = 0; k < end; k++) {
    const op = trace.ops[k]
    if (op.t === 'swap') [values[op.i], values[op.j]] = [values[op.j], values[op.i]]
    else if (op.t === 'set') values[op.i] = op.v
    else if (op.t === 'done') { sorted[op.i] = true; pivot = -1 }
    else if (op.t === 'pivot') pivot = op.i
  }
  return { values, sorted, last: end > 0 ? trace.ops[end - 1] : null, pivot }
}

export type InputShape = 'random' | 'nearly' | 'reversed' | 'few'

export const INPUT_SHAPES: Record<InputShape, string> = {
  random: 'Random',
  nearly: 'Nearly sorted',
  reversed: 'Reversed',
  few: 'Few unique',
}

export function makeInput(shape: InputShape, n: number, seed: number): number[] {
  const rnd = seeded(seed)
  const base = Array.from({ length: n }, (_, i) => i + 1)
  if (shape === 'reversed') return base.reverse()
  if (shape === 'nearly') {
    const a = base.slice()
    for (let k = 0; k < Math.max(1, Math.round(n / 12)); k++) {
      const i = Math.floor(rnd() * (n - 1))
      ;[a[i], a[i + 1]] = [a[i + 1], a[i]]
    }
    return a
  }
  if (shape === 'few') {
    const levels = [0.25, 0.5, 0.75, 1].map((f) => Math.max(1, Math.round(f * n)))
    return base.map(() => levels[Math.floor(rnd() * levels.length)])
  }
  // Fisher-Yates
  const a = base.slice()
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
