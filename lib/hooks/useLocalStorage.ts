'use client'
import { useCallback, useEffect, useState } from 'react'

/** JSON state persisted in localStorage (namespaced "ghp:"), safe in private mode and SSR. */
export function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const k = `ghp:${key}`
  const [value, setValue] = useState<T>(initial)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(k)
      if (raw != null) setValue(JSON.parse(raw) as T)
    } catch { /* ignore */ }
  }, [k])
  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v
      try { localStorage.setItem(k, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [k])
  return [value, set]
}
