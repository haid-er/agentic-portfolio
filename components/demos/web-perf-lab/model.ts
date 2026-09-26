/**
 * A small, deterministic page-load simulator.
 *
 * The page is a field-service dashboard (jobs, technicians, map, invoices). Its resources are
 * illustrative, not a real bundle. Four optimisations change the resource list; a fluid network
 * model then plays it: HTTP/1.1 with 6 connections, bandwidth shared by active downloads,
 * round trips + server time before the first byte, and a single main thread that must parse and
 * run JavaScript before the app can fire its API calls.
 */

export type Kind = 'doc' | 'css' | 'js' | 'font' | 'api' | 'img'

export interface Opts {
  split: boolean // code splitting (route chunks + vendor chunk)
  lazy: boolean // lazy-load below-the-fold images and widgets
  compress: boolean // brotli/gzip for text assets
  dedupe: boolean // collapse duplicate calls, batch N+1 requests
}

export interface Network { id: NetId; label: string; kbps: number; rttMs: number }
export type NetId = '3g' | '4g' | 'cable'

export const NETWORKS: Record<NetId, Network> = {
  '3g': { id: '3g', label: 'Slow 4G', kbps: 300, rttMs: 150 }, // KB per second
  '4g': { id: '4g', label: 'Fast 4G', kbps: 1100, rttMs: 60 },
  cable: { id: 'cable', label: 'Cable', kbps: 5000, rttMs: 20 },
}

interface Spec {
  id: string
  label: string
  kind: Kind
  kb: number // uncompressed size
  serverMs?: number
  after: string[] // resources (or 'exec:<id>') that must finish first
  critical: boolean // needed before the dashboard is usable
  lazyable?: boolean // can move below the fold when lazy loading is on
  jsKb?: number // JS that must be parsed/executed on the main thread after download
}

export interface Req {
  id: string
  label: string
  kind: Kind
  transferKb: number
  critical: boolean
  deferred: boolean
  note?: string
  queuedAt: number
  startAt: number
  firstByte: number
  end: number
}

export interface Task { id: string; label: string; start: number; end: number }

export interface Result {
  reqs: Req[]
  tasks: Task[]
  fcp: number
  ready: number // "response time": dashboard usable
  loaded: number // everything, including deferred work
  transferKb: number
  requestsBeforeReady: number
  mainThreadMs: number
  removed: string[] // requests removed by dedupe/splitting, for the explainer
}

const TEXT: Kind[] = ['doc', 'css', 'js', 'api']
const RATIO: Record<Kind, number> = { doc: 0.22, css: 0.2, js: 0.26, api: 0.16, font: 1, img: 1 }
const CONNECTIONS = 6
const JS_MS_PER_KB = 0.28 // parse + compile + run, mid-range phone
const RENDER_MS = 120
/** Each API call already in flight slows the server a little (shared DB pool, one Node process). */
const SERVER_LOAD = 0.06

/* ------------------------------------------------------------------ */
/* the page, before and after                                          */
/* ------------------------------------------------------------------ */

