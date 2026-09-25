'use client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { LogEntry, QueryClient, QueryState } from './queryClient'

/** Read one cache entry and keep it observed while mounted. */
export function useQuery<T>(
  client: QueryClient,
  key: string,
  label: string,
  fn: (signal: AbortSignal) => Promise<T>,
): { state: QueryState<T> | undefined; data: T | undefined; isPlaceholder: boolean } {
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn })
  const state = useSyncExternalStore(client.subscribe, () => client.getState<T>(key), () => undefined)
  useEffect(() => client.observe(key, label, (s) => fnRef.current(s)), [client, key, label])

  // keepPreviousData: while a new key loads, keep showing the last data we rendered.
  const [previous, setPrevious] = useState<T | undefined>(undefined)
  const current = state?.data
  useEffect(() => { if (current !== undefined) setPrevious(current) }, [current])
  const data = current ?? previous
  return { state, data, isPlaceholder: current === undefined && data !== undefined }
}

export function useCacheList(client: QueryClient): QueryState[] {
  return useSyncExternalStore(client.subscribe, client.list, client.list)
}

export function useCacheLog(client: QueryClient): LogEntry[] {
  return useSyncExternalStore(client.subscribe, client.getLog, client.getLog)
}

/** Current time, re-read every `ms` while `active` (drives countdowns). */
export function useNow(ms: number, active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms, active])
  return now
}
