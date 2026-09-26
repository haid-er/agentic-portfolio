/**
 * System design model: components, allowed wiring and a small queueing simulation.
 *
 * It is a flow model, not a packet simulator. Every tick, offered load flows from the client
 * through the graph; each node serves up to its capacity and drops the rest, and its latency
 * grows as utilisation approaches 1 (base / (1 - rho), the M/M/1 shape). Queues keep a backlog
 * between ticks, so an under-provisioned worker pool shows up as growing lag, not errors.
 * The capacities are round illustrative numbers, not benchmarks of any cloud service.
 */

export type Kind = 'client' | 'lb' | 'api' | 'cache' | 'queue' | 'worker' | 'db'
export type Cloud = 'generic' | 'aws' | 'azure'

export interface NodeT { id: string; kind: Kind; x: number; y: number; replicas: number; hitRate?: number }
export interface Edge { from: string; to: string }
export interface Design { nodes: NodeT[]; edges: Edge[] }
export interface Load { rps: number; readRatio: number }

export interface Spec {
  label: string
  short: string
  /** Requests per second one replica serves. */
  cap: number
  /** Latency in ms when idle. */
  base: number
  maxReplicas: number
  names: Record<Cloud, string>
  blurb: string
}

export const SPEC: Record<Kind, Spec> = {
  client: { label: 'Clients', short: 'Clients', cap: Infinity, base: 0, maxReplicas: 1, names: { generic: 'Browsers and apps', aws: 'Route 53 + CloudFront', azure: 'Front Door' }, blurb: 'Where the load comes from.' },
  lb: { label: 'Load balancer', short: 'LB', cap: 50000, base: 1, maxReplicas: 2, names: { generic: 'L7 load balancer', aws: 'Application Load Balancer', azure: 'Application Gateway' }, blurb: 'Spreads requests across every API instance behind it.' },
  api: { label: 'API service', short: 'API', cap: 800, base: 12, maxReplicas: 12, names: { generic: 'Stateless API', aws: 'ECS Fargate service', azure: 'App Service' }, blurb: 'Stateless request handlers. Scale out by adding instances.' },
  cache: { label: 'Cache', short: 'Cache', cap: 40000, base: 1, maxReplicas: 4, names: { generic: 'Redis', aws: 'ElastiCache for Redis', azure: 'Azure Cache for Redis' }, blurb: 'Serves reads from memory. Misses read through to the database.' },
  queue: { label: 'Queue', short: 'Queue', cap: 10000, base: 3, maxReplicas: 4, names: { generic: 'Message queue', aws: 'SQS', azure: 'Service Bus' }, blurb: 'Accepts writes instantly and lets workers drain them at their own pace.' },
  worker: { label: 'Workers', short: 'Worker', cap: 250, base: 40, maxReplicas: 12, names: { generic: 'Background workers', aws: 'Lambda / ECS tasks', azure: 'Functions' }, blurb: 'Consume queued jobs and write them to the database.' },
  db: { label: 'Database', short: 'DB', cap: 1500, base: 8, maxReplicas: 5, names: { generic: 'PostgreSQL', aws: 'RDS for PostgreSQL', azure: 'Azure Database for PostgreSQL' }, blurb: 'One primary takes every write. Extra replicas only add read capacity.' },
}

export const PALETTE: Kind[] = ['lb', 'api', 'cache', 'queue', 'worker', 'db']
export const MAX_NODES = 14

/** Which component may send traffic to which. */
export const ALLOWED: Record<Kind, Kind[]> = {
  client: ['lb', 'api'],
  lb: ['api'],
  api: ['cache', 'queue', 'db'],
  cache: ['db'],
  queue: ['worker'],
  worker: ['db'],
  db: [],
}

export function canConnect(d: Design, from: string, to: string): string | null {
  if (from === to) return 'A component cannot connect to itself.'
  const a = d.nodes.find((n) => n.id === from)
  const b = d.nodes.find((n) => n.id === to)
  if (!a || !b) return 'That component no longer exists.'
  if (d.edges.some((e) => e.from === from && e.to === to)) return 'Those two are already connected.'
  if (!ALLOWED[a.kind].includes(b.kind)) {
    const ok = ALLOWED[a.kind].map((k) => SPEC[k].short).join(', ')
    return ok ? `${SPEC[a.kind].label} can send traffic to: ${ok}.` : `${SPEC[a.kind].label} does not call anything downstream.`
  }
  return null
}

// ---- simulation --------------------------------------------------------------------------

export interface NodeStat {
  in: number
  served: number
  dropped: number
  util: number
  lat: number
  note?: string
  backlog?: number
}