export function buildPage(o: Opts): { specs: Spec[]; removed: string[] } {
  const specs: Spec[] = []
  const removed: string[] = []
  const add = (s: Spec) => specs.push(s)

  add({ id: 'doc', label: '/dashboard', kind: 'doc', kb: 38, serverMs: 180, after: [], critical: true })

  // styles + fonts
  if (o.split) add({ id: 'css', label: 'dashboard.css', kind: 'css', kb: 96, after: ['doc'], critical: true })
  else add({ id: 'css', label: 'app.css (all routes)', kind: 'css', kb: 420, after: ['doc'], critical: true })
  add({ id: 'font-1', label: 'body.woff2', kind: 'font', kb: 48, after: ['css'], critical: true })
  add({ id: 'font-2', label: 'mono.woff2', kind: 'font', kb: 36, after: ['css'], critical: false })

  // javascript
  const appExec = 'exec:main'
  if (o.split) {
    add({ id: 'runtime', label: 'runtime.js', kind: 'js', kb: 12, after: ['doc'], critical: true, jsKb: 12 })
    add({ id: 'vendor', label: 'vendor.react.js', kind: 'js', kb: 360, after: ['doc'], critical: true, jsKb: 360 })
    add({ id: 'main', label: 'route.dashboard.js', kind: 'js', kb: 280, after: ['doc'], critical: true, jsKb: 280 })
    removed.push('Scheduling, reports, invoice editor and PDF chunks: loaded when their route opens')
  } else {
    add({ id: 'main', label: 'main.js (every route + vendors)', kind: 'js', kb: 4300, after: ['doc'], critical: true, jsKb: 4300 })
  }

  // api calls fired once the app has booted
  const api = (id: string, label: string, kb: number, serverMs: number, extra: Partial<Spec> = {}) =>
    add({ id, label, kind: 'api', kb, serverMs, after: [appExec], critical: true, ...extra })

  const meCopies = o.dedupe ? 1 : 4
  for (let i = 0; i < meCopies; i++) api(`me-${i}`, i ? '/api/me (duplicate)' : '/api/me', 6, 320)
  const settingsCopies = o.dedupe ? 1 : 3
  for (let i = 0; i < settingsCopies; i++) api(`settings-${i}`, i ? '/api/settings (duplicate)' : '/api/settings', 14, 380)
  if (o.dedupe) removed.push('3 duplicate /api/me and 2 duplicate /api/settings calls: one shared in-flight promise each')

  api('jobs', '/api/jobs?date=today', 240, 650)
  api('techs', '/api/technicians', 90, 480)
  if (o.dedupe) {
    api('avail', '/api/availability?ids=… (batched)', 18, 420, { after: ['techs'] })
    removed.push('12 per-technician availability calls: batched into one request')
  } else {
    for (let i = 1; i <= 12; i++) api(`avail-${i}`, `/api/technicians/${i}/availability`, 4, 700, { after: ['techs'] })
  }
  api('invoices', '/api/invoices?status=open', 380, 2200, { lazyable: true })
  api('customers', '/api/customers (full list)', 720, 2600, { lazyable: true })

  // images: map tiles and technician avatars
  for (let i = 1; i <= 12; i++) {
    add({ id: `tile-${i}`, label: `map tile ${i}`, kind: 'img', kb: 30, after: ['jobs'], critical: true, lazyable: i > 4 })
  }
  for (let i = 1; i <= 12; i++) {
    add({ id: `avatar-${i}`, label: `avatar ${i}`, kind: 'img', kb: 28, after: ['techs'], critical: true, lazyable: i > 4 })
  }

  return { specs, removed }
}

/* ------------------------------------------------------------------ */
/* fluid network + main thread simulation                              */
/* ------------------------------------------------------------------ */

interface Live {
  spec: Spec
  req: Req
  state: 'blocked' | 'queued' | 'waiting' | 'downloading' | 'done'
  remainingKb: number
  ttfbLeft: number
}

