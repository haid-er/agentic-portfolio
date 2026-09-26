/**
 * Human-readable change summaries for commit messages and save toasts.
 * Owner: admin-core. Pure functions (client + server safe).
 *
 * List collections ({ items: [{ id, ... }] }) are compared by item id:
 *   "2 edited (react, nextjs), 1 added (bullmq), 1 hidden (vlad)"
 * Everything else is compared by top-level key: "edited hero, seo".
 */

type Json = unknown

const isObj = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v)
const same = (a: Json, b: Json) => JSON.stringify(a) === JSON.stringify(b)

interface Item {
  id: string
  enabled?: boolean
}

const itemsOf = (v: Json): Item[] | null => {
  if (!isObj(v) || !Array.isArray(v.items)) return null
  return v.items.every((i) => isObj(i) && typeof i.id === 'string') ? (v.items as Item[]) : null
}

/** "a, b, c, +2" */
const names = (ids: string[], max = 3) => `${ids.slice(0, max).join(', ')}${ids.length > max ? `, +${ids.length - max}` : ''}`
/** " (a, b, c, +2)" or "" */
const list = (ids: string[]) => (ids.length ? ` (${names(ids)})` : '')

export interface ChangeSummary {
  /** One line, e.g. "2 edited (react, nextjs), 1 added (bullmq)". Empty when nothing changed. */
  text: string
  changed: boolean
}

export function describeChange(before: Json, after: Json): ChangeSummary {
  if (same(before, after)) return { text: '', changed: false }

  const a = itemsOf(before)
  const b = itemsOf(after)
  const parts: string[] = []

  if (a && b) {
    const prev = new Map(a.map((i) => [i.id, i]))
    const next = new Map(b.map((i) => [i.id, i]))
    const added = b.filter((i) => !prev.has(i.id)).map((i) => i.id)
    const removed = a.filter((i) => !next.has(i.id)).map((i) => i.id)
    const shown: string[] = []
    const hidden: string[] = []
    const edited: string[] = []
    for (const i of b) {
      const old = prev.get(i.id)
      if (!old || same(old, i)) continue
      if (old.enabled !== i.enabled) (i.enabled ? shown : hidden).push(i.id)
      const { enabled: _x, ...restOld } = old
      const { enabled: _y, ...restNew } = i
      if (!same(restOld, restNew)) edited.push(i.id)
    }
    const commonOrderPrev = a.map((i) => i.id).filter((id) => next.has(id))
    const commonOrderNext = b.map((i) => i.id).filter((id) => prev.has(id))
    const reordered = !same(commonOrderPrev, commonOrderNext)

    if (edited.length) parts.push(`${edited.length} edited${list(edited)}`)
    if (added.length) parts.push(`${added.length} added${list(added)}`)
    if (removed.length) parts.push(`${removed.length} removed${list(removed)}`)
    if (shown.length) parts.push(`${shown.length} shown${list(shown)}`)
    if (hidden.length) parts.push(`${hidden.length} hidden${list(hidden)}`)
    if (reordered) parts.push('reordered')

    // Extra top-level fields next to `items` (e.g. research.pipeline).
    const extra = topLevel(before, after).filter((k) => k !== 'items')
    if (extra.length) parts.push(`edited ${names(extra, 4)}`)
  } else {
    const keys = topLevel(before, after)
    parts.push(keys.length ? `edited ${names(keys, 4)}` : 'edited')
  }

  return { text: parts.join(', ') || 'edited', changed: true }
}

function topLevel(before: Json, after: Json): string[] {
  if (!isObj(before) || !isObj(after)) return []
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys].filter((k) => !same(before[k], after[k]))
}
