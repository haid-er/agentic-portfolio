/**
 * Field-service dispatch model: a seeded day of jobs and technicians, route evaluation with
 * time windows, a greedy dispatcher and a local-search optimiser. Pure and deterministic.
 *
 * Times are minutes after midnight. Distances are km on a 20 × 20 km service area.
 */
import { seeded } from '@/lib/utils'

export type Skill = 'HVAC' | 'Plumbing' | 'Electrical'
export const SKILLS: Skill[] = ['HVAC', 'Plumbing', 'Electrical']

export interface Tech {
  id: string
  name: string
  skills: Skill[]
  x: number
  y: number
  shiftStart: number
  shiftEnd: number
  rate: number // $ per labour hour (illustrative)
}

export interface Job {
  id: string
  skill: Skill
  x: number
  y: number
  duration: number
  windowStart: number // service must START inside the window
  windowEnd: number
  urgent: boolean
  address: string
  task: string
}

/** 'auto' lets the algorithm decide; a tech id pins the job; 'hold' keeps it off the board. */
export type Pin = 'auto' | 'hold' | string

export interface Stop { job: Job; arrive: number; start: number; end: number; wait: number; late: number; travel: number; km: number }
export interface Route { tech: Tech; stops: Stop[]; returnAt: number; km: number; driveMin: number; waitMin: number; overtime: number; lateMin: number; skillMiss: number }

export interface Plan {
  routes: Route[]
  unassigned: Job[]
  cost: number
  km: number
  onTime: number
  assigned: number
  history: number[] // cost after each improving move (optimiser only)
}

export const DAY_START = 7 * 60
export const DAY_END = 19 * 60
const SPEED_KMH = 32
const ROAD_FACTOR = 1.3

const STREETS = ['Cedar Row', 'Mill Lane', 'Canal Street', 'Orchard Way', 'Quarry Road', 'Station Parade', 'Linden Close', 'Foundry Yard', 'Willow Bank', 'Market Walk', 'Heath Rise', 'Ferry Road']
const TASKS: Record<Skill, string[]> = {
  HVAC: ['No cooling, rooftop unit', 'Furnace service', 'Heat pump fault code', 'Thermostat rewire'],
  Plumbing: ['Leaking water heater', 'Blocked main drain', 'Burst pipe repair', 'Fixture install'],
  Electrical: ['Tripping breaker', 'EV charger install', 'Outlet not working', 'Panel inspection'],
}

export const TECHS_BASE: Array<Omit<Tech, 'x' | 'y'>> = [
  { id: 'A', name: 'Alpha', skills: ['HVAC', 'Electrical'], shiftStart: 8 * 60, shiftEnd: 17 * 60, rate: 95 },
  { id: 'B', name: 'Bravo', skills: ['Plumbing'], shiftStart: 8 * 60, shiftEnd: 16 * 60 + 30, rate: 85 },
  { id: 'C', name: 'Charlie', skills: ['Plumbing', 'HVAC'], shiftStart: 9 * 60, shiftEnd: 18 * 60, rate: 90 },
  { id: 'D', name: 'Delta', skills: ['Electrical'], shiftStart: 8 * 60 + 30, shiftEnd: 17 * 60 + 30, rate: 100 },
]

/* ------------------------------------------------------------------ */
/* scenario                                                            */
/* ------------------------------------------------------------------ */

export function makeDay(seed: number, jobCount: number): { techs: Tech[]; jobs: Job[] } {
  const r = seeded(seed * 7919 + 13)
  const bases = [[4, 5], [15, 4], [16, 15], [5, 15]]
  const techs = TECHS_BASE.map((t, i) => {
    const b = bases[i] ?? [10, 10]
    return { ...t, x: (b[0] ?? 10) + (r() - 0.5) * 3, y: (b[1] ?? 10) + (r() - 0.5) * 3 }
  })
  const jobs: Job[] = []
  for (let i = 0; i < jobCount; i++) jobs.push(makeJob(r, i + 1))
  return { techs, jobs }
}

