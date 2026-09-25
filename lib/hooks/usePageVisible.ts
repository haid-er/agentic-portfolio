'use client'
import { useSyncExternalStore } from 'react'

const subscribe = (cb: () => void) => {
  document.addEventListener('visibilitychange', cb)
  return () => document.removeEventListener('visibilitychange', cb)
}

/** false while the tab is hidden: pause canvases, timers and polling (DESIGN.md 8). */
export function usePageVisible(): boolean {
  return useSyncExternalStore(subscribe, () => document.visibilityState === 'visible', () => true)
}
