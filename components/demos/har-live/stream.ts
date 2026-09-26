/**
 * Ring buffer of 25 Hz accelerometer samples plus the device-motion adapter
 * (permission flow on iOS, resampling irregular events to a steady HZ).
 */
import { HZ } from './signal'

export class SampleBuffer {
  readonly cap: number
  readonly xyz: Float32Array
  readonly truth: Int8Array
  count = 0

  constructor(seconds = 60) {
    this.cap = seconds * HZ
    this.xyz = new Float32Array(this.cap * 3)
    this.truth = new Int8Array(this.cap).fill(-1)
  }

  push(x: number, y: number, z: number, truth = -1) {
    const i = this.count % this.cap
    this.xyz[i * 3] = x
    this.xyz[i * 3 + 1] = y
    this.xyz[i * 3 + 2] = z
    this.truth[i] = truth
    this.count++
  }

  /** Oldest absolute index still held. */
  get first() { return Math.max(0, this.count - this.cap) }

  axis(abs: number, k: number) { return this.xyz[(abs % this.cap) * 3 + k] }
  truthAt(abs: number) { return this.truth[abs % this.cap] }

  /** Copy [start, start+n) as interleaved xyz. */
  slice(start: number, n: number): Float32Array {
    const out = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const j = ((start + i) % this.cap) * 3
      out[i * 3] = this.xyz[j]; out[i * 3 + 1] = this.xyz[j + 1]; out[i * 3 + 2] = this.xyz[j + 2]
    }
    return out
  }

  /** Majority truth label over a range (-1 when unknown). */
  majority(start: number, n: number): number {
    const counts = new Map<number, number>()
    for (let i = 0; i < n; i++) {
      const t = this.truthAt(start + i)
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    let best = -1, bestC = 0
    counts.forEach((c, t) => { if (c > bestC) { best = t; bestC = c } })
    return best
  }

  reset() { this.count = 0; this.truth.fill(-1) }
}

export type SensorStatus = 'idle' | 'requesting' | 'waiting' | 'live' | 'denied' | 'unsupported' | 'insecure' | 'no-data'

type PermissionFn = () => Promise<'granted' | 'denied' | 'default'>

export function motionSupport(): 'ok' | 'unsupported' | 'insecure' {
  if (typeof window === 'undefined' || typeof DeviceMotionEvent === 'undefined') return 'unsupported'
  if (!window.isSecureContext) return 'insecure'
  return 'ok'
}

/**
 * Start listening. MUST be called straight from a click handler: iOS only shows its
 * permission prompt inside a user gesture. Returns a stop function.
 */
export function startMotion(
  onSample: (x: number, y: number, z: number) => void,
  onStatus: (s: SensorStatus) => void,
): () => void {
  const support = motionSupport()
  if (support !== 'ok') { onStatus(support); return () => {} }
  let stopped = false
  let got = false
  let next = 0
  let sum = [0, 0, 0]
  let n = 0
  const step = 1000 / HZ
  const handler = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity
    if (!a || a.x == null || a.y == null || a.z == null) return
    const now = performance.now()
    if (!got) { got = true; next = now; onStatus('live') }
    sum = [sum[0] + a.x, sum[1] + a.y, sum[2] + a.z]
    n++
    // emit averaged samples on a steady 25 Hz clock (hold the value if events are sparse)
    let guard = 0
    while (now >= next && guard++ < 50) {
      onSample(sum[0] / n, sum[1] / n, sum[2] / n)
      next += step
    }
    if (guard > 0) { sum = [0, 0, 0]; n = 0 }
    if (now - next > 1000) next = now // tab was asleep: don't flood
  }
  const listen = () => {
    if (stopped) return
    onStatus('waiting')
    window.addEventListener('devicemotion', handler)
    window.setTimeout(() => { if (!stopped && !got) onStatus('no-data') }, 2500)
  }
  const DME = DeviceMotionEvent as unknown as { requestPermission?: PermissionFn }
  if (typeof DME.requestPermission === 'function') {
    onStatus('requesting')
    DME.requestPermission().then((r) => (r === 'granted' ? listen() : onStatus('denied'))).catch(() => onStatus('denied'))
  } else {
    listen()
  }
  return () => {
    stopped = true
    window.removeEventListener('devicemotion', handler)
  }
}