export interface SimResult {
  nodes: Record<string, NodeStat>
  flows: Record<string, number>
  backlog: Record<string, number>
  offered: number
  ok: number
  errorRate: number
  latency: number
  asyncLag: number
  bottleneck: string | null
  hints: string[]
}

export const edgeKey = (a: string, b: string) => `${a}>${b}`
const MAX_BACKLOG = 2_000_000
const TIMEOUT_MS = 3000

/** Latency of a node at a given utilisation: base / (1 - rho), saturating towards the timeout. */
export function latencyAt(base: number, util: number): number {
  if (base === 0) return 0
  if (util >= 1) return Math.min(TIMEOUT_MS, base * 25 * util)
  return base / (1 - Math.min(util, 0.96))
}

export function simulate(d: Design, load: Load, prevBacklog: Record<string, number>, dt: number): SimResult {
  const byId = new Map(d.nodes.map((n) => [n.id, n]))
  const out = (id: string, kind?: Kind) =>
    d.edges.filter((e) => e.from === id).map((e) => byId.get(e.to)).filter((n): n is NodeT => Boolean(n) && (!kind || n?.kind === kind))
  const stats: Record<string, NodeStat> = {}
  for (const n of d.nodes) stats[n.id] = { in: 0, served: 0, dropped: 0, util: 0, lat: 0 }
  const flows: Record<string, number> = {}
  const flow = (a: string, b: string, v: number) => { if (v > 0) flows[edgeKey(a, b)] = (flows[edgeKey(a, b)] ?? 0) + v }
  const hints: string[] = []
  const r = Math.min(1, Math.max(0, load.readRatio))
  const offered = Math.max(0, load.rps)
  let failed = 0

  // 1. Clients
  const client = d.nodes.find((n) => n.kind === 'client')
  const entry = client ? out(client.id).filter((n) => n.kind === 'lb' || n.kind === 'api') : []
  const direct = new Set<string>()
  if (!client || entry.length === 0) {
    failed += offered
    hints.push('Nothing is serving traffic yet. Connect Clients to a load balancer or an API.')
  } else {
    for (const n of entry) {
      const share = offered / entry.length
      stats[n.id].in += share
      flow(client.id, n.id, share)
      if (n.kind === 'api') direct.add(n.id)
    }
  }

  // 2. Load balancers
  for (const lb of d.nodes.filter((n) => n.kind === 'lb')) {
    const s = stats[lb.id]
    const cap = SPEC.lb.cap * lb.replicas
    s.served = Math.min(s.in, cap)
    s.dropped = s.in - s.served
    s.util = s.in / cap
    failed += s.dropped
    const apis = out(lb.id, 'api')
    if (!apis.length) {
      if (s.served > 0) { failed += s.served; s.note = 'no API behind it'; hints.push('The load balancer has nothing behind it. Connect it to an API.') }
      continue
    }
    const weight = apis.reduce((t, a) => t + a.replicas, 0)
    for (const a of apis) {
      const share = (s.served * a.replicas) / weight
      stats[a.id].in += share
      flow(lb.id, a.id, share)
    }
  }

  // 3. APIs: split into reads and writes, route them.
  const dbSync: Record<string, { reads: number; writes: number }> = {}
  const addDb = (id: string, reads: number, writes: number) => {
    const x = (dbSync[id] ??= { reads: 0, writes: 0 })
    x.reads += reads
    x.writes += writes
  }
  interface ApiPath { id: string; served: number; viaLb: boolean; caches: string[]; queues: string[]; dbs: string[] }
  const apiPaths: ApiPath[] = []
  for (const api of d.nodes.filter((n) => n.kind === 'api')) {
    const s = stats[api.id]
    if (s.in === 0) continue
    const noLb = direct.has(api.id)
    const effReplicas = noLb ? 1 : api.replicas
    if (noLb && api.replicas > 1) {
      s.note = `only 1 of ${api.replicas} reachable`
      hints.push(`Clients call the API directly, so only 1 of its ${api.replicas} instances gets traffic. Put a load balancer in front.`)
    }
    const cap = SPEC.api.cap * effReplicas
    s.served = Math.min(s.in, cap)
    s.dropped = s.in - s.served
    s.util = s.in / cap
    failed += s.dropped
    const reads = s.served * r
    const writes = s.served - reads
    const caches = out(api.id, 'cache')
    const queues = out(api.id, 'queue')
    const dbs = out(api.id, 'db')
    // reads
    if (caches.length) {
      for (const c of caches) { stats[c.id].in += reads / caches.length; flow(api.id, c.id, reads / caches.length) }
    } else if (dbs.length) {
      for (const db of dbs) { addDb(db.id, reads / dbs.length, 0); flow(api.id, db.id, reads / dbs.length) }
    } else if (reads > 0) {
      failed += reads
      s.note = 'reads have nowhere to go'
      hints.push('The API has no cache or database to read from, so reads fail. Connect it to a database.')
    }
    // writes
    if (queues.length) {
      for (const q of queues) { stats[q.id].in += writes / queues.length; flow(api.id, q.id, writes / queues.length) }
    } else if (dbs.length) {
      for (const db of dbs) { addDb(db.id, 0, writes / dbs.length); flow(api.id, db.id, writes / dbs.length) }
    } else if (writes > 0) {
      failed += writes
      s.note = s.note ?? 'writes have nowhere to go'
      hints.push('Writes have nowhere to go. Connect the API to a database or a queue.')
    }
    apiPaths.push({ id: api.id, served: s.served, viaLb: !noLb, caches: caches.map((c) => c.id), queues: queues.map((q) => q.id), dbs: dbs.map((x) => x.id) })
  }

  // 4. Caches: hits end here, misses read through.
  const cacheDb: Record<string, string[]> = {}
  for (const c of d.nodes.filter((n) => n.kind === 'cache')) {
    const s = stats[c.id]
    const cap = SPEC.cache.cap * c.replicas
    s.served = Math.min(s.in, cap)
    s.dropped = s.in - s.served
    s.util = s.in / cap
    failed += s.dropped
    const misses = s.served * (1 - (c.hitRate ?? 0.85))
    const dbs = out(c.id, 'db')
    cacheDb[c.id] = dbs.map((x) => x.id)
    if (dbs.length) {
      for (const db of dbs) { addDb(db.id, misses / dbs.length, 0); flow(c.id, db.id, misses / dbs.length) }
    } else if (misses > 0) {
      failed += misses
      s.note = 'misses fail'
      hints.push('Cache misses have no database to read through to. Connect the cache to the database.')
    }
  }

  // 5. Queues + workers: backlog carries over; workers try to drain it.
  const backlog: Record<string, number> = {}
  const workerAttempt: Record<string, { db: string[]; jobs: number; queue: string }> = {}
  for (const q of d.nodes.filter((n) => n.kind === 'queue')) {
    const s = stats[q.id]
    const cap = SPEC.queue.cap * q.replicas
    s.served = Math.min(s.in, cap)
    s.dropped = s.in - s.served
    failed += s.dropped
    let b = (prevBacklog[q.id] ?? 0) + s.served * dt
    const workers = out(q.id, 'worker')
    const wcap = workers.reduce((t, w) => t + SPEC.worker.cap * w.replicas, 0)
    const drain = Math.min(b / Math.max(dt, 1e-6), wcap)
    for (const w of workers) {
      const share = wcap ? drain * ((SPEC.worker.cap * w.replicas) / wcap) : 0
      workerAttempt[w.id] = { db: out(w.id, 'db').map((x) => x.id), jobs: share, queue: q.id }
      stats[w.id].in += share
      flow(q.id, w.id, share)
    }
    s.util = wcap ? s.served / wcap : s.served > 0 ? Infinity : 0
    backlog[q.id] = b
    if (!workers.length && s.served > 0) { s.note = 'no consumer'; hints.push('Nothing consumes the queue, so jobs pile up forever. Connect it to workers.') }
    b = Math.min(b, MAX_BACKLOG)
    backlog[q.id] = b
  }

  // Worker writes join the database demand (as async writes).
  const dbAsync: Record<string, number> = {}
  for (const w of d.nodes.filter((n) => n.kind === 'worker')) {
    const a = workerAttempt[w.id]
    const s = stats[w.id]
    const cap = SPEC.worker.cap * w.replicas
    s.util = a ? a.jobs / cap : 0
    if (!a || a.jobs === 0) continue
    if (!a.db.length) { s.note = 'nowhere to write'; hints.push('Workers have no database to write to. Connect them to the database.'); continue }
    for (const db of a.db) { dbAsync[db] = (dbAsync[db] ?? 0) + a.jobs / a.db.length; flow(w.id, db, a.jobs / a.db.length) }
  }

  // 6. Databases: one primary for writes, replicas share reads.
  const dbFactor: Record<string, number> = {}
  for (const db of d.nodes.filter((n) => n.kind === 'db')) {
    const s = stats[db.id]
    const sync = dbSync[db.id] ?? { reads: 0, writes: 0 }
    const asyncW = dbAsync[db.id] ?? 0
    const writes = sync.writes + asyncW
    const primaryLoad = writes + sync.reads / db.replicas
    s.in = sync.reads + writes
    s.util = primaryLoad / SPEC.db.cap
    const f = s.util > 1 ? 1 / s.util : 1
    dbFactor[db.id] = f
    s.served = s.in * f
    s.dropped = (sync.reads + sync.writes) * (1 - f)
    failed += s.dropped
    if (s.util > 0.85) {
      if (writes > sync.reads / db.replicas) s.note = 'primary saturated by writes'
      else s.note = 'reads saturate it'
    }
  }

  // Worker jobs that the database could not take stay in the queue (retried next tick).
  for (const [wid, a] of Object.entries(workerAttempt)) {
    if (!a.db.length) continue
    const f = a.db.reduce((t, id) => t + (dbFactor[id] ?? 1), 0) / a.db.length
    const done = a.jobs * f
    stats[wid].served = done
    backlog[a.queue] = Math.max(0, (backlog[a.queue] ?? 0) - done * dt)
  }
  for (const q of d.nodes.filter((n) => n.kind === 'queue')) stats[q.id].backlog = backlog[q.id] ?? 0

  // 7. Latency per node, then per request path.
  for (const n of d.nodes) {
    const s = stats[n.id]
    s.lat = latencyAt(SPEC[n.kind].base, Number.isFinite(s.util) ? s.util : 1)
  }
  const dbLat = (ids: string[]) => (ids.length ? ids.reduce((t, id) => t + stats[id].lat, 0) / ids.length : 0)
  let latSum = 0
  let latW = 0
  for (const p of apiPaths) {
    const lbLat = p.viaLb ? Math.max(0, ...d.nodes.filter((n) => n.kind === 'lb').map((n) => stats[n.id].lat)) : 0
    const readLat = p.caches.length
      ? p.caches.reduce((t, c) => {
          const node = byId.get(c)
          return t + stats[c].lat + (1 - (node?.hitRate ?? 0.85)) * dbLat(cacheDb[c] ?? [])
        }, 0) / p.caches.length
      : dbLat(p.dbs)
    const writeLat = p.queues.length ? p.queues.reduce((t, q) => t + stats[q].lat, 0) / p.queues.length : dbLat(p.dbs)
    const lat = lbLat + stats[p.id].lat + r * readLat + (1 - r) * writeLat
    latSum += lat * p.served
    latW += p.served
  }

  // Async lag: how long a job waits in the queue at the current drain rate.
  let asyncLag = 0
  for (const q of d.nodes.filter((n) => n.kind === 'queue')) {
    const b = backlog[q.id] ?? 0
    const drain = out(q.id, 'worker').reduce((t, w) => t + (stats[w.id].served || 0), 0)
    if (b > 1) asyncLag = Math.max(asyncLag, drain > 0 ? b / drain : Infinity)
  }

  // 8. Bottleneck and advice.
  let bottleneck: string | null = null
  let worst = 0.7
  for (const n of d.nodes) {
    if (n.kind === 'client') continue
    const u = stats[n.id].util
    if (u > worst) { worst = u; bottleneck = n.id }
  }
  if (bottleneck) hints.unshift(adviceFor(byId.get(bottleneck) as NodeT, stats[bottleneck], d, r))

  const ok = Math.max(0, offered - failed)
  return {
    nodes: stats, flows, backlog, offered, ok,
    errorRate: offered > 0 ? Math.min(1, failed / offered) : 0,
    latency: latW > 0 ? latSum / latW : 0,
    asyncLag,
    bottleneck,
    hints: [...new Set(hints)].slice(0, 4),
  }
}

