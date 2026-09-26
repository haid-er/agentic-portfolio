'use client'
/**
 * Unsaved-changes guard.
 * - Tab close / reload / external navigation: the browser's own beforeunload prompt.
 * - In-app links (next/link and plain anchors): intercepted in the capture phase,
 *   before the router sees the click, and handed to `onBlocked(href)` so the
 *   editor can ask with its own dialog (stay / discard / save and leave).
 * - Back / Forward buttons and the swipe-back gesture: while dirty, a sentinel
 *   history entry (same URL) sits on top. Going back pops it, the guard puts it
 *   back and calls `onBlocked(null)`; `guard.back()` then leaves for real.
 *
 *   const guard = useUnsavedGuard(dirty, (href) => setPending({ href }))
 *   guard.allowLeave(true); lift dirty; href ? router.push(href) : guard.back()
 */
import { useEffect, useMemo, useRef } from 'react'

const KEY = '__ghpUnsaved'

const onSentinel = () => Boolean((history.state as Record<string, unknown> | null)?.[KEY])

/** Copies the router's own state so Next still recognises the entry. */
function pushSentinel() {
  if (onSentinel()) return
  const state = (history.state as Record<string, unknown> | null) ?? {}
  history.pushState({ ...state, [KEY]: true }, '', location.href)
}

export interface UnsavedGuard {
  /** Call with true just before lifting `dirty` for a navigation, false if that navigation is abandoned. */
  allowLeave: (on: boolean) => void
  /** Go back past the sentinel entry (the "leave" answer to a blocked Back). */
  back: () => void
}

export function useUnsavedGuard(dirty: boolean, onBlocked: (href: string | null) => void): UnsavedGuard {
  const cb = useRef(onBlocked)
  const dirtyRef = useRef(dirty)
  const leaving = useRef(false)
  /** Pops we caused ourselves (removing the sentinel), not the user. */
  const selfPops = useRef(0)
  useEffect(() => {
    cb.current = onBlocked
    dirtyRef.current = dirty
  }, [onBlocked, dirty])

  // One permanent listener, so our own sentinel pops are accounted for even after the guard lifts.
  useEffect(() => {
    const onPop = () => {
      if (leaving.current) return
      if (selfPops.current > 0) {
        selfPops.current--
        if (dirtyRef.current) pushSentinel()
        return
      }
      if (!dirtyRef.current || onSentinel()) return
      pushSentinel()
      cb.current(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (!dirty) return
    const pops = selfPops // the ref object itself, not a DOM node
    leaving.current = false
    pushSentinel()
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
      // Saved or reverted while staying: drop the sentinel so Back needs one press again.
      if (!leaving.current && onSentinel()) {
        pops.current++
        history.back()
      }
    }
  }, [dirty])

  return useMemo(() => ({
    allowLeave: (on: boolean) => { leaving.current = on },
    back: () => {
      leaving.current = true
      history.go(onSentinel() ? -2 : -1)
    },
  }), [])
}
