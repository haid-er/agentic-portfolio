'use client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import type { LogEntry, QueryClient, QueryState } from './queryClient'

/** Read one cache entry and keep it observed while mounted. */
export function useQuery<T>(
  client: QueryClient,
  key: string,
  label: string,
  fn: (signal: AbortSignal) => Promise<T>,
): { state: QueryState<T> | undefined; data: T | undefined; isPlaceholder: boolean } {
  const state = useSyncExternalStore(client.subscribe, () => client.getState<T>(key), () => undefined)
  // Each key keeps its own fetcher: a shared ref would let an old key's retry or refetch
  // run the current key's request and store the wrong rows under the old key.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `fn` is read once per key; setFetcher keeps it current
  useEffect(() => client.observe(key, label, fn), [client, key, label])
  // Refresh this key's fetcher every render (latest latency / failure settings), only for this key.
  useEffect(() => { client.setFetcher(key, fn) })

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
