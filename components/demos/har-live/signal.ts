/**
 * Signal vocabulary for har-live: sample rate, windows, activities, a synthetic
 * accelerometer generator (for training and the desktop replay) and the
 * orientation-invariant channels both classifiers read.
 *
 * Nothing here is recorded data. The generator is a physics-flavoured sketch:
 * gravity along a tilting "up" axis + vertical body acceleration + sideways sway + noise.
 */
import { seeded } from '@/lib/utils'

export const HZ = 25
export const WINDOW_S = 5
export const WIN = HZ * WINDOW_S // 125 samples per window
export const G = 9.81
/** Channels fed to the models (see toChannels). */
export const CH = 4

export const ACTIVITIES = ['still', 'walking', 'jogging', 'squatting', 'bending', 'sitting_down'] as const
export type Activity = (typeof ACTIVITIES)[number]

export const ACTIVITY_LABEL: Record<Activity, string> = {
  still: 'Still',
  walking: 'Walking',
  jogging: 'Jogging',
  squatting: 'Squatting',
  bending: 'Bending',
  sitting_down: 'Sitting down',
}

/** How to perform each activity with a phone (shown in sensor mode). */
export const ACTIVITY_HINT: Record<Activity, string> = {
  still: 'Stand or sit without moving, phone in hand or on a table.',
  walking: 'Walk at an easy pace, phone in a front pocket or held upright.',
  jogging: 'Jog on the spot or down a corridor.',
  squatting: 'Slow squats, about one every 2–3 seconds.',
  bending: 'Bend forward at the hips and come back up, phone held against your chest.',
  sitting_down: 'Start standing, then sit down once during the window.',
}

export type Rng = () => number

type V3 = [number, number, number]
const norm = (v: V3): V3 => {
  const m = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / m, v[1] / m, v[2] / m]
}
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const gauss = (rng: Rng) => {
  const u = Math.max(1e-9, rng())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}
const bump = (t: number, c: number, w: number) => Math.exp(-((t - c) ** 2) / (2 * w * w))
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x))
const range = (rng: Rng, a: number, b: number) => a + (b - a) * rng()

/** A phone pose: "up" axis in phone coordinates, plus forward and sideways axes. */
export interface Pose { up: V3; fwd: V3; side: V3 }

/** Mostly upright (y up, like a phone in a front pocket) with random tilt; sometimes any axis. */
export function randomPose(rng: Rng, wild = false): Pose {
  let up: V3 = norm([range(rng, -0.35, 0.35), 1, range(rng, -0.35, 0.35)])
  if (wild && rng() < 0.5) {
    const k = Math.floor(rng() * 3)
    up = [up[(k) % 3], up[(k + 1) % 3], up[(k + 2) % 3]] as V3
    if (rng() < 0.5) up = [-up[0], -up[1], -up[2]]
  }
  const helper: V3 = Math.abs(up[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
  const side = norm(cross(up, helper))
  const fwd = norm(cross(side, up))
  return { up, fwd, side }
}

/**
 * Synthesise `seconds` of accelerometer-including-gravity (m/s^2) at HZ for one activity.
 * `tilt0` is the starting tilt (radians) so a session can continue after sitting down.
 * Returns interleaved xyz and the tilt it ends on.
 */
export function synthSegment(activity: Activity, seconds: number, rng: Rng, pose: Pose, tilt0 = 0): { xyz: Float32Array; endTilt: number } {
  const n = Math.round(seconds * HZ)
  const xyz = new Float32Array(n * 3)
  const amp = range(rng, 0.55, 1.35)
  const ph = rng() * Math.PI * 2
  let endTilt = tilt0
  // per-activity parameters
  const f = activity === 'walking' ? range(rng, 1.5, 2.3) : activity === 'jogging' ? range(rng, 2.2, 3.1) : 0
  const period = activity === 'squatting' ? range(rng, 2.2, 3.2) : activity === 'bending' ? range(rng, 3.0, 4.5) : 1
  const bendMax = range(rng, 0.5, 1.3)
  const sitAt = range(rng, 0.8, Math.max(0.9, seconds - 2.4))
  const sitDur = range(rng, 0.9, 1.4)
  const sitTilt = range(rng, 0.8, 1.5)
  const noise = (activity === 'jogging' ? 0.35 : activity === 'walking' ? 0.2 : 0.08) * range(rng, 0.7, 2.2)
  // an occasional fidget: a short jolt anywhere in the window
  const jolt = rng() < 0.35 ? { at: range(rng, 0, seconds), size: range(rng, 1, 4) } : null

  for (let i = 0; i < n; i++) {
    const t = i / HZ
    let v = 0 // vertical body acceleration
    let h = 0 // sideways sway
    let tilt = tilt0
    switch (activity) {
      case 'still':
        tilt = tilt0 + 0.02 * Math.sin(0.4 * t + ph)
        break
      case 'walking': {
        const a = 2.4 * amp
        v = a * (Math.sin(2 * Math.PI * f * t + ph) + 0.35 * Math.sin(4 * Math.PI * f * t + ph * 1.7))
        h = 0.45 * a * Math.sin(Math.PI * f * t + ph)
        tilt = tilt0 + 0.07 * Math.sin(Math.PI * f * t)
        break
      }
      case 'jogging': {
        const a = 5.5 * amp
        v = a * (2.2 * Math.abs(Math.sin(Math.PI * f * t + ph)) ** 3 - 0.93)
        h = 0.3 * a * Math.sin(Math.PI * f * t + ph)
        tilt = tilt0 + 0.12 * Math.sin(Math.PI * f * t)
        break
      }
      case 'squatting': {
        const w = (2 * Math.PI) / period
        v = 1.8 * amp * Math.cos(w * t + ph)
        tilt = tilt0 + 0.28 * (1 - Math.cos(w * t + ph)) / 2
        break
      }
      case 'bending': {
        const w = (2 * Math.PI) / period
        tilt = tilt0 + bendMax * (1 - Math.cos(w * t + ph)) / 2
        v = 0.5 * amp * Math.sin(w * t + ph)
        break
      }
      case 'sitting_down': {
        const p = smooth((t - sitAt) / sitDur)
        tilt = tilt0 + sitTilt * p
        v = -1.4 * amp * bump(t, sitAt + 0.3 * sitDur, 0.18) + 3.2 * amp * bump(t, sitAt + 0.85 * sitDur, 0.09)
        endTilt = tilt0 + sitTilt
        break
      }
    }
    if (jolt) v += jolt.size * bump(t, jolt.at, 0.06)
    if (activity !== 'sitting_down') endTilt = tilt0
    const c = Math.cos(tilt)
    const s = Math.sin(tilt)
    const up: V3 = [c * pose.up[0] + s * pose.fwd[0], c * pose.up[1] + s * pose.fwd[1], c * pose.up[2] + s * pose.fwd[2]]
    for (let k = 0; k < 3; k++) {
      xyz[i * 3 + k] = (G + v) * up[k] + h * pose.side[k] + noise * gauss(rng)
    }
  }
  return { xyz, endTilt }
}

/**
 * Orientation-invariant channels for a raw window (interleaved xyz, WIN samples):
 *  0 |a| - g   1 vertical dynamic accel   2 horizontal dynamic accel   3 tilt from window start.
 * Gravity is a 1 s centred moving average: the same trick as a gravity-from-IMU low-pass.
 * Output is time-major [t][ch], scaled to roughly unit range.
 */
export function toChannels(xyz: Float32Array): Float32Array {
  const n = Math.floor(xyz.length / 3)
  const out = new Float32Array(n * CH)
  const half = Math.floor(HZ / 2)
  // prefix sums for the moving average
  const ps = new Float64Array((n + 1) * 3)
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) ps[(i + 1) * 3 + k] = ps[i * 3 + k] + xyz[i * 3 + k]
  let ref: V3 | null = null
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - half)
    const hi = Math.min(n, i + half + 1)
    const g: V3 = [0, 0, 0]
    for (let k = 0; k < 3; k++) g[k] = (ps[hi * 3 + k] - ps[lo * 3 + k]) / (hi - lo)
    const gh = norm(g)
    if (!ref) ref = gh
    const a: V3 = [xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]]
    const d: V3 = [a[0] - g[0], a[1] - g[1], a[2] - g[2]]
    const vert = d[0] * gh[0] + d[1] * gh[1] + d[2] * gh[2]
    const horiz = Math.hypot(d[0] - vert * gh[0], d[1] - vert * gh[1], d[2] - vert * gh[2])
    const cos = Math.max(-1, Math.min(1, gh[0] * ref[0] + gh[1] * ref[1] + gh[2] * ref[2]))
    out[i * CH] = (Math.hypot(a[0], a[1], a[2]) - G) / 4
    out[i * CH + 1] = vert / 4
    out[i * CH + 2] = horiz / 4
    out[i * CH + 3] = Math.acos(cos)
  }
  return out
}

