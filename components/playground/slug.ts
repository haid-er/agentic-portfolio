/** Shared helpers for the playground (client + server safe, no imports). */

/** "Next.js & React" -> "next-js-react". Used to match ?skill= values. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Stable 32-bit hash of a string (poster seeds). */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Human "runs in" label for the kicker line. */
export function runsInLabel(r: 'browser' | 'edge' | 'server' | 'browser + ai'): string {
  switch (r) {
    case 'browser': return 'Runs in browser'
    case 'edge': return 'Runs at the edge'
    case 'server': return 'Runs on server'
    case 'browser + ai': return 'Browser + AI'
  }
}

/** The catalogue number: 7 -> "No. 07". */
export const catalogueNo = (n: number) => `No. ${String(n).padStart(2, '0')}`
