'use client'
import { useSyncExternalStore } from 'react'

const Q = '(prefers-reduced-motion: reduce)'
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(Q)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

/** true when the user asked for reduced motion (SSR: false). */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(Q).matches, () => false)
}
