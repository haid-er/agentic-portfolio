'use client'
import { useEffect, useRef, useState } from 'react'
import { readTokens, useThemeKey } from '@/lib/theme/client'

export interface CanvasSize { w: number; h: number; dpr: number }

/** Keeps a canvas' backing store matched to its CSS box (and devicePixelRatio). */
export function useCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = useState<CanvasSize>({ w: 0, h: 0, dpr: 1 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.max(1, Math.round(r.width))
      const h = Math.max(1, Math.round(r.height))
      el.width = w * dpr
      el.height = h * dpr
      setSize({ w, h, dpr })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

const INK_NAMES = ['--surface', '--bg-2', '--ink', '--ink-2', '--ink-3', '--rule', '--rule-soft', '--accent', '--accent-2', '--focus', '--data-1', '--data-2', '--data-3', '--data-4', '--on-accent', '--font-mono'] as const
export type Inks = Record<(typeof INK_NAMES)[number], string>

/** The current world's inks for canvas drawing; re-read when the theme flips. */
export function useInks(): Inks | null {
  const theme = useThemeKey()
  const [inks, setInks] = useState<Inks | null>(null)
  useEffect(() => {
    // Wait one frame so the new world's custom properties are applied.
    const id = requestAnimationFrame(() => setInks(readTokens(INK_NAMES)))
    return () => cancelAnimationFrame(id)
  }, [theme])
  return inks
}
