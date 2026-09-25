'use client'
import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * IntersectionObserver hook. `once` keeps it true after first view
 * (entrances, lazy mounting); otherwise it tracks visibility (pause canvases off-screen).
 */
export function useInView<T extends Element>(
  opts: { rootMargin?: string; threshold?: number; once?: boolean } = {},
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)
  const { rootMargin = '0px', threshold = 0, once = false } = opts
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (!e) return
      if (e.isIntersecting) { setInView(true); if (once) io.disconnect() }
      else if (!once) setInView(false)
    }, { rootMargin, threshold })
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin, threshold, once])
  return [ref, inView]
}
