/** AI pass: one structured call per pillar group, so each answer stays well under the token cap. */
import { z } from 'zod'
import type { Pillar, Requirement } from './checklist'

export function findingsSchema(ids: [string, ...string[]]) {
  return z.object({
    findings: z.array(z.object({
      id: z.enum(ids),
      status: z.enum(['met', 'partial', 'gap']),
      evidence: z.string().max(200).describe('Short verbatim quote from the excerpt (max 15 words), or "" if none'),
      recommendation: z.string().max(200).describe('One concrete next step (max 20 words), or "" when met'),
    })).max(ids.length),
  })
}

export const SYSTEM = [
  'You are a sustainability-reporting analyst doing a disclosure gap analysis of a report excerpt.',
  'For each requirement, judge only what the excerpt says: "met" = specific and decision-useful,',
  '"partial" = mentioned but missing key elements, "gap" = not addressed.',
  'evidence must be copied verbatim from the excerpt (at most 15 words), or "" if there is none. Never paraphrase evidence.',
  'recommendation: one concrete next step naming what is missing (at most 20 words); "" when met.',
  'Return exactly one finding per requirement id. Be strict: vague commitments are "partial".',
].join(' ')

/**
 * Pillar groups -> one request each (3 requests per run, to spare the per-minute quota).
 * At most 6 requirements per group (~60 output tokens each) keeps every answer well under the 800-token cap.
 */
export const BATCHES: Pillar[][] = [
  ['Governance', 'Risk management'],
  ['Strategy', 'Materiality'],
  ['Metrics & targets'],
]

export function userPrompt(reqs: Requirement[], excerpt: string): string {
  const list = reqs.map((r) => `- ${r.id}: ${r.title}. Complete disclosure: ${r.expects}`).join('\n')
  return `Requirements:\n${list}\n\nReport excerpt:\n"""\n${excerpt}\n"""`
}
