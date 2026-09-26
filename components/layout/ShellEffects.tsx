'use client'
/**
 * Page-level side effects owned by the shell (renders nothing):
 * html[data-hidden] while the tab is hidden, so globals.css pauses the ambient
 * accent motion (DESIGN.md 8).
 */
import { useEffect } from 'react'

export function ShellEffects() {
  useEffect(() => {
    const d = document.documentElement
    const sync = () => {
      if (document.hidden) d.setAttribute('data-hidden', '')
      else d.removeAttribute('data-hidden')
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [])
  return null
}