function adviceFor(n: NodeT, s: NodeStat, d: Design, readRatio: number): string {
  const pct = Number.isFinite(s.util) ? `${Math.round(s.util * 100)}%` : 'overloaded'
  const hasKind = (k: Kind) => d.nodes.some((x) => x.kind === k)
  switch (n.kind) {
    case 'api':
      if (d.edges.some((e) => e.to === n.id && d.nodes.find((x) => x.id === e.from)?.kind === 'client')) {
        return `API at ${pct}: one instance can only take so much. Add a load balancer in front, then add instances.`
      }
      return n.replicas < SPEC.api.maxReplicas
        ? `API at ${pct}: add instances behind the load balancer (horizontal scaling).`
        : `API at ${pct} with every instance in use: add a second API service, or cache more so each request is cheaper.`
    case 'db':
      if (s.note === 'primary saturated by writes') {
        return hasKind('queue')
          ? `Database primary at ${pct} from writes. Replicas will not help writes; slow the workers down or batch writes.`
          : `Database primary at ${pct} from writes. Replicas only add read capacity, so move writes onto a queue with workers.`
      }
      return hasKind('cache')
        ? `Database at ${pct} from reads: raise the cache hit rate or add read replicas.`
        : `Database at ${pct}${readRatio > 0.5 ? ', mostly reads' : ''}: add a cache in front of it, or read replicas.`
    case 'queue':
      return `Workers drain slower than writes arrive (${pct} of their capacity). Add worker replicas or the backlog keeps growing.`
    case 'worker':
      return `Workers at ${pct}: add replicas to drain the queue faster.`
    case 'cache':
      return `Cache at ${pct}: add cache nodes (shards).`
    case 'lb':
      return `Load balancer at ${pct}: add a second one.`
    default:
      return `${SPEC[n.kind].label} at ${pct}.`
  }
}

