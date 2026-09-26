/**
 * Deterministic telemetry generator shared by the edge SSE route and the in-browser fallback.
 * A reading is a pure function of (scenario, seed, seq, device, metric), so a reconnecting
 * client that resumes from `Last-Event-ID` gets exactly the stream it would have seen.
 * Server-safe: no DOM, no Node APIs.
 */

export type ScenarioId = 'fleet' | 'wearables'
export type Direction = 'above' | 'below'

export interface MetricDef {
  id: string
  label: string
  unit: string
  min: number
  max: number
  threshold: number
  dir: Direction
  decimals: number
}

export interface ScenarioDef { id: ScenarioId; label: string; devices: string[]; metrics: MetricDef[] }

export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  fleet: {
    id: 'fleet',
    label: 'Fleet',
    devices: ['van-01', 'van-02', 'van-03'],
    metrics: [
      { id: 'speed', label: 'Speed', unit: 'km/h', min: 0, max: 140, threshold: 100, dir: 'above', decimals: 0 },
      { id: 'coolant', label: 'Coolant temp', unit: '°C', min: 70, max: 120, threshold: 104, dir: 'above', decimals: 1 },
      { id: 'battery', label: 'Battery', unit: 'V', min: 11, max: 15, threshold: 12, dir: 'below', decimals: 2 },
    ],
  },
  wearables: {
    id: 'wearables',
    label: 'Wearables',
    devices: ['wrist-a', 'wrist-b', 'wrist-c'],
    metrics: [
      { id: 'accel', label: 'Acceleration |a|', unit: 'g', min: 0, max: 4, threshold: 2.6, dir: 'above', decimals: 2 },
      { id: 'hr', label: 'Heart rate', unit: 'bpm', min: 40, max: 200, threshold: 160, dir: 'above', decimals: 0 },
      { id: 'spo2', label: 'SpO₂', unit: '%', min: 80, max: 100, threshold: 92, dir: 'below', decimals: 1 },
    ],
  },
}

export const HZ_MIN = 1
export const HZ_MAX = 5

/** Integer hash -> [0, 1). Stable across runtimes. */
export function hash(...parts: number[]): number {
  let h = 0x811c9dc5
  for (const p of parts) {
    h ^= p | 0
    h = Math.imul(h, 0x01000193)
    h ^= h >>> 13
    h = Math.imul(h, 0x5bd1e995)
    h ^= h >>> 15
  }
  return (h >>> 0) / 4294967296
}

/** Smooth value noise in [-1, 1] over seq, keyed by k. */
function smooth(seed: number, k: number, x: number, period: number): number {
  const p = x / period
  const i = Math.floor(p)
  const f = p - i
  const a = hash(seed, k, i) * 2 - 1
  const b = hash(seed, k, i + 1) * 2 - 1
  const t = f * f * (3 - 2 * f)
  return a + (b - a) * t
}

const BLOCK = 48
/** 0..1 envelope of an anomaly episode (u is time in half-seconds), or 0. About one episode per device per ~3 blocks. */
function anomaly(seed: number, dev: number, metric: number, u: number): number {
  const block = Math.floor(u / BLOCK)
  const r = hash(seed, 9000 + dev, metric, block)
  if (r > 0.35) return 0
  const start = Math.floor(hash(seed, 7000 + dev, metric, block) * (BLOCK - 12))
  const len = 5 + Math.floor(hash(seed, 5000 + dev, metric, block) * 6)
  const pos = u - block * BLOCK - start
  if (pos < 0 || pos >= len) return 0
  return Math.sin((Math.PI * pos) / len)
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** One reading. `hz` stretches the waveforms so signals look the same at any rate. */
export function reading(scenario: ScenarioId, seed: number, seq: number, dev: number, metric: number, hz: number): number {
  const m = SCENARIOS[scenario].metrics[metric] as MetricDef
  const x = seq / hz
  const k = dev * 16 + metric
  const slow = smooth(seed, k, x, 22 + dev * 5)
  const mid = smooth(seed, k + 100, x, 6)
  const jitter = hash(seed, k + 200, seq) * 2 - 1
  const spike = anomaly(seed, dev, metric, x * 2)
  let v: number
  if (scenario === 'fleet') {
    if (m.id === 'speed') v = 62 + 30 * slow + 9 * mid + 2 * jitter + 42 * spike
    else if (m.id === 'coolant') v = 90 + 3 * slow + 1.2 * mid + 0.3 * jitter + 19 * spike
    else v = 13.6 + 0.35 * slow + 0.12 * mid + 0.03 * jitter - 2.1 * spike
  } else {
    if (m.id === 'accel') v = 1.05 + 0.35 * Math.abs(slow) + 0.25 * Math.abs(mid) + 0.06 * jitter + 2.2 * spike
    else if (m.id === 'hr') v = 92 + 26 * slow + 7 * mid + 1.5 * jitter + 70 * spike
    else v = 97.4 + 0.9 * slow + 0.3 * mid + 0.15 * jitter - 9 * spike
  }
  return round(clamp(v, m.min, m.max), m.decimals)
}

export interface Frame { seq: number; ts: number; values: number[][] }

export function frame(scenario: ScenarioId, seed: number, seq: number, hz: number, ts: number): Frame {
  const def = SCENARIOS[scenario]
  return {
    seq,
    ts,
    values: def.devices.map((_, d) => def.metrics.map((__, m) => reading(scenario, seed, seq, d, m, hz))),
  }
}

export const isBreach = (m: MetricDef, v: number, threshold: number) => (m.dir === 'above' ? v > threshold : v < threshold)