export function simulate(o: Opts, net: Network): Result {
  const { specs, removed } = buildPage(o)
  const dt = 5
  const live: Live[] = specs.map((spec) => {
    const deferred = o.lazy && Boolean(spec.lazyable)
    const transferKb = TEXT.includes(spec.kind) && o.compress ? spec.kb * RATIO[spec.kind] : spec.kb
    return {
      spec: { ...spec, critical: spec.critical && !deferred },
      req: {
        id: spec.id, label: spec.label, kind: spec.kind, transferKb: Math.round(transferKb * 10) / 10,
        critical: spec.critical && !deferred, deferred, queuedAt: -1, startAt: -1, firstByte: -1, end: -1,
      },
      state: 'blocked', remainingKb: transferKb, ttfbLeft: net.rttMs + (spec.serverMs ?? 0),
    }
  })

  const done = new Set<string>()
  const tasks: Task[] = []
  const cpuQueue: Array<{ id: string; label: string; ms: number }> = []
  let cpuBusyUntil = 0
  let current: { id: string; label: string; start: number; end: number } | null = null
  let ready = -1
  let fcp = -1
  let t = 0

  const depsMet = (l: Live) =>
    l.spec.after.every((d) => done.has(d)) && (!l.req.deferred || ready >= 0)

  while (t < 120_000) {
    // main thread
    if (current && t >= current.end) { tasks.push(current); done.add(current.id); current = null }
    if (!current && cpuQueue.length) {
      const next = cpuQueue.shift()
      if (next) { current = { ...next, start: Math.max(t, cpuBusyUntil), end: Math.max(t, cpuBusyUntil) + next.ms }; cpuBusyUntil = current.end }
    }
    // the app boots only after every critical script ran (webpack runtime needs all initial chunks)
    const jsIds = live.filter((l) => l.spec.kind === 'js').map((l) => `exec:${l.spec.id}`)
    if (!done.has('exec:main') && jsIds.every((id) => id === 'exec:main' || done.has(id)) && done.has('exec:main-raw')) done.add('exec:main')

    // unblock
    for (const l of live) {
      if (l.state === 'blocked' && depsMet(l)) { l.state = 'queued'; l.req.queuedAt = t }
    }
    // connections
    let open = live.filter((l) => l.state === 'waiting' || l.state === 'downloading').length
    for (const l of live) {
      if (open >= CONNECTIONS) break
      if (l.state === 'queued') {
        const busyApi = live.filter((x) => x.spec.kind === 'api' && (x.state === 'waiting' || x.state === 'downloading')).length
        if (l.spec.kind === 'api') l.ttfbLeft = net.rttMs + (l.spec.serverMs ?? 0) * (1 + SERVER_LOAD * busyApi)
        l.state = 'waiting'; l.req.startAt = t; open++
      }
    }
    // progress
    const downloading = live.filter((l) => l.state === 'downloading')
    const share = downloading.length ? (net.kbps * dt) / 1000 / downloading.length : 0
    for (const l of live) {
      if (l.state === 'waiting') {
        l.ttfbLeft -= dt
        if (l.ttfbLeft <= 0) { l.state = 'downloading'; l.req.firstByte = t }
      } else if (l.state === 'downloading') {
        l.remainingKb -= share
        if (l.remainingKb <= 0) {
          l.state = 'done'
          l.req.end = t + dt
          done.add(l.spec.id)
          if (l.spec.jsKb) {
            const execId = l.spec.id === 'main' ? 'exec:main-raw' : `exec:${l.spec.id}`
            cpuQueue.push({ id: execId, label: `run ${l.spec.label}`, ms: Math.round(l.spec.jsKb * JS_MS_PER_KB) })
          }
        }
      }
    }
    t += dt

    if (fcp < 0 && done.has('doc') && done.has('css')) fcp = t + 40
    if (ready < 0 && done.has('exec:main') && live.every((l) => !l.req.critical || l.state === 'done')) {
      ready = t + RENDER_MS
      tasks.push({ id: 'render', label: 'render dashboard', start: t, end: t + RENDER_MS })
    }
    if (ready >= 0 && !current && cpuQueue.length === 0 && live.every((l) => l.state === 'done')) break
  }

  const reqs = live.map((l) => l.req)
  const loaded = Math.max(ready, ...reqs.map((r) => r.end))
  return {
    reqs, tasks, fcp, ready, loaded,
    transferKb: Math.round(reqs.reduce((a, r) => a + r.transferKb, 0)),
    requestsBeforeReady: reqs.filter((r) => r.critical).length,
    mainThreadMs: tasks.filter((x) => x.id.startsWith('exec')).reduce((a, x) => a + x.end - x.start, 0),
    removed,
  }
}

export const ALL_OFF: Opts = { split: false, lazy: false, compress: false, dedupe: false }
export const ALL_ON: Opts = { split: true, lazy: true, compress: true, dedupe: true }

export const seconds = (ms: number) => (ms >= 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 1000).toFixed(2)}s`)
export const kb = (k: number) => (k >= 1024 ? `${(k / 1024).toFixed(2)} MB` : `${Math.round(k)} KB`)