// ---- presets -----------------------------------------------------------------------------

const node = (id: string, kind: Kind, x: number, y: number, replicas = 1, hitRate?: number): NodeT => ({ id, kind, x, y, replicas, ...(hitRate ? { hitRate } : {}) })

export const PRESETS: Record<'monolith' | 'scaled' | 'async' | 'blank', { label: string; design: Design }> = {
  monolith: {
    label: 'One server',
    design: {
      nodes: [node('client', 'client', 20, 230), node('api-1', 'api', 290, 230), node('db-1', 'db', 560, 230)],
      edges: [{ from: 'client', to: 'api-1' }, { from: 'api-1', to: 'db-1' }],
    },
  },
  scaled: {
    label: 'Scaled with cache',
    design: {
      nodes: [
        node('client', 'client', 20, 230), node('lb-1', 'lb', 190, 230), node('api-1', 'api', 360, 230, 3),
        node('cache-1', 'cache', 560, 120, 1, 0.85), node('db-1', 'db', 760, 230),
      ],
      edges: [
        { from: 'client', to: 'lb-1' }, { from: 'lb-1', to: 'api-1' }, { from: 'api-1', to: 'cache-1' },
        { from: 'cache-1', to: 'db-1' }, { from: 'api-1', to: 'db-1' },
      ],
    },
  },
  async: {
    label: 'Async writes',
    design: {
      nodes: [
        node('client', 'client', 20, 230), node('lb-1', 'lb', 190, 230), node('api-1', 'api', 360, 230, 4),
        node('cache-1', 'cache', 560, 90, 1, 0.9), node('queue-1', 'queue', 560, 370), node('worker-1', 'worker', 760, 370, 3),
        node('db-1', 'db', 760, 150, 2),
      ],
      edges: [
        { from: 'client', to: 'lb-1' }, { from: 'lb-1', to: 'api-1' }, { from: 'api-1', to: 'cache-1' },
        { from: 'cache-1', to: 'db-1' }, { from: 'api-1', to: 'queue-1' }, { from: 'queue-1', to: 'worker-1' },
        { from: 'worker-1', to: 'db-1' },
      ],
    },
  },
  blank: {
    label: 'Blank',
    design: { nodes: [node('client', 'client', 20, 230)], edges: [] },
  },
}

