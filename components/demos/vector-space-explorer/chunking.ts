/**
 * Four chunking strategies, as used before upserting into a vector index.
 * Every chunk keeps its character offsets so the UI can show where the cuts fall.
 */
export type Strategy = 'fixed' | 'overlap' | 'sentence' | 'paragraph'

export interface Chunk {
  text: string
  start: number
  end: number
}

export const STRATEGIES: ReadonlyArray<{ value: Strategy; label: string; blurb: string }> = [
  { value: 'fixed', label: 'Fixed', blurb: 'Cut every N characters. Simple and predictable, but it slices through words and facts.' },
  { value: 'overlap', label: 'Overlap', blurb: 'Fixed windows that overlap by 25%, so a fact cut at one edge survives whole in the neighbour. Costs more vectors.' },
  { value: 'sentence', label: 'Sentence', blurb: 'Pack whole sentences up to N characters. Facts stay intact; chunk sizes vary.' },
  { value: 'paragraph', label: 'Paragraph', blurb: 'One chunk per paragraph (split further only if longer than N). Follows the author’s structure.' },
]

function spans(text: string, re: RegExp): Chunk[] {
  const out: Chunk[] = []
  for (const m of text.matchAll(re)) {
    const raw = m[0]
    const lead = raw.length - raw.trimStart().length
    const t = raw.trim()
    if (t) out.push({ text: t, start: (m.index ?? 0) + lead, end: (m.index ?? 0) + lead + t.length })
  }
  return out
}

function windows(text: string, size: number, step: number): Chunk[] {
  const out: Chunk[] = []
  for (let start = 0; start < text.length; start += step) {
    const end = Math.min(text.length, start + size)
    out.push({ text: text.slice(start, end), start, end })
    if (end === text.length) break
  }
  return out
}

/** Greedily pack units (sentences) into chunks no longer than `size` (a single long unit stays whole). */
function pack(text: string, units: Chunk[], size: number): Chunk[] {
  const out: Chunk[] = []
  let cur: Chunk | null = null
  for (const u of units) {
    if (cur && u.end - cur.start <= size) cur = { start: cur.start, end: u.end, text: '' }
    else {
      if (cur) out.push(cur)
      cur = { ...u }
    }
  }
  if (cur) out.push(cur)
  return out.map((c) => ({ ...c, text: text.slice(c.start, c.end) }))
}

const sentences = (text: string) => spans(text, /[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)

export function chunk(text: string, strategy: Strategy, size: number): Chunk[] {
  switch (strategy) {
    case 'fixed':
      return windows(text, size, size)
    case 'overlap':
      return windows(text, size, Math.max(1, Math.round(size * 0.75)))
    case 'sentence':
      return pack(text, sentences(text), size)
    case 'paragraph':
      return spans(text, /[^\n]+(\n(?!\n)[^\n]+)*/g).flatMap((p) =>
        p.text.length <= size ? [p] : pack(text, sentences(p.text).map((s) => ({ ...s, start: s.start + p.start, end: s.end + p.start })), size),
      )
  }
}
