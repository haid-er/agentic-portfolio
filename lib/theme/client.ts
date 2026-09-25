'use client'
/**
 * Client theme helpers. Owner: seo-theme (the shell's switcher calls setTheme()).
 * Demos that draw with canvas should use `useThemeKey()` and re-read tokens
 * with `readToken()` when it changes (DESIGN.md 10: previews redraw in the current world's inks).
 */
import { useSyncExternalStore } from 'react'
import { THEME_KEYS, type ThemeKey } from '@/lib/content/schema'
import { THEME_EVENT, THEME_STORAGE_KEY } from './index'

export function getThemeKey(): ThemeKey {
  if (typeof document === 'undefined') return 'almanac'
  const t = document.documentElement.getAttribute('data-theme')
  return (THEME_KEYS as readonly string[]).includes(t ?? '') ? (t as ThemeKey) : 'almanac'
}

/** Flip the world immediately (the switcher wraps this in its transition). */
export function setTheme(key: ThemeKey, opts: { persist?: boolean } = {}) {
  const d = document.documentElement
  d.setAttribute('data-theme', key)
  const scheme = key === 'strata' ? 'dark' : 'light'
  d.style.colorScheme = scheme
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', scheme)
  if (opts.persist !== false) {
    try { localStorage.setItem(THEME_STORAGE_KEY, key) } catch { /* private mode */ }
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: key }))
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
