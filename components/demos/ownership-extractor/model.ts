/**
 * Ownership model + GHG Protocol consolidation (Corporate Standard, chapter 3).
 *
 *  - Equity share: effective equity along every ownership path, multiplied down the chain and summed.
 *  - Financial control: 100% for entities the group controls financially, the equity share for
 *    joint arrangements (joint financial control), 0% for associates and minority stakes.
 *  - Operational control: 100% where the group (or an entity it operates) has operational control, else 0%.
 *
 * Pure functions only, so the UI can recompute on every edit.
 */

export type Control = 'full' | 'operational' | 'financial' | 'joint' | 'none' | 'unstated'
export type Approach = 'equity' | 'financial' | 'operational'

export interface Entity {
  id: string
  name: string
  /** Scope 1 + 2 emissions in tCO2e, if the text gave a figure. */
  emissions: number | null
}

export interface Link {
  id: string
  owner: string
  owned: string
  /** 0..100 */
  equityPct: number
  control: Control
}

export interface Group {
  parentId: string
  entities: Entity[]
  links: Link[]
}

export interface EntityResult {
  id: string
  equity: number
  financial: number
  operational: number
  /** Human-readable reasons, e.g. "majority stake read as control (not stated)". */
  notes: string[]
}

export interface Consolidation {
  byId: Record<string, EntityResult>
  totals: Record<Approach, number>
  /** Sum of emissions of every entity in the group's orbit (no share applied). */
  gross: number
  missingEmissions: string[]
  cycles: boolean
}

export const CONTROL_LABEL: Record<Control, string> = {
  full: 'Operational + financial control',
  operational: 'Operational control',
  financial: 'Financial control',
  joint: 'Joint control',
  none: 'No control',
  unstated: 'Not stated',
}

export const CONTROL_SHORT: Record<Control, string> = {
  full: 'OC+FC',
  operational: 'OC',
  financial: 'FC',
  joint: 'JC',
  none: 'no ctrl',
  unstated: '?',
}

export const APPROACH_LABEL: Record<Approach, string> = {
  equity: 'Equity share',
  financial: 'Financial control',
  operational: 'Operational control',
}

/** Does this link hand financial control to the owner? `unstated` falls back to majority ownership. */
export function grantsFinancial(l: Link): boolean {
  if (l.control === 'full' || l.control === 'financial') return true
  if (l.control === 'unstated') return l.equityPct > 50
  return false
}

