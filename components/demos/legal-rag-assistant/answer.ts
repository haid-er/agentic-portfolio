/**
 * Generation side of the legal RAG: the grounded prompt, an offline extractive
 * answer, and a citation check that runs on whatever the model wrote.
 */
import type { AiMessage } from '@/lib/ai'
import { SOURCE_NAME } from './corpus'
import { terms, type Hit } from './retrieve'

export const SYSTEM_PROMPT = [
  `You are a careful legal research assistant. You answer ONLY from the numbered sources, which are provisions of the ${SOURCE_NAME} (public domain).`,
  'Rules:',
  '- Every sentence ends with the citation of the source(s) it relies on, like [1] or [2][3]. Cite only numbers that exist.',
  '- Quote short key phrases from the source text exactly, in quotation marks.',
  '- Do not use outside knowledge: no case law, no later court interpretations, no state law.',
  '- If the sources do not answer the question, reply exactly: "The provided sources do not answer this." and nothing else.',
  '- Plain English, at most 120 words, no headings, no legal advice, no disclaimers (the interface shows one).',
].join('\n')

export function sourceLabel(h: Hit): string {
  const p = h.chunk.provision
  return `${p.cite}${h.chunk.parts > 1 ? ` (part ${h.chunk.part} of ${h.chunk.parts})` : ''}, ${p.year}`
}

export function buildMessages(q: string, sources: Hit[]): AiMessage[] {
  const block = sources.map((h, i) => `[${i + 1}] ${sourceLabel(h)}: "${h.chunk.text}"`).join('\n')
  return [{ role: 'user', content: `Sources:\n${block}\n\nQuestion: ${q}` }]
}

/** Offline answer: the best-matching clause of each top source, quoted verbatim and cited. */
export function extractiveAnswer(qTerms: string[], sources: Hit[]): string {
  const want = new Set(qTerms)
  const parts = sources.slice(0, 3).map((h, i) => {
    const clauses = h.chunk.text.split(/(?<=[;.])\s+/)
    let best = clauses[0] ?? h.chunk.text
    let bestScore = -1
    for (const c of clauses) {
      const s = terms(c).filter((t) => want.has(t)).length
      if (s > bestScore) { best = c; bestScore = s }
    }
    const clean = best.replace(/[;,]$/, '').trim()
    return `${h.chunk.provision.cite} says: “${clean}” [${i + 1}]`
  })
  return parts.join('\n\n')
}

export type Seg = { kind: 'text'; text: string } | { kind: 'cite'; n: number }

/** Split an answer into text and [n] citation segments. */
export function segments(text: string): Seg[] {
  const out: Seg[] = []
  let last = 0
  for (const m of text.matchAll(/\[(\d{1,2})\]/g)) {
    const at = m.index ?? 0
    if (at > last) out.push({ kind: 'text', text: text.slice(last, at) })
    out.push({ kind: 'cite', n: Number(m[1]) })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

export interface CiteCheck {
  sentences: number
  cited: number
  invalid: number[]
  used: number[]
  refused: boolean
}

export function checkCitations(text: string, sourceCount: number): CiteCheck {
  const refused = /provided sources do not answer/i.test(text)
  const sentences = text
    .split(/(?<=[.!?”"])\s+(?=[A-Z“"])|\n+/)
    .map((s) => s.trim())
    .filter((s) => /[a-z]{3}/i.test(s.replace(/\[\d+\]/g, '')))
  const cited = sentences.filter((s) => /\[\d{1,2}\]/.test(s)).length
  const nums = [...text.matchAll(/\[(\d{1,2})\]/g)].map((m) => Number(m[1]))
  const invalid = [...new Set(nums.filter((n) => n < 1 || n > sourceCount))]
  const used = [...new Set(nums.filter((n) => n >= 1 && n <= sourceCount))].sort((a, b) => a - b)
  return { sentences: sentences.length, cited, invalid, used, refused }
}