export type PresetKey = keyof typeof PRESETS

/** Rough validation for designs restored from localStorage. */
export function isDesign(v: unknown): v is Design {
  if (!v || typeof v !== 'object') return false
  const d = v as Design
  return Array.isArray(d.nodes) && Array.isArray(d.edges) &&
    d.nodes.every((n) => typeof n?.id === 'string' && n.kind in SPEC && Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.replicas)) &&
    d.edges.every((e) => typeof e?.from === 'string' && typeof e?.to === 'string') &&
    d.nodes.filter((n) => n.kind === 'client').length === 1
}

export function fmtRate(v: number): string {
  if (!Number.isFinite(v)) return '∞'
  if (v >= 10000) return `${Math.round(v / 1000)}k`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  if (v >= 10) return String(Math.round(v))
  return v.toFixed(v > 0 ? 1 : 0)
}

export function fmtMs(v: number): string {
  if (!Number.isFinite(v)) return '∞'
  if (v >= 1000) return `${(v / 1000).toFixed(1)} s`
  return `${Math.round(v)} ms`
}

export function fmtLag(sec: number): string {
  if (!Number.isFinite(sec)) return 'never drains'
  if (sec < 1) return '< 1 s'
  if (sec < 90) return `${Math.round(sec)} s`
  if (sec < 5400) return `${Math.round(sec / 60)} min`
  return `${(sec / 3600).toFixed(1)} h`
}
