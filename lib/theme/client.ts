'use client'
/**
 * Client theme helpers. Owner: seo-theme (the shell's switcher calls setTheme()).
 * Demos that draw with canvas should use `useThemeKey()` and re-read tokens
 * with `readToken()` when it changes (DESIGN.md 10: previews redraw in the current world's inks).
 */
import { useSyncExternalStore } from 'react'
import { THEME_KEYS, type ThemeKey } from '@/lib/content/schema'
import { THEME_EVENT, THEME_STORAGE_KEY } from './index'

const isKey = (v: string | null | undefined): v is ThemeKey =>
  (THEME_KEYS as readonly string[]).includes(v ?? '')

export function getThemeKey(): ThemeKey {
  if (typeof document === 'undefined') return 'almanac'
  const t = document.documentElement.getAttribute('data-theme')
  return isKey(t) ? t : 'almanac'
}

/**
 * Flip the world immediately (the switcher wraps this in its transition).
 * `color-scheme` and the browser chrome colour follow the world's own tokens
 * (content/theme.json `reads` + `--bg`), so a retuned world stays consistent.
 */
export function setTheme(key: ThemeKey, opts: { persist?: boolean } = {}) {
  const d = document.documentElement
  d.setAttribute('data-theme', key)
  d.style.colorScheme = '' // drop the previous inline value so the world's own color-scheme is read
  const cs = getComputedStyle(d)
  const scheme = cs.getPropertyValue('color-scheme').trim() || (key === 'strata' ? 'dark' : 'light')
  d.style.colorScheme = scheme
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', scheme)
  const bg = cs.getPropertyValue('--bg').trim()
  if (bg) document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg))
  if (opts.persist !== false) {
    try { localStorage.setItem(THEME_STORAGE_KEY, key) } catch { /* private mode */ }
  }
  window.dispatchEvent(new CustomEvent<ThemeKey>(THEME_EVENT, { detail: key }))
}

/** Forget the stored choice; the next load follows `?theme=`, the admin default or the OS. */
export function clearStoredTheme() {
  try { localStorage.removeItem(THEME_STORAGE_KEY) } catch { /* private mode */ }
}

function subscribe(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb)
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => { window.removeEventListener(THEME_EVENT, cb); mo.disconnect() }
}

/** Current world key; re-renders on switch. SSR snapshot is 'almanac'. */
export function useThemeKey(): ThemeKey {
  return useSyncExternalStore(subscribe, getThemeKey, () => 'almanac' as ThemeKey)
}

/** Resolved value of a CSS token (e.g. readToken('--data-1')) on `el` (default <html>). */
export function readToken(name: `--${string}`, el?: Element | null): string {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(el ?? document.documentElement).getPropertyValue(name).trim()
}

/** Several tokens at once, e.g. readTokens(['--data-1', '--data-2']) for a canvas palette. */
export function readTokens<N extends `--${string}`>(names: readonly N[], el?: Element | null): Record<N, string> {
  const out = {} as Record<N, string>
  if (typeof window === 'undefined') {
    for (const n of names) out[n] = ''
    return out
  }
  const cs = getComputedStyle(el ?? document.documentElement)
  for (const n of names) out[n] = cs.getPropertyValue(n).trim()
  return out
}
