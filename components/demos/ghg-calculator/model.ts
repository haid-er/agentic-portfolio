/**
 * GHG calculator data model (GHG Protocol Corporate Standard).
 *
 *   reported kgCO2e = quantity x emission factor x inclusion(entity, approach)
 *
 * inclusion() is the organisational boundary: operational control and financial
 * control take 100% or 0% of an entity (joint financial control takes the equity share);
 * the equity-share approach always takes the equity share.
 * Pure functions only, so the UI, chart and CSV all read the same numbers.
 */
import { z } from 'zod'

export type Scope = 1 | 2 | 3
export type Approach = 'operational' | 'financial' | 'equity'
export type S2Method = 'location' | 'market'
export type FinancialControl = 'full' | 'joint' | 'none'

export const APPROACHES: readonly { value: Approach; label: string; short: string }[] = [
  { value: 'operational', label: 'Operational control', short: 'Operational' },
  { value: 'financial', label: 'Financial control', short: 'Financial' },
  { value: 'equity', label: 'Equity share', short: 'Equity' },
]

export interface Category { id: CategoryId; scope: Scope; label: string }
export type CategoryId =
  | 's1-stationary' | 's1-mobile' | 's1-fugitive'
  | 's2-electricity'
  | 's3-c3' | 's3-c5' | 's3-c6' | 's3-c7'

/** Order within a scope sets the chart ink (data-1..4) and fill pattern. */
export const CATEGORIES: readonly Category[] = [
  { id: 's1-stationary', scope: 1, label: 'Stationary combustion' },
  { id: 's1-mobile', scope: 1, label: 'Mobile combustion' },
  { id: 's1-fugitive', scope: 1, label: 'Fugitive (refrigerants)' },
  { id: 's2-electricity', scope: 2, label: 'Purchased electricity' },
  { id: 's3-c3', scope: 3, label: 'Cat 3 · Fuel & energy (T&D losses)' },
  { id: 's3-c5', scope: 3, label: 'Cat 5 · Waste' },
  { id: 's3-c6', scope: 3, label: 'Cat 6 · Business travel' },
  { id: 's3-c7', scope: 3, label: 'Cat 7 · Employee commuting' },
]
export const categoryOf = (id: CategoryId) => CATEGORIES.find((c) => c.id === id) as Category
export const categoriesIn = (s: Scope) => CATEGORIES.filter((c) => c.scope === s)

export interface Factor {
  id: string
  label: string
  category: CategoryId
  unit: string
  /** Default kgCO2e per unit (rounded, illustrative; editable in the UI). */
  kg: number
  source: string
}

const DESNZ = 'UK DESNZ conversion factors (rounded)'
const AR4 = 'GWP100, IPCC AR4'

/** Illustrative factor library. Values are rounded; check the current year's published set before reporting. */
export const FACTORS: readonly Factor[] = [
  { id: 'natural-gas', label: 'Natural gas (boilers)', category: 's1-stationary', unit: 'kWh', kg: 0.183, source: DESNZ },
  { id: 'diesel', label: 'Diesel (fleet vans)', category: 's1-mobile', unit: 'litre', kg: 2.51, source: DESNZ },
  { id: 'petrol', label: 'Petrol (fleet cars)', category: 's1-mobile', unit: 'litre', kg: 2.08, source: DESNZ },
  { id: 'r410a', label: 'R-410A top-up (leak)', category: 's1-fugitive', unit: 'kg', kg: 2088, source: AR4 },
  { id: 'r32', label: 'R-32 top-up (leak)', category: 's1-fugitive', unit: 'kg', kg: 675, source: AR4 },
  { id: 'grid-uk', label: 'Grid electricity (UK)', category: 's2-electricity', unit: 'kWh', kg: 0.207, source: DESNZ },
  { id: 'waste-landfill', label: 'Mixed waste to landfill', category: 's3-c5', unit: 'tonne', kg: 467, source: DESNZ },
  { id: 'waste-recycled', label: 'Mixed recycling', category: 's3-c5', unit: 'tonne', kg: 21, source: DESNZ },
  { id: 'car-avg', label: 'Car, average (business)', category: 's3-c6', unit: 'km', kg: 0.166, source: DESNZ },
  { id: 'rail', label: 'National rail', category: 's3-c6', unit: 'passenger-km', kg: 0.035, source: DESNZ },
  { id: 'flight-short', label: 'Short-haul flight, economy (with RF)', category: 's3-c6', unit: 'passenger-km', kg: 0.128, source: DESNZ },
  { id: 'flight-long', label: 'Long-haul flight, economy (with RF)', category: 's3-c6', unit: 'passenger-km', kg: 0.148, source: DESNZ },
  { id: 'hotel', label: 'Hotel stay (UK)', category: 's3-c6', unit: 'room-night', kg: 10.4, source: DESNZ },
  { id: 'commute-car', label: 'Commute by car', category: 's3-c7', unit: 'km', kg: 0.166, source: DESNZ },
  { id: 'commute-bus', label: 'Commute by local bus', category: 's3-c7', unit: 'passenger-km', kg: 0.102, source: DESNZ },
]
/** Transmission & distribution losses, derived from every electricity line (Scope 3 Cat 3). */
export const TD_FACTOR: Factor = {
  id: 'grid-td', label: 'T&D losses (derived from electricity)', category: 's3-c3', unit: 'kWh', kg: 0.018, source: DESNZ,
}
export const ALL_FACTORS: readonly Factor[] = [...FACTORS, TD_FACTOR]
export const factorById = (id: string) => ALL_FACTORS.find((f) => f.id === id)

