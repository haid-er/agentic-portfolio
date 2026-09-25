'use client'
import { useEffect, useRef, useState } from 'react'

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
