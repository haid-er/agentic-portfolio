'use client'
/**
 * Keeps the chosen world on <html> after hydration (renders nothing). Owner: shell.
 * The no-flash script sets data-theme before paint; if React recovers from a
 * hydration error by re-rendering the root, the attribute falls back to the
 * server default, so this puts the visitor's world back.
 */
import { useEffect } from 'react'
import { restoreChosenTheme } from '@/lib/theme/client'

export function ThemeKeeper() {
  useEffect(() => {
    restoreChosenTheme()
  }, [])
  return null
}