/* ---------------- persisted state (validated on load) ---------------- */

const EntitySchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().max(60),
  equity: z.number().min(0).max(100),
  operational: z.boolean(),
  financial: z.enum(['full', 'joint', 'none']),
})
const ActivitySchema = z.object({
  id: z.string().min(1).max(40),
  entityId: z.string().max(40),
  factorId: z.string().max(40),
  quantity: z.number().min(0).max(1e12),
  /** Share of this electricity covered by contractual instruments (market-based only). */
  renewablePct: z.number().min(0).max(100).optional(),
})
export const StateSchema = z.object({
  v: z.literal(1),
  approach: z.enum(['operational', 'financial', 'equity']),
  s2: z.enum(['location', 'market']),
  includeTD: z.boolean(),
  entities: z.array(EntitySchema).max(12),
  activities: z.array(ActivitySchema).max(80),
  /** User overrides: factor id -> kgCO2e per unit. */
  overrides: z.record(z.string(), z.number().min(0).max(1e6)),
})
export type Entity = z.infer<typeof EntitySchema>
export type Activity = z.infer<typeof ActivitySchema>
export type CalcState = z.infer<typeof StateSchema>

export const MAX_ENTITIES = 12
export const MAX_ACTIVITIES = 80

/** A fictional group chosen so the three approaches give three different totals. */
export const SAMPLE: CalcState = {
  v: 1,
  approach: 'operational',
  s2: 'location',
  includeTD: true,
  entities: [
    { id: 'hq', name: 'Head office (owned)', equity: 100, operational: true, financial: 'full' },
    { id: 'wh', name: 'Logistics subsidiary', equity: 80, operational: true, financial: 'full' },
    { id: 'jv', name: 'Joint venture plant', equity: 50, operational: false, financial: 'joint' },
    { id: 'mc', name: 'Site run under contract', equity: 0, operational: true, financial: 'none' },
    { id: 'as', name: 'Minority stake (associate)', equity: 25, operational: false, financial: 'none' },
  ],
  activities: [
    { id: 'a1', entityId: 'hq', factorId: 'natural-gas', quantity: 180000 },
    { id: 'a2', entityId: 'hq', factorId: 'grid-uk', quantity: 240000, renewablePct: 50 },
    { id: 'a3', entityId: 'hq', factorId: 'r410a', quantity: 6 },
    { id: 'a4', entityId: 'hq', factorId: 'flight-long', quantity: 60000 },
    { id: 'a5', entityId: 'hq', factorId: 'rail', quantity: 42000 },
    { id: 'a6', entityId: 'hq', factorId: 'commute-car', quantity: 310000 },
    { id: 'a7', entityId: 'wh', factorId: 'diesel', quantity: 52000 },
    { id: 'a8', entityId: 'wh', factorId: 'grid-uk', quantity: 410000 },
    { id: 'a9', entityId: 'wh', factorId: 'waste-landfill', quantity: 85 },
    { id: 'a10', entityId: 'jv', factorId: 'natural-gas', quantity: 920000 },
    { id: 'a11', entityId: 'jv', factorId: 'grid-uk', quantity: 600000 },
    { id: 'a12', entityId: 'mc', factorId: 'natural-gas', quantity: 260000 },
    { id: 'a13', entityId: 'mc', factorId: 'grid-uk', quantity: 150000 },
    { id: 'a14', entityId: 'as', factorId: 'grid-uk', quantity: 380000 },
    { id: 'a15', entityId: 'as', factorId: 'petrol', quantity: 9000 },
  ],
  overrides: {},
}

export const EMPTY: CalcState = { ...SAMPLE, entities: [SAMPLE.entities[0] as Entity], activities: [] }

export function loadState(raw: unknown): CalcState {
  const p = StateSchema.safeParse(raw)
  return p.success ? p.data : SAMPLE
}

