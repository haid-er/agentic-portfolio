/**
 * Transport for the lab: the real /api/demos/items route, or an in-browser mock that runs the
 * same generator (used offline, or when chosen). Both honour the latency and failure controls.
 */
import { applyPatch, paginate, type Item, type ItemPatch, type Override, type Page, type StatusFilter } from './dataset'

export type Transport = 'server' | 'browser'

export interface NetSettings {
  transport: Transport
  latencyMs: number
  failRate: number
}

export interface PageParams { page: number; status: StatusFilter }

const localOverrides = new Map<string, Override>()

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
  })

async function readError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } }
    return j.error?.message ?? `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

function networkError(e: unknown): Error {
  if (e instanceof DOMException && e.name === 'AbortError') return e
  return new Error('Network unreachable. Switch the transport to the in-browser API to keep going offline.')
}

export async function fetchPage(p: PageParams, net: NetSettings, signal?: AbortSignal): Promise<Page> {
  if (net.transport === 'browser') {
    await sleep(net.latencyMs, signal)
    if (net.failRate > 0 && Math.random() < net.failRate) throw new Error('Injected failure (in-browser API).')
    return paginate({ ...p, pageSize: 8 }, Date.now(), localOverrides, 'browser')
  }
  const qs = new URLSearchParams({ page: String(p.page), status: p.status, delay: String(net.latencyMs), fail: String(net.failRate) })
  let res: Response
  try {
    res = await fetch(`/api/demos/items?${qs}`, { signal, cache: 'no-store' })
  } catch (e) {
    throw networkError(e)
  }
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as Page
}

export async function patchItem(patch: ItemPatch, net: NetSettings): Promise<Item> {
  if (net.transport === 'browser') {
    await sleep(Math.max(250, net.latencyMs))
    if (patch.fail) throw new Error('Injected mutation failure (in-browser API).')
    const item = applyPatch(localOverrides, patch, Date.now())
    if (!item) throw new Error('No such item.')
    return item
  }
  let res: Response
  try {
    res = await fetch('/api/demos/items', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
  } catch (e) {
    throw networkError(e)
  }
  if (!res.ok) throw new Error(await readError(res))
  return ((await res.json()) as { item: Item }).item
}