export function makeJob(r: () => number, n: number): Job {
  const skill = SKILLS[Math.floor(r() * SKILLS.length)] ?? 'HVAC'
  const windows: Array<[number, number]> = [[8 * 60, 10 * 60], [8 * 60, 12 * 60], [10 * 60, 12 * 60], [12 * 60, 14 * 60], [12 * 60, 16 * 60], [14 * 60, 16 * 60], [9 * 60, 15 * 60]]
  const w = windows[Math.floor(r() * windows.length)] ?? [8 * 60, 12 * 60]
  const tasks = TASKS[skill]
  return {
    id: `J${String(n).padStart(2, '0')}`,
    skill,
    x: 1 + r() * 18,
    y: 1 + r() * 18,
    duration: [45, 60, 60, 90, 120][Math.floor(r() * 5)] ?? 60,
    windowStart: w[0],
    windowEnd: w[1],
    urgent: r() < 0.18,
    address: `${1 + Math.floor(r() * 180)} ${STREETS[Math.floor(r() * STREETS.length)] ?? 'Mill Lane'}`,
    task: tasks[Math.floor(r() * tasks.length)] ?? tasks[0] ?? '',
  }
}

/* ------------------------------------------------------------------ */
/* evaluation                                                          */
/* ------------------------------------------------------------------ */

export const km = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) * ROAD_FACTOR
export const driveMin = (d: number) => (d / SPEED_KMH) * 60

export function evalRoute(tech: Tech, jobs: Job[]): Route {
  let t = tech.shiftStart
  let pos: { x: number; y: number } = tech
  const stops: Stop[] = []
  let totalKm = 0
  let drive = 0
  let wait = 0
  let lateMin = 0
  let skillMiss = 0
  for (const job of jobs) {
    const d = km(pos, job)
    const travel = driveMin(d)
    const arrive = t + travel
    const start = Math.max(arrive, job.windowStart)
    const late = Math.max(0, start - job.windowEnd)
    const end = start + job.duration
    stops.push({ job, arrive, start, end, wait: start - arrive, late, travel, km: d })
    totalKm += d; drive += travel; wait += start - arrive; lateMin += late
    if (!tech.skills.includes(job.skill)) skillMiss += 1
    t = end
    pos = job
  }
  const back = km(pos, tech)
  totalKm += back; drive += driveMin(back)
  const returnAt = t + driveMin(back)
  return { tech, stops, returnAt, km: totalKm, driveMin: drive, waitMin: wait, overtime: Math.max(0, returnAt - tech.shiftEnd), lateMin, skillMiss }
}

const feasible = (r: Route) => r.lateMin === 0 && r.overtime === 0 && r.skillMiss === 0

function routeCost(r: Route): number {
  return r.driveMin + 0.25 * r.waitMin + 40 * r.lateMin + 20 * r.overtime + 5000 * r.skillMiss
}

const missPenalty = (j: Job) => (j.urgent ? 2400 : 1200)

function planOf(routes: Route[], unassigned: Job[], history: number[] = []): Plan {
  const cost = routes.reduce((a, r) => a + routeCost(r), 0) + unassigned.reduce((a, j) => a + missPenalty(j), 0)
  const all = routes.flatMap((r) => r.stops)
  return {
    routes, unassigned, cost, history,
    km: routes.reduce((a, r) => a + r.km, 0),
    assigned: all.length,
    onTime: all.filter((s) => s.late === 0).length,
  }
}

/* ------------------------------------------------------------------ */
/* greedy: what a busy dispatcher does, one job at a time              */
/* ------------------------------------------------------------------ */

function split(jobs: Job[], pins: Record<string, Pin>) {
  const active = jobs.filter((j) => pins[j.id] !== 'hold')
  return { active, held: jobs.filter((j) => pins[j.id] === 'hold') }
}

