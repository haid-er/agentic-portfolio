'use client'
import { useEffect, useState } from 'react'

/**
 * Current time, re-read every `ms` while `active` (for the deploy clock).
 * `initial` must be the same value on server and client (e.g. the server's
 * checkedAt) so the first render hydrates without a text mismatch.
 */
export function useNow(active: boolean, ms = 1000, initial = 0): number {
  const [now, setNow] = useState(initial)
  useEffect(() => {
    setNow(Date.now())
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(id)
  }, [active, ms])
  return now
}
