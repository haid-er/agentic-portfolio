/**
 * A first-match model router: ordered rules on keywords and prompt length decide which
 * model serves each request. Compared against sending everything to one model.
 */
import { estimateTokens } from './tokens'

export type RuleKind = 'keywords' | 'longer' | 'default'

export interface Rule {
  id: string
  kind: RuleKind
  label: string
  /** Comma-separated, case-insensitive (keywords rules). */
  keywords: string
  /** Estimated prompt tokens above which the rule fires (length rules). */
  threshold: number
  model: string
}

export const DEFAULT_RULES: readonly Rule[] = [
  { id: 'r-labels', kind: 'keywords', label: 'Short labelling tasks', keywords: 'classify, which scope, tag this, answer with', threshold: 0, model: 'gemini-3.5-flash-lite' },
  { id: 'r-reason', kind: 'keywords', label: 'Writing and reasoning', keywords: 'draft, explain, compare, why', threshold: 0, model: 'claude-sonnet-5' },
  { id: 'r-long', kind: 'longer', label: 'Long inputs', keywords: '', threshold: 150, model: 'gemini-3.8-flash' },
  { id: 'r-default', kind: 'default', label: 'Everything else', keywords: '', threshold: 0, model: 'deepseek-flash' },
]

/** Shared system prompt size assumed for every routed request. */
export const ROUTER_PREFIX_TOKENS = 300

export interface SampleRequest {
  id: string
  prompt: string
  outputTokens: number
}

export const SAMPLE_REQUESTS: readonly SampleRequest[] = [
  { id: 'q1', outputTokens: 20, prompt: 'Classify this invoice line into a GHG Protocol category: "Taxi, airport to client office, 38 km".' },
  { id: 'q2', outputTokens: 10, prompt: 'Which scope is purchased electricity for our Leeds office? Answer with the scope only.' },
  { id: 'q3', outputTokens: 80, prompt: 'Extract supplier, period, kWh and total cost as JSON from: "Northern Power Ltd, billing period 1 Jul to 30 Sep, 12,450 kWh, total £2,988.00".' },
  { id: 'q4', outputTokens: 60, prompt: 'Extract the refrigerant type and top-up quantity from this service note: "Site B chiller serviced; R-410A topped up by 2.5 kg after leak test."' },
  { id: 'q5', outputTokens: 400, prompt: 'Draft a 150-word paragraph for the annual report explaining why Scope 2 emissions fell. Figures: 412.0 tCO2e last year, 355.4 tCO2e this year; the Leeds office moved to a building heated by a heat pump.' },
  { id: 'q6', outputTokens: 350, prompt: 'Explain the difference between location-based and market-based Scope 2 reporting for a finance audience.' },
  { id: 'q7', outputTokens: 8, prompt: 'Tag this supplier email as one of: data request, invoice, complaint, other. Email: "Please send the Q3 consumption data by Friday."' },
  {
    id: 'q8', outputTokens: 180,
    prompt: 'Summarise the energy and emissions obligations in this lease clause in three bullet points. Clause: "The Tenant shall provide the Landlord, within twenty business days of each quarter end, with meter readings for electricity, gas and water consumed within the Premises, together with any sub-meter readings the Tenant holds. The Tenant shall not install fossil-fuel heating or cooking equipment without prior written consent. The Landlord may install, maintain and read smart meters and shall share the resulting data with the Tenant on request. Both parties shall co-operate in good faith to improve the energy performance rating of the Building, including by agreeing a plan for any works recommended in the most recent energy assessment, and the cost of such works shall be allocated as set out in Schedule 4. The Tenant shall report any refrigerant leak from equipment it operates within five business days."',
  },
  { id: 'q9', outputTokens: 300, prompt: 'Compare these two heat-pump quotes and say which has the lower ten-year cost, and why. Quote A: £48,000 installed, service £900 a year. Quote B: £41,500 installed, service £1,600 a year.' },
  { id: 'q10', outputTokens: 20, prompt: 'Classify: "Courier, parcels to customers, 14 deliveries" into a GHG Protocol category.' },
]

export function keywordList(s: string): string[] {
  return s.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
}

/** First rule that matches wins; the default rule (or the last rule) catches the rest. */
export function route(prompt: string, rules: readonly Rule[]): { rule: Rule; tokens: number } {
  const tokens = estimateTokens(prompt)
  const text = prompt.toLowerCase()
  for (const r of rules) {
    if (r.kind === 'default') return { rule: r, tokens }
    if (r.kind === 'keywords' && keywordList(r.keywords).some((k) => text.includes(k))) return { rule: r, tokens }
    if (r.kind === 'longer' && tokens > r.threshold) return { rule: r, tokens }
  }
  const last = rules[rules.length - 1] ?? DEFAULT_RULES[DEFAULT_RULES.length - 1]
  return { rule: last, tokens }
}
