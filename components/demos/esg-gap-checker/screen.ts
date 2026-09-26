/**
 * Offline keyword screen: finds the best-matching sentence per requirement and grades it.
 *   gap     = the subject never comes up
 *   partial = the subject is mentioned but specifics are thin
 *   met     = the subject plus at least two signs of specificity in the same passage
 * It is a screen, not a judgement: the AI pass reads meaning, this only reads words.
 */
import type { Requirement } from './checklist'

export type Status = 'met' | 'partial' | 'gap'
export type Origin = 'ai' | 'screen'

export interface Finding {
  id: string
  status: Status
  evidence: string
  recommendation: string
  origin: Origin
  /** true when the evidence string appears verbatim in the excerpt. */
  quoteFound: boolean
}

export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
}

const count = (res: RegExp[], s: string) => res.reduce((n, re) => n + (re.test(s) ? 1 : 0), 0)

function clip(s: string, n = 220) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s
}

export function screen(text: string, reqs: Requirement[]): Finding[] {
  const ss = sentences(text)
  return reqs.map((r) => {
    let best = -1
    let bestScore = 0
    let bestDepth = 0
    ss.forEach((s, i) => {
      const t = count(r.topic, s)
      if (!t) return
      // Look at the sentence plus its neighbour: disclosures often put the number in the next sentence.
      const window = `${s} ${ss[i + 1] ?? ''}`
      const d = count(r.depth, window)
      const score = t * 2 + d
      if (score > bestScore) { best = i; bestScore = score; bestDepth = d }
    })
    if (best < 0) {
      return { id: r.id, status: 'gap', evidence: '', recommendation: `Add a disclosure: ${r.expects}`, origin: 'screen', quoteFound: false }
    }
    const status: Status = bestDepth >= 2 ? 'met' : 'partial'
    return {
      id: r.id,
      status,
      evidence: clip(ss[best]),
      recommendation: status === 'met' ? '' : `Make it specific: ${r.expects}`,
      origin: 'screen',
      quoteFound: true,
    }
  })
}

/** Is `quote` (model output) really in the excerpt? Whitespace, quotes and case are normalised. */
export function quoteIn(text: string, quote: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[“”"‘’'…]/g, '').replace(/\s+/g, ' ').trim()
  const q = norm(quote)
  if (q.length < 8) return false
  return norm(text).includes(q)
}
