'use client'
/**
 * Query cache lab: a paginated table backed by a small React-Query-style cache (queryClient.ts).
 * Every cache rule is on screen: fresh/stale timers, GC of inactive pages, request dedupe,
 * retries, refetch on window focus, keepPreviousData pagination with next-page prefetch, and
 * optimistic mutations that roll back when the server says no.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge, Button, DemoGrid, DemoPanel, DemoToolbar, EmptyState, ErrorState, Loading, Segmented, Toggle, useToast,
} from '@/components/ui'
import type { DemoProps } from '@/lib/demos/types'
import { useLocalStorage, usePageVisible } from '@/lib/hooks'
import { fetchPage, patchItem, type NetSettings, type Transport } from './api'
import { CacheInspector, EventLog } from './CacheInspector'
import { FILTERS, STATUSES, type Item, type Page, type StatusFilter } from './dataset'
import { useCacheList, useCacheLog, useNow, useQuery } from './hooks'
import { QueryClient } from './queryClient'
import { SpecimenTable } from './SpecimenTable'

export { notes } from './notes'

type StaleOpt = '0' | '5000' | '15000' | '60000'
type GcOpt = '10000' | '30000' | '300000'
type Latency = '150' | '900' | '2000'

interface Settings {
  stale: StaleOpt
  gc: GcOpt
  latency: Latency
  flaky: boolean
  focus: boolean
  prefetch: boolean
}

const DEFAULTS: Settings = { stale: '15000', gc: '30000', latency: '900', flaky: false, focus: true, prefetch: true }

const STALE_OPTS = [
  { value: '0', label: '0 s' }, { value: '5000', label: '5 s' }, { value: '15000', label: '15 s' }, { value: '60000', label: '60 s' },
] as const
const GC_OPTS = [{ value: '10000', label: '10 s' }, { value: '30000', label: '30 s' }, { value: '300000', label: '5 min' }] as const
const LATENCY_OPTS = [{ value: '150', label: 'Fast' }, { value: '900', label: 'Slow' }, { value: '2000', label: '3G' }] as const
const TRANSPORT_OPTS = [{ value: 'server', label: 'Server API' }, { value: 'browser', label: 'In-browser' }] as const
const FILTER_OPTS = FILTERS.map((f) => ({ value: f, label: f }))

const keyOf = (t: Transport, status: StatusFilter, page: number) => JSON.stringify(['items', t, status, page])
const labelOf = (t: Transport, status: StatusFilter, page: number) => `items · ${t} · ${status} · p${page}`
const isItemsKey = (k: string) => k.startsWith('["items"')

export default function Demo(_props: DemoProps) {
  const toast = useToast()
  const visible = usePageVisible()
  const [saved, setSaved] = useLocalStorage<Settings>('data-grid:settings', DEFAULTS)
  const settings: Settings = { ...DEFAULTS, ...saved }
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSaved((p) => ({ ...DEFAULTS, ...p, [k]: v }))

  const [transport, setTransport] = useState<Transport>(() => (typeof navigator !== 'undefined' && !navigator.onLine ? 'browser' : 'server'))
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [failNext, setFailNext] = useState(false)
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const inFlight = useRef(0)

  const [client] = useState(() => new QueryClient({ staleTime: 15000, gcTime: 30000, retry: 2, refetchOnFocus: true }))
  const net: NetSettings = useMemo(
    () => ({ transport, latencyMs: Number(settings.latency), failRate: settings.flaky ? 0.4 : 0 }),
    [transport, settings.latency, settings.flaky],
  )

  // Push settings into the client.
  useEffect(() => {
    client.setOptions({ staleTime: Number(settings.stale), gcTime: Number(settings.gc), refetchOnFocus: settings.focus })
  }, [client, settings.stale, settings.gc, settings.focus])

  // Refetch on window focus / tab becoming visible.
  useEffect(() => {
    const onFocus = () => client.onFocus('Window focus')
    const onVis = () => { if (document.visibilityState === 'visible') client.onFocus('Tab visible') }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onVis) }
  }, [client])

  // Offline-first: fall back to the in-browser API when the network drops.
  useEffect(() => {
    const off = () => { setTransport('browser'); toast('Offline: switched to the in-browser API.', { tone: 'warn' }) }
    window.addEventListener('offline', off)
    return () => window.removeEventListener('offline', off)
  }, [toast])

  useEffect(() => () => client.clear(), [client])

  const fetcher = useCallback(
    (p: number) => (signal: AbortSignal) => fetchPage({ page: p, status }, net, signal),
    [status, net],
  )
  const key = keyOf(transport, status, page)
  const { state, data, isPlaceholder } = useQuery<Page>(client, key, labelOf(transport, status, page), fetcher(page))

  // Prefetch the next page once this one has data.
  const pageCount = data?.pageCount ?? 1
  useEffect(() => {
    if (!settings.prefetch || state?.status !== 'success' || page >= pageCount) return
    client.prefetch(keyOf(transport, status, page + 1), labelOf(transport, status, page + 1), fetcher(page + 1))
  }, [client, settings.prefetch, state?.status, page, pageCount, transport, status, fetcher])

  // Clamp the page if a filter shrinks the list.
  useEffect(() => { if (data && !isPlaceholder && page > data.pageCount) setPage(data.pageCount) }, [data, isPlaceholder, page])

  const entries = useCacheList(client)
  const log = useCacheLog(client)
  const now = useNow(250, visible)

  const patchRow = (id: string, fields: Partial<Item>) =>
    client.updateData<Page>(isItemsKey, (pg) => ({ ...pg, items: pg.items.map((i) => (i.id === id ? { ...i, ...fields } : i)) }))

  async function mutate(item: Item, change: Partial<Pick<Item, 'starred' | 'status'>>, what: string) {
    if (pending.has(item.id)) return
    const match = isItemsKey
    // Like cancelQueries in onMutate: a read that started before the click must not land on top of the patch.
    client.cancel(match)
    // Rollback reverts only the fields this mutation touched, so other rows' patches survive.
    const before: Partial<Item> = Object.fromEntries(Object.keys(change).map((k) => [k, item[k as keyof typeof change]]))
    patchRow(item.id, change)
    client.record('optimistic', item.id, `${what}: cache patched before the server answers.`)
    inFlight.current++
    setPending((s) => new Set(s).add(item.id))
    const fail = failNext
    if (fail) setFailNext(false)
    try {
      await patchItem({ id: item.id, ...change, fail }, net)
      client.record('confirm', item.id, 'Server confirmed the change.')
    } catch (e) {
      patchRow(item.id, before)
      const msg = e instanceof Error ? e.message : 'Mutation failed.'
      client.record('rollback', item.id, `${msg} Changed fields reverted in the cache.`)
      toast(`Rolled back: ${item.name}. ${msg}`, { tone: 'danger' })
    } finally {
      setPending((s) => { const n = new Set(s); n.delete(item.id); return n })
      // Refetch once the last overlapping mutation settles, so a refetch cannot undo a patch still in flight.
      if (--inFlight.current === 0) client.invalidate(match, 'Mutation settled')
    }
  }

  const onStar = (it: Item) => void mutate(it, { starred: !it.starred }, it.starred ? 'Unstar' : 'Star')
  const onCycle = (it: Item) => {
    const next = STATUSES[(STATUSES.indexOf(it.status) + 1) % STATUSES.length]
    void mutate(it, { status: next }, `Status → ${next}`)
  }

  const switchTransport = (t: Transport) => { setTransport(t); setPage(1) }
  const switchFilter = (f: StatusFilter) => { setStatus(f); setPage(1) }

  const items = data?.items ?? []
  const updatedAt = state?.dataUpdatedAt ? new Date(state.dataUpdatedAt).toLocaleTimeString([], { hour12: false }) : null
  const stale = state ? client.isStale(state, now) : true
  // Branch on this key's own data, never on the placeholder borrowed from the previous page.
  const ownData = state?.data
  const failedEmpty = state?.status === 'error' && ownData === undefined
  const statusText = failedEmpty
    ? `Page ${page} could not load.`
    : state?.error && ownData
      ? `Refetch failed. Showing the cached copy of page ${page}.`
      : ownData
        ? `Page ${page} of ${pageCount}, ${ownData.items.length} ${ownData.items.length === 1 ? 'row' : 'rows'}.`
        : `Loading page ${page}.`

  return (
    <div className="grid gap-4 min-w-0">
      <DemoGrid
        aside={
          <>
            <DemoPanel title="Cache rules">
              <div className="grid gap-4">
                <Segmented label="staleTime" options={STALE_OPTS} value={settings.stale} onChange={(v) => set('stale', v)} />
                <Segmented label="gcTime (inactive pages)" options={GC_OPTS} value={settings.gc} onChange={(v) => set('gc', v)} />
                <Segmented label="Network latency" options={LATENCY_OPTS} value={settings.latency} onChange={(v) => set('latency', v)} />
                <Segmented label="Transport" options={TRANSPORT_OPTS} value={transport} onChange={switchTransport} />
                <div className="grid gap-1">
                  <Toggle label="Refetch on window focus" checked={settings.focus} onChange={(v) => set('focus', v)} />
                  <Toggle label="Prefetch next page" checked={settings.prefetch} onChange={(v) => set('prefetch', v)} />
                  <Toggle label="Flaky network (40% of reads fail, 2 retries)" checked={settings.flaky} onChange={(v) => set('flaky', v)} />
                  <Toggle label="Fail the next mutation" checked={failNext} onChange={setFailNext} />
                </div>
                <DemoToolbar>
                  <Button size="sm" variant="secondary" icon="refresh" onClick={() => client.onFocus('Simulated focus')}>Simulate focus</Button>
                  <Button size="sm" variant="secondary" onClick={() => client.invalidate(isItemsKey, 'Manual invalidate')}>Invalidate all</Button>
                </DemoToolbar>
              </div>
            </DemoPanel>
            <DemoPanel title="Cache inspector" meta={`${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`}>
              <CacheInspector
                client={client}
                entries={entries}
                now={now}
                onRefetch={(k) => void client.fetch(k, 'manual refetch')}
                onRemove={(k) => client.remove(k)}
              />
            </DemoPanel>
            <DemoPanel title="Cache events" meta="newest first">
              <EventLog log={log} />
            </DemoPanel>
          </>
        }
      >
        <DemoPanel
          title="Soil-core specimens"
          meta={
            <span className="inline-flex flex-wrap items-center gap-2">
              {state?.fetching ? <Badge tone="accent">fetching</Badge> : null}
              {state?.status === 'success' ? <Badge tone={stale ? 'warn' : 'ok'}>{stale ? 'stale' : 'fresh'}</Badge> : null}
              {updatedAt ? <span>as of {updatedAt}</span> : null}
            </span>
          }
        >
          <div className="grid gap-4">
            <Segmented label="Status filter (a separate cache key per filter)" options={FILTER_OPTS} value={status} onChange={switchFilter} />
            <p role="status" className="sr-only">{statusText}</p>
            <div aria-busy={state?.fetching ?? false} className="grid gap-3 min-w-0">
              {state?.error && ownData ? (
                <p className="m-0 text-0 text-danger">Last refetch failed: {state.error} Showing the cached copy; nothing is invented.</p>
              ) : null}
              {failedEmpty ? (
                <ErrorState title="Could not load this page" action={<Button size="sm" variant="secondary" icon="refresh" onClick={() => void client.fetch(key, 'retry button')}>Try again</Button>}>
                  {state.error}
                </ErrorState>
              ) : !data ? (
                <Loading label="Fetching page" className="py-s6" />
              ) : items.length === 0 ? (
                <EmptyState title="No specimens match this filter" />
              ) : (
                <SpecimenTable items={items} pending={pending} dim={isPlaceholder} onStar={onStar} onCycle={onCycle} />
              )}
              {isPlaceholder && state?.fetching ? <p className="m-0 mono text-ink-3">Showing the previous page while page {page} loads (keepPreviousData).</p> : null}
            </div>
            <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3">
              <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
              <span className="mono text-ink-2 nums">page {page} / {pageCount}{data ? ` · ${data.total} rows · ${data.source}` : ''}</span>
              <Button size="sm" variant="secondary" arrow onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount || ownData === undefined}>Next</Button>
            </nav>
          </div>
        </DemoPanel>
      </DemoGrid>
    </div>
  )
}
