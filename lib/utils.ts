/** Join class names, skipping falsy values. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2025-09" -> "Sep 2025", "2025" -> "2025", "" -> "". */
export function formatPartialDate(d: string | undefined): string {
  if (!d) return ''
  const [y, m] = d.split('-')
  return m ? `${MONTHS[Number(m) - 1] ?? ''} ${y}`.trim() : (y ?? '')
}

/** "Sep 2025 – Present" (empty end = present). */
export function formatRange(start: string, end: string, presentLabel = 'Present'): string {
  const s = formatPartialDate(start)
  const e = end ? formatPartialDate(end) : presentLabel
  return s ? `${s} – ${e}` : e
}

/** Two-digit folio number: 2 -> "02". */
export const folio = (n: number) => String(n).padStart(2, '0')

/** Deterministic PRNG (mulberry32) for seeded visuals. */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
