/** Points on the [-1, 1] plane, plus seeded presets for both tasks. */
import { seeded } from '@/lib/utils'
import type { Task } from './mlp'

export interface Pt { x: number; y: number; label: number; test?: boolean }

export const CLASS_PRESETS = [
  { value: 'circle', label: 'Circle' },
  { value: 'xor', label: 'XOR' },
  { value: 'moons', label: 'Moons' },
  { value: 'spiral', label: 'Spiral' },
] as const
export const REG_PRESETS = [
  { value: 'sine', label: 'Sine' },
  { value: 'parabola', label: 'Parabola' },
  { value: 'step', label: 'Step' },
  { value: 'line', label: 'Line' },
] as const
export type ClassPreset = (typeof CLASS_PRESETS)[number]['value']
export type RegPreset = (typeof REG_PRESETS)[number]['value']
export type Preset = ClassPreset | RegPreset

const clamp = (v: number) => Math.max(-0.98, Math.min(0.98, v))

export function makePreset(preset: Preset, noise: number, seed: number): Pt[] {
  const r = seeded(seed)
  const g = () => (r() * 2 - 1) * noise
  const pts: Pt[] = []
  switch (preset) {
    case 'circle':
      for (let i = 0; i < 120; i++) {
        const inner = i % 2 === 0
        const rad = inner ? r() * 0.38 : 0.58 + r() * 0.34
        const t = r() * Math.PI * 2
        pts.push({ x: clamp(rad * Math.cos(t) + g()), y: clamp(rad * Math.sin(t) + g()), label: inner ? 1 : 0 })
      }
      break
    case 'xor':
      for (let i = 0; i < 120; i++) {
        const x = r() * 1.8 - 0.9, y = r() * 1.8 - 0.9
        const px = x + (x > 0 ? 0.05 : -0.05), py = y + (y > 0 ? 0.05 : -0.05)
        pts.push({ x: clamp(px + g()), y: clamp(py + g()), label: x * y > 0 ? 1 : 0 })
      }
      break
    case 'moons':
      for (let i = 0; i < 120; i++) {
        const top = i % 2 === 0
        const t = r() * Math.PI
        const x = top ? Math.cos(t) * 0.6 - 0.25 : 0.25 - Math.cos(t) * 0.6
        const y = top ? Math.sin(t) * 0.6 - 0.15 : 0.15 - Math.sin(t) * 0.6
        pts.push({ x: clamp(x + g()), y: clamp(y + g()), label: top ? 1 : 0 })
      }
      break
    case 'spiral':
      for (let i = 0; i < 160; i++) {
        const cls = i % 2
        const k = Math.floor(i / 2) / 80
        const t = k * 3.2 * Math.PI + cls * Math.PI
        const rad = 0.08 + k * 0.85
        pts.push({ x: clamp(rad * Math.cos(t) + g() * 0.6), y: clamp(rad * Math.sin(t) + g() * 0.6), label: cls })
      }
      break
    case 'sine':
    case 'parabola':
    case 'step':
    case 'line':
      for (let i = 0; i < 60; i++) {
        const x = r() * 1.9 - 0.95
        const y = preset === 'sine' ? 0.65 * Math.sin(3.2 * x)
          : preset === 'parabola' ? 1.5 * x * x - 0.6
          : preset === 'step' ? (x > 0.1 ? 0.5 : -0.4)
          : 0.7 * x - 0.1
        pts.push({ x, y: clamp(y + g()), label: 0 })
      }
      break
  }
  return pts
}

/** Mark ~20% of points as held out (stable per point order). */
export function withHoldout(pts: Pt[], on: boolean, seed: number): Pt[] {
  const r = seeded(seed)
  return pts.map((p) => ({ ...p, test: on && r() < 0.2 }))
}

/** Network inputs/targets for a task. Regression: x -> y (the plane is a scatter plot). */
export function toXY(pts: Pt[], task: Task) {
  const X: number[][] = [], Y: number[] = [], Xt: number[][] = [], Yt: number[] = []
  for (const p of pts) {
    const x = task === 'classification' ? [p.x, p.y] : [p.x]
    const y = task === 'classification' ? p.label : p.y
    if (p.test) { Xt.push(x); Yt.push(y) } else { X.push(x); Y.push(y) }
  }
  return { X, Y, Xt, Yt }
}
