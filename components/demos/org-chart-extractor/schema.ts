/** Vision extraction contract: a flat list with manager ids keeps the output small and easy to validate. */
import { z } from 'zod'
import { type Person, sanitize } from './model'

/** About 30-35 output tokens per person; 20 fits the gateway's 800-token output cap with room to spare. */
export const MAX_PEOPLE = 20

export const OrgExtraction = z.object({
  people: z.array(z.object({
    id: z.string().min(1).max(12).describe('Short unique id: p1, p2, ...'),
    name: z.string().max(80),
    title: z.string().max(80).describe('Job title as printed, or ""'),
    department: z.string().max(60).describe('Department if printed or clearly grouped, else ""'),
    managerId: z.string().max(12).nullable().describe('id of the box this one reports to; null for the top'),
  })).min(1).max(MAX_PEOPLE),
})
export type OrgExtraction = z.infer<typeof OrgExtraction>

export const SYSTEM = [
  'You read organisation charts from images and return every box as a person.',
  'Follow the connector lines: managerId is the id of the box directly above that it connects to; null for top-level boxes.',
  'Copy names and titles exactly as printed. Use "" for anything not shown. Never invent people.',
  `Keep ids short (p1, p2, ...). At most ${MAX_PEOPLE} people; if there are more, return the top levels first.`,
].join(' ')

export const USER_TEXT = 'Extract this organisation chart as a flat list of people with manager ids.'

export function toPeople(x: OrgExtraction): Person[] {
  return sanitize(x.people.map((p) => ({ ...p, managerId: p.managerId || null })))
}
