'use client'
/**
 * Unsaved-changes guard.
 * - Tab close / reload / external navigation: the browser's own beforeunload prompt.
 * - In-app links (next/link and plain anchors): intercepted in the capture phase,
 *   before the router sees the click, and handed to `onBlocked(href)` so the
 *   editor can ask with its own dialog (stay / discard / save and leave).
 */
import { useEffect, useRef } from 'react'

export function useUnsavedGuard(dirty: boolean, onBlocked: (href: string) => void) {
  const cb = useRef(onBlocked)
  useEffect(() => {
    cb.current = onBlocked
  }, [onBlocked])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.noGuard !== undefined) return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin) return
      if (url.pathname === location.pathname && url.search === location.search) return // same page / hash
      e.preventDefault()
      e.stopPropagation()
      cb.current(url.pathname + url.search + url.hash)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])
}