/** Labelled synthetic training windows (channels), shuffled. */
export function trainingSet(perClass: number, seed: number): { x: Float32Array[]; y: number[] } {
  const rng = seeded(seed)
  const rows: Array<{ x: Float32Array; y: number }> = []
  ACTIVITIES.forEach((a, yi) => {
    for (let i = 0; i < perClass; i++) {
      const pose = randomPose(rng, true)
      // some still windows start from a seated tilt, like after sitting down
      const tilt0 = a === 'still' && rng() < 0.3 ? range(rng, 1, 1.5) : 0
      const { xyz } = synthSegment(a, WINDOW_S, rng, pose, tilt0)
      rows.push({ x: toChannels(xyz), y: yi })
    }
  })
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = rows[i]; rows[i] = rows[j]; rows[j] = tmp
  }
  return { x: rows.map((r) => r.x), y: rows.map((r) => r.y) }
}

/** The desktop replay: a scripted, seeded session with ground truth per sample. */
export const SESSION_SCRIPT: ReadonlyArray<{ a: Activity; s: number }> = [
  { a: 'still', s: 5 },
  { a: 'walking', s: 15 },
  { a: 'jogging', s: 10 },
  { a: 'walking', s: 5 },
  { a: 'squatting', s: 10 },
  { a: 'still', s: 5 },
  { a: 'bending', s: 10 },
  { a: 'walking', s: 10 },
  { a: 'sitting_down', s: 5 },
  { a: 'still', s: 5 },
]

export interface Session { xyz: Float32Array; truth: Int8Array; n: number }

export function sampleSession(seed = 417): Session {
  const rng = seeded(seed)
  const pose = randomPose(rng)
  const parts: Float32Array[] = []
  const truth: number[] = []
  let tilt = 0
  for (const seg of SESSION_SCRIPT) {
    const start = seg.a === 'still' ? tilt : 0
    const { xyz, endTilt } = synthSegment(seg.a, seg.s, rng, pose, start)
    tilt = seg.a === 'sitting_down' ? endTilt : seg.a === 'still' ? tilt : 0
    parts.push(xyz)
    const idx = ACTIVITIES.indexOf(seg.a)
    for (let i = 0; i < xyz.length / 3; i++) truth.push(idx)
  }
  const n = truth.length
  const xyz = new Float32Array(n * 3)
  let o = 0
  for (const p of parts) { xyz.set(p, o); o += p.length }
  return { xyz, truth: Int8Array.from(truth), n }
}
