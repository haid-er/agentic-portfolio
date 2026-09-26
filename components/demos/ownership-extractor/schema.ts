/** AI extraction contract: the model returns names; ids and the maths stay on this side. */
import { z } from 'zod'
import { type Group, slugId, uniqueId } from './model'

export const OwnershipExtraction = z.object({
  reportingEntity: z.string().min(1).max(120).describe('The parent / reporting company'),
  entities: z.array(z.object({
    name: z.string().min(1).max(120),
    emissions: z.number().min(0).nullable().describe('Scope 1+2 tCO2e if stated, else null'),
  })).min(1).max(20),
  links: z.array(z.object({
    owner: z.string().min(1).max(120),
    owned: z.string().min(1).max(120),
    equityPct: z.number().min(0).max(100),
    control: z.enum(['full', 'operational', 'financial', 'joint', 'none', 'unstated']),
  })).min(1).max(30),
})
export type OwnershipExtraction = z.infer<typeof OwnershipExtraction>

export const SYSTEM = [
  'You extract corporate ownership structures for GHG Protocol boundary-setting.',
  'Return every legal entity mentioned and every ownership link (owner -> owned, equity percent 0-100).',
  'control: "full" = owner has both operational and financial control; "operational" = owner operates it;',
  '"financial" = owner directs financial and operating policies for economic benefit; "joint" = control shared with partners;',
  '"none" = the text says there is no control (associate, minority); "unstated" = the text does not say.',
  'Convert words to numbers ("three quarters" = 75, "fully held" = 100, "a third" = 33.3).',
  'emissions: scope 1+2 tonnes CO2e only when the text gives a figure, otherwise null. Never invent figures or entities.',
  'Unnamed counterparties (e.g. "a freight firm") may be included with a short descriptive name.',
].join(' ')

/** Resolve model names to a Group, merging case/spacing variants and dropping dangling links. */
export function toGroup(x: OwnershipExtraction): Group {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const taken = new Set<string>()
  const ids = new Map<string, string>()
  const names = new Map<string, string>()
  const emissions = new Map<string, number | null>()
  const add = (name: string) => {
    const k = norm(name)
    if (!ids.has(k)) { ids.set(k, uniqueId(slugId(name), taken)); names.set(k, name.trim()) }
    return ids.get(k) as string
  }
  add(x.reportingEntity)
  for (const e of x.entities) { add(e.name); emissions.set(norm(e.name), e.emissions) }
  const linkIds = new Set<string>()
  const links = x.links
    .map((l) => ({ owner: add(l.owner), owned: add(l.owned), equityPct: l.equityPct, control: l.control }))
    .filter((l) => l.owner !== l.owned)
    .map((l) => ({ ...l, id: uniqueId(`${l.owner}--${l.owned}`, linkIds) }))
  return {
    parentId: ids.get(norm(x.reportingEntity)) as string,
    entities: [...ids.entries()].map(([k, id]) => ({ id, name: names.get(k) ?? id, emissions: emissions.get(k) ?? null })),
    links,
  }
}