export function grantsOperational(l: Link): boolean {
  if (l.control === 'full' || l.control === 'operational') return true
  if (l.control === 'unstated') return l.equityPct > 50
  return false
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export function consolidate(g: Group): Consolidation {
  const incoming = new Map<string, Link[]>()
  for (const l of g.links) {
    if (l.owner === l.owned) continue
    const list = incoming.get(l.owned) ?? []
    list.push(l)
    incoming.set(l.owned, list)
  }

  let cycles = false
  const memo = new Map<string, EntityResult>()
  const visiting = new Set<string>()

  const solve = (id: string): EntityResult => {
    const hit = memo.get(id)
    if (hit) return hit
    if (id === g.parentId) {
      const r = { id, equity: 1, financial: 1, operational: 1, notes: ['Reporting entity'] }
      memo.set(id, r)
      return r
    }
    if (visiting.has(id)) {
      cycles = true
      return { id, equity: 0, financial: 0, operational: 0, notes: [] }
    }
    visiting.add(id)
    const notes: string[] = []
    let equity = 0
    let finControl = 0
    let finJoint = 0
    let op = 0
    for (const l of incoming.get(id) ?? []) {
      const o = solve(l.owner)
      const pct = clamp01(l.equityPct / 100)
      equity += o.equity * pct
      if (o.financial > 0) {
        if (grantsFinancial(l)) {
          finControl = Math.max(finControl, o.financial)
          if (l.control === 'unstated') notes.push('Majority stake read as control (not stated in the text)')
        } else if (l.control === 'joint') {
          finJoint += o.financial * pct
          notes.push('Joint arrangement: equity share under financial control')
        }
      }
      if (o.operational >= 1 && grantsOperational(l)) {
        op = 1
        if (l.control === 'unstated') notes.push('Majority stake read as control (not stated in the text)')
        if (l.control === 'operational' && pct <= 0.5) notes.push('Operated without majority ownership')
      }
    }
    visiting.delete(id)
    // GHG Protocol judges control on the group's combined holding: stakes held by the parent and
    // by entities it already controls add up, so 30% + 30% via a subsidiary is still a majority.
    const links = incoming.get(id) ?? []
    const blocked = links.some((l) => l.control === 'none' || l.control === 'joint')
    if (!blocked) {
      const heldVia = (key: 'financial' | 'operational') =>
        links.reduce((sum, l) => (l.control === 'unstated' && memo.get(l.owner)?.[key] === 1 ? sum + clamp01(l.equityPct / 100) : sum), 0)
      if (finControl < 1 && heldVia('financial') > 0.5) {
        finControl = 1
        notes.push('Majority stake read as control (not stated in the text)')
      }
      if (op < 1 && heldVia('operational') > 0.5) {
        op = 1
        notes.push('Majority stake read as control (not stated in the text)')
      }
    }
    const r: EntityResult = {
      id,
      equity: clamp01(equity),
      financial: clamp01(finControl > 0 ? finControl : finJoint),
      operational: op,
      notes: Array.from(new Set(notes)),
    }
    memo.set(id, r)
    return r
  }

  const byId: Record<string, EntityResult> = {}
  for (const e of g.entities) byId[e.id] = solve(e.id)

  const totals: Record<Approach, number> = { equity: 0, financial: 0, operational: 0 }
  let gross = 0
  const missingEmissions: string[] = []
  for (const e of g.entities) {
    const r = byId[e.id]
    const inOrbit = r.equity > 0 || r.financial > 0 || r.operational > 0
    if (!inOrbit) continue
    if (e.emissions == null) { missingEmissions.push(e.name); continue }
    gross += e.emissions
    totals.equity += e.emissions * r.equity
    totals.financial += e.emissions * r.financial
    totals.operational += e.emissions * r.operational
  }
  return { byId, totals, gross, missingEmissions, cycles }
}

export function shareFor(r: EntityResult | undefined, a: Approach): number {
  if (!r) return 0
  return a === 'equity' ? r.equity : a === 'financial' ? r.financial : r.operational
}

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

export const slugId = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'entity'

export function uniqueId(base: string, taken: Set<string>): string {
  let id = base
  let n = 2
  while (taken.has(id)) id = `${base}-${n++}`
  taken.add(id)
  return id
}

const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })
export const fmtT = (n: number) => nf0.format(Math.round(n))
export const fmtPct = (share: number) => `${nf1.format(share * 100)}%`

/** Depth layers for drawing: parent on top, then by longest ownership path. Entities outside the chain sit where their links put them. */
export function layers(g: Group): string[][] {
  const ids = g.entities.map((e) => e.id)
  const depth = new Map<string, number>()
  const owners = new Map<string, string[]>()
  for (const l of g.links) {
    if (l.owner === l.owned) continue
    owners.set(l.owned, [...(owners.get(l.owned) ?? []), l.owner])
  }
  const visiting = new Set<string>()
  const d = (id: string): number => {
    const known = depth.get(id)
    if (known != null) return known
    if (visiting.has(id)) return 0
    visiting.add(id)
    const os = owners.get(id) ?? []
    const v = os.length ? Math.max(...os.map(d)) + 1 : 0
    visiting.delete(id)
    depth.set(id, v)
    return v
  }
  ids.forEach(d)
  const rows: string[][] = []
  for (const id of ids) {
    const k = depth.get(id) ?? 0
    ;(rows[k] ??= []).push(id)
  }
  // Put the reporting entity first in its row so the eye starts there.
  return rows.filter(Boolean).map((r) => [...r].sort((a, b) => (a === g.parentId ? -1 : b === g.parentId ? 1 : 0)))
}