export function greedy(techs: Tech[], jobs: Job[], pins: Record<string, Pin>): Plan {
  const { active } = split(jobs, pins)
  const seqs = new Map<string, Job[]>(techs.map((t) => [t.id, []]))
  const unassigned: Job[] = []
  const order = [...active].sort((a, b) => a.windowStart - b.windowStart || Number(b.urgent) - Number(a.urgent) || a.id.localeCompare(b.id))
  for (const job of order) {
    const pin = pins[job.id]
    const pinned = pin && pin !== 'auto' ? techs.find((t) => t.id === pin) : undefined
    if (pinned) { seqs.get(pinned.id)?.push(job); continue }
    let best: { tech: Tech; start: number } | null = null
    for (const tech of techs) {
      if (!tech.skills.includes(job.skill)) continue
      const seq = [...(seqs.get(tech.id) ?? []), job]
      const r = evalRoute(tech, seq)
      if (!feasible(r)) continue
      const start = r.stops[r.stops.length - 1]?.start ?? Infinity
      if (!best || start < best.start) best = { tech, start }
    }
    if (best) seqs.get(best.tech.id)?.push(job)
    else unassigned.push(job)
  }
  const routes = techs.map((t) => evalRoute(t, seqs.get(t.id) ?? []))
  return planOf(routes, unassigned)
}

/* ------------------------------------------------------------------ */
/* optimiser: best insertion + relocate / swap / 2-opt local search    */
/* ------------------------------------------------------------------ */

export function optimise(techs: Tech[], jobs: Job[], pins: Record<string, Pin>, maxMoves = 400): Plan {
  const start = greedy(techs, jobs, pins)
  const seqs: Job[][] = start.routes.map((r) => r.stops.map((s) => s.job))
  let unassigned = [...start.unassigned]
  const history = [start.cost]
  const tech = (i: number) => techs[i] as Tech
  const rc = seqs.map((seq, i) => routeCost(evalRoute(tech(i), seq)))
  const hard = (seq: Job[], i: number) => { const r = evalRoute(tech(i), seq); return r.lateMin + r.overtime }

  const allowed = (job: Job, i: number) => {
    const pin = pins[job.id]
    if (pin && pin !== 'auto' && pin !== 'hold') return pin === tech(i).id
    return tech(i).skills.includes(job.skill)
  }
  /** Accept a change to some routes if it never adds lateness/overtime and lowers the total cost. */
  const accept = (changes: Array<[number, Job[]]>, extra = 0): boolean => {
    let delta = extra
    const costs: number[] = []
    for (const [i, seq] of changes) {
      if (hard(seq, i) > hard(seqs[i] ?? [], i)) return false
      const c = routeCost(evalRoute(tech(i), seq))
      costs.push(c)
      delta += c - (rc[i] ?? 0)
    }
    if (delta >= -1e-6) return false
    changes.forEach(([i, seq], k) => { seqs[i] = seq; rc[i] = costs[k] ?? 0 })
    history.push((history[history.length - 1] ?? 0) + delta)
    return true
  }
  const insertAt = (seq: Job[], p: number, job: Job) => [...seq.slice(0, p), job, ...seq.slice(p)]

  // 1. place an unassigned job at its first improving position
  const tryInsert = () => {
    for (const job of unassigned) {
      for (let i = 0; i < seqs.length; i++) {
        if (!allowed(job, i)) continue
        const seq = seqs[i] ?? []
        for (let p = 0; p <= seq.length; p++) {
          if (accept([[i, insertAt(seq, p, job)]], -missPenalty(job))) { unassigned = unassigned.filter((u) => u !== job); return true }
        }
      }
    }
    return false
  }
  // 2. move one job to another position or route
  const tryRelocate = () => {
    for (let from = 0; from < seqs.length; from++) {
      const seq = seqs[from] ?? []
      for (let k = 0; k < seq.length; k++) {
        const job = seq[k] as Job
        const without = [...seq.slice(0, k), ...seq.slice(k + 1)]
        for (let to = 0; to < seqs.length; to++) {
          if (!allowed(job, to)) continue
          const target = to === from ? without : (seqs[to] ?? [])
          for (let p = 0; p <= target.length; p++) {
            const next = insertAt(target, p, job)
            if (accept(to === from ? [[from, next]] : [[from, without], [to, next]])) return true
          }
        }
      }
    }
    return false
  }
  // 3. swap two jobs between routes
  const trySwap = () => {
    for (let a = 0; a < seqs.length; a++) {
      for (let b = a + 1; b < seqs.length; b++) {
        const sa = seqs[a] ?? []
        const sb = seqs[b] ?? []
        for (let i = 0; i < sa.length; i++) {
          for (let j = 0; j < sb.length; j++) {
            const ja = sa[i] as Job
            const jb = sb[j] as Job
            if (!allowed(ja, b) || !allowed(jb, a)) continue
            if (accept([[a, sa.map((x, k) => (k === i ? jb : x))], [b, sb.map((x, k) => (k === j ? ja : x))]])) return true
          }
        }
      }
    }
    return false
  }
  // 4. 2-opt: reverse a segment inside one route
  const tryTwoOpt = () => {
    for (let t = 0; t < seqs.length; t++) {
      const seq = seqs[t] ?? []
      for (let i = 0; i < seq.length - 1; i++) {
        for (let j = i + 1; j < seq.length; j++) {
          if (accept([[t, [...seq.slice(0, i), ...seq.slice(i, j + 1).reverse(), ...seq.slice(j + 1)]]])) return true
        }
      }
    }
    return false
  }

  for (let moves = 0; moves < maxMoves; moves++) {
    if (!(tryInsert() || tryRelocate() || trySwap() || tryTwoOpt())) break
  }

  const routes = techs.map((t, i) => evalRoute(t, seqs[i] ?? []))
  return planOf(routes, unassigned, history)
}