export const newId = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 8)}`

/* ---------------- calculation ---------------- */

export function inclusion(e: Entity, approach: Approach): number {
  if (approach === 'operational') return e.operational ? 1 : 0
  if (approach === 'equity') return e.equity / 100
  return e.financial === 'full' ? 1 : e.financial === 'joint' ? e.equity / 100 : 0
}

export function inclusionReason(e: Entity, approach: Approach): string {
  if (approach === 'operational') return e.operational ? 'operates it: 100%' : 'no operational control: 0%'
  if (approach === 'equity') return `equity share: ${fmtPct(e.equity)}`
  if (e.financial === 'full') return 'financial control: 100%'
  if (e.financial === 'joint') return `joint financial control: equity ${fmtPct(e.equity)}`
  return 'no financial control: 0%'
}

export interface Line {
  activityId: string
  derived: boolean
  entity: Entity
  factor: Factor
  kgPerUnit: number
  quantity: number
  /** Effective quantity after contractual instruments (market-based Scope 2). */
  netQuantity: number
  inclusion: number
  grossKg: number
  reportedKg: number
}

export interface Totals {
  lines: Line[]
  totalKg: number
  byScope: Record<Scope, number>
  byCategory: Record<CategoryId, number>
  byEntity: Record<string, number>
}

export const kgFor = (f: Factor, overrides: CalcState['overrides']) => overrides[f.id] ?? f.kg

export function calculate(state: CalcState, approach: Approach = state.approach): Totals {
  const ents = new Map(state.entities.map((e) => [e.id, e]))
  const lines: Line[] = []
  for (const a of state.activities) {
    const entity = ents.get(a.entityId)
    const factor = factorById(a.factorId)
    if (!entity || !factor) continue
    const inc = inclusion(entity, approach)
    const kgPerUnit = kgFor(factor, state.overrides)
    const isElec = factor.category === 's2-electricity'
    const netQuantity = isElec && state.s2 === 'market' ? a.quantity * (1 - (a.renewablePct ?? 0) / 100) : a.quantity
    const grossKg = netQuantity * kgPerUnit
    lines.push({ activityId: a.id, derived: false, entity, factor, kgPerUnit, quantity: a.quantity, netQuantity, inclusion: inc, grossKg, reportedKg: grossKg * inc })
    if (isElec && state.includeTD) {
      const td = kgFor(TD_FACTOR, state.overrides)
      const g = a.quantity * td
      lines.push({ activityId: a.id, derived: true, entity, factor: TD_FACTOR, kgPerUnit: td, quantity: a.quantity, netQuantity: a.quantity, inclusion: inc, grossKg: g, reportedKg: g * inc })
    }
  }
  const byScope: Record<Scope, number> = { 1: 0, 2: 0, 3: 0 }
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Record<CategoryId, number>
  const byEntity: Record<string, number> = {}
  let totalKg = 0
  for (const l of lines) {
    const c = categoryOf(l.factor.category)
    byScope[c.scope] += l.reportedKg
    byCategory[c.id] += l.reportedKg
    byEntity[l.entity.id] = (byEntity[l.entity.id] ?? 0) + l.reportedKg
    totalKg += l.reportedKg
  }
  return { lines, totalKg, byScope, byCategory, byEntity }
}

/* ---------------- formatting + CSV ---------------- */

export function fmtT(kg: number): string {
  const t = kg / 1000
  if (t === 0) return '0'
  if (Math.abs(t) < 0.1) return t.toFixed(3)
  if (Math.abs(t) < 10) return t.toFixed(2)
  if (Math.abs(t) < 1000) return t.toFixed(1)
  return Math.round(t).toLocaleString('en-GB')
}
export const fmtPct = (p: number) => `${Number.isInteger(p) ? p : p.toFixed(1)}%`
export const fmtNum = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 3 })

const csvCell = (v: string | number) => {
  const s = String(v)
  // Quote when needed; neutralise spreadsheet formula injection from user-typed names.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === 'string' ? `'${s}` : s
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(state: CalcState, t: Totals): string {
  const approach = APPROACHES.find((a) => a.value === state.approach)?.label ?? state.approach
  const head = [
    'entity', 'equity_pct', 'operational_control', 'financial_control', 'boundary_approach', 'inclusion_pct',
    'scope', 'category', 'activity', 'derived', 'quantity', 'unit', 'scope2_method', 'contractual_renewable_pct',
    'factor_kgco2e_per_unit', 'factor_source', 'gross_kgco2e', 'reported_kgco2e',
  ]
  const acts = new Map(state.activities.map((a) => [a.id, a]))
  const rows = t.lines.map((l) => {
    const c = categoryOf(l.factor.category)
    const isElec = c.id === 's2-electricity'
    return [
      l.entity.name, l.entity.equity, l.entity.operational ? 'yes' : 'no', l.entity.financial, approach,
      +(l.inclusion * 100).toFixed(2), c.scope, c.label, l.factor.label, l.derived ? 'yes' : 'no',
      l.quantity, l.factor.unit, isElec ? state.s2 : '', isElec ? (acts.get(l.activityId)?.renewablePct ?? 0) : '',
      l.kgPerUnit, l.factor.source, +l.grossKg.toFixed(3), +l.reportedKg.toFixed(3),
    ]
  })
  const total = ['TOTAL', '', '', '', approach, '', '', '', '', '', '', '', state.s2, '', '', '', '', +t.totalKg.toFixed(3)]
  return [head, ...rows, total].map((r) => r.map(csvCell).join(',')).join('\n') + '\n'
}
