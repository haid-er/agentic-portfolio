/**
 * Synthetic soil-core specimens shared by the /api/demos/items route and the in-browser mock.
 * Pure and server safe: no browser APIs. Every value is generated from a seed, so the server
 * and the browser produce the same rows. "Remote edits" are a function of the clock: every
 * 15 seconds one row in eight gets a new moisture reading, so refetching reveals real change.
 */
import { z } from 'zod'

export const STATUSES = ['queued', 'logged', 'archived'] as const
export type SampleStatus = (typeof STATUSES)[number]
export const FILTERS = ['all', ...STATUSES] as const
export type StatusFilter = (typeof FILTERS)[number]

export const TOTAL = 96
export const PAGE_SIZE = 8
export const DRIFT_MS = 15_000

export interface Item {
  id: string
  name: string
  site: string
  depthCm: number
  moisture: number
  status: SampleStatus
  starred: boolean
  version: number
  updatedAt: number
}

export interface Page {
  items: Item[]
  page: number
  pageSize: number
  pageCount: number
  total: number
  servedAt: number
  source: 'server' | 'browser'
}

/** Fields a visitor can change. Enums and booleans only, so no free text is ever stored. */
export const patchSchema = z.object({
  id: z.string().regex(/^c-\d{3}$/),
  starred: z.boolean().optional(),
  status: z.enum(STATUSES).optional(),
  /** Failure injection for the rollback demo. */
  fail: z.boolean().optional(),
})
export type ItemPatch = z.infer<typeof patchSchema>

export const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(50).default(1),
  pageSize: z.coerce.number().int().min(4).max(16).default(PAGE_SIZE),
  status: z.enum(FILTERS).default('all'),
  delay: z.coerce.number().int().min(0).max(2500).default(300),
  fail: z.coerce.number().min(0).max(1).default(0),
})
export type ItemsQuery = z.infer<typeof querySchema>

/** Mutations kept by whoever serves the data (server memory or the tab). */
export interface Override { starred?: boolean; status?: SampleStatus; version: number; at: number }

const SITES = ['North field', 'Riverbank', 'Terrace', 'Orchard', 'Quarry edge', 'Wetland', 'Hillslope', 'Pasture']
const BASE_TIME = Date.UTC(2026, 0, 5, 9, 0, 0)

/** Small integer hash, enough to spread seeds. */
function hash(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)
  h ^= h >>> 15
  h = Math.imul(h, 0x27d4eb2f)
  return (h ^ (h >>> 13)) >>> 0
}

function lastDriftEpoch(idx: number, now: number): number {
  const epoch = Math.floor(now / DRIFT_MS)
  return epoch - ((idx + epoch) % 8)
}

/** Build row `idx` as it looks at time `now`, with any override applied. */
export function materialize(idx: number, now: number, ov?: Override): Item {
  const epoch = lastDriftEpoch(idx, now)
  const driftAt = epoch * DRIFT_MS
  const baseStatus = STATUSES[hash(idx, 7) % 3]
  return {
    id: `c-${String(idx + 1).padStart(3, '0')}`,
    name: `Core ${String.fromCharCode(65 + (idx % 6))}-${String(100 + idx * 7).slice(-3)}`,
    site: SITES[hash(idx, 3) % SITES.length],
    depthCm: 10 + (hash(idx, 5) % 90),
    moisture: 8 + (hash(idx, epoch) % 340) / 10,
    status: ov?.status ?? baseStatus,
    starred: ov?.starred ?? hash(idx, 11) % 9 === 0,
    version: ov?.version ?? 1,
    updatedAt: Math.max(BASE_TIME, driftAt, ov?.at ?? 0),
  }
}

export function indexOfId(id: string): number {
  const n = Number(id.slice(2)) - 1
  return Number.isInteger(n) && n >= 0 && n < TOTAL ? n : -1
}

/** Filter and paginate. Pages past the end clamp to the last page. */
export function paginate(
  q: Pick<ItemsQuery, 'page' | 'pageSize' | 'status'>,
  now: number,
  overrides: Map<string, Override>,
  source: Page['source'],
): Page {
  const all: Item[] = []
  for (let i = 0; i < TOTAL; i++) {
    const id = `c-${String(i + 1).padStart(3, '0')}`
    const item = materialize(i, now, overrides.get(id))
    if (q.status === 'all' || item.status === q.status) all.push(item)
  }
  const pageCount = Math.max(1, Math.ceil(all.length / q.pageSize))
  const page = Math.min(q.page, pageCount)
  const start = (page - 1) * q.pageSize
  return { items: all.slice(start, start + q.pageSize), page, pageSize: q.pageSize, pageCount, total: all.length, servedAt: now, source }
}

/** Apply a patch to an override map. Returns the updated item, or null for an unknown id. */
export function applyPatch(overrides: Map<string, Override>, p: ItemPatch, now: number): Item | null {
  const idx = indexOfId(p.id)
  if (idx < 0) return null
  const current = materialize(idx, now, overrides.get(p.id))
  const next: Override = {
    starred: p.starred ?? current.starred,
    status: p.status ?? current.status,
    version: current.version + 1,
    at: now,
  }
  overrides.set(p.id, next)
  return materialize(idx, now, next)
}