/** Why a job could not be placed, in plain words. */
export function whyUnassigned(job: Job, techs: Tech[]): string {
  const able = techs.filter((t) => t.skills.includes(job.skill))
  if (able.length === 0) return `No ${job.skill} technician on shift.`
  return `Every ${job.skill} technician is busy during ${clock(job.windowStart)}–${clock(job.windowEnd)}.`
}

/* ------------------------------------------------------------------ */
/* invoice                                                             */
/* ------------------------------------------------------------------ */

export const CALL_OUT = 65
export const TAX_RATE = 0.08
const PARTS: Record<Skill, Array<[string, number]>> = {
  HVAC: [['Run capacitor 45/5 µF', 38], ['Air filter set', 22], ['Refrigerant top-up (1 lb)', 64]],
  Plumbing: [['PEX fittings kit', 24], ['Pressure relief valve', 41], ['Drain auger rental', 35]],
  Electrical: [['20 A breaker', 18], ['GFCI outlet', 26], ['Surge protector module', 72]],
}

export interface InvoiceLine { label: string; qty: number; unit: number; total: number }

export function invoiceFor(job: Job, tech: Tech): { lines: InvoiceLine[]; subtotal: number; tax: number; total: number } {
  const hours = Math.ceil(job.duration / 15) / 4
  const parts = PARTS[job.skill]
  const pick = parts[Number(job.id.slice(1)) % parts.length] ?? parts[0] ?? ['Parts', 0]
  const lines: InvoiceLine[] = [
    { label: 'Call-out fee', qty: 1, unit: CALL_OUT, total: CALL_OUT },
    { label: `Labour, ${tech.name} (${job.skill})`, qty: hours, unit: tech.rate, total: hours * tech.rate },
    { label: pick[0], qty: 1, unit: pick[1], total: pick[1] },
  ]
  if (job.urgent) lines.push({ label: 'Priority dispatch', qty: 1, unit: 45, total: 45 })
  const subtotal = lines.reduce((a, l) => a + l.total, 0)
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100
  return { lines, subtotal, tax, total: subtotal + tax }
}

/* ------------------------------------------------------------------ */
/* formatting                                                          */
/* ------------------------------------------------------------------ */

export function clock(min: number): string {
  const m = Math.round(min)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export const money = (n: number) => usd.format(n)
