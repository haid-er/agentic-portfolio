/**
 * Immutable path helpers for the admin editors (client + server safe).
 * A path is the same shape zod reports in `issue.path`: ['items', 3, 'name'].
 */
export type Path = readonly (string | number)[]

/** 'items.3.name' — the key zod issues and field errors are matched on. */
export const pathKey = (p: Path) => p.join('.')

export function getIn(obj: unknown, path: Path): unknown {
  let cur: unknown = obj
  for (const k of path) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string | number, unknown>)[k]
  }
  return cur
}

/**
 * Returns a copy of `obj` with `value` at `path`. `undefined` deletes an object
 * key, so optional fields disappear from the JSON instead of being saved as null.
 */
export function setIn<T>(obj: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T
  const [head, ...rest] = path
  const base: unknown = obj ?? (typeof head === 'number' ? [] : {})
  if (Array.isArray(base)) {
    const copy = base.slice()
    copy[head as number] = setIn(copy[head as number], rest, value)
    return copy as T
  }
  const copy = { ...(base as Record<string, unknown>) }
  const next = setIn(copy[head as string], rest, value)
  if (next === undefined) delete copy[head as string]
  else copy[head as string] = next
  return copy as T
}

/** Move an array element (returns a new array). */
export function move<T>(arr: readonly T[], from: number, to: number): T[] {
  const copy = arr.slice()
  if (from === to || from < 0 || to < 0 || from >= copy.length || to >= copy.length) return copy
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item as T)
  return copy
}

/** "Node.js & NestJS" -> "node-js-nestjs" (the content id / slug format). */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** A slug not already in `taken`: "item", "item-2", "item-3"… */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const root = slugify(base) || 'item'
  if (!used.has(root)) return root
  let n = 2
  while (used.has(`${root}-${n}`)) n++
  return `${root}-${n}`
}

/** Stable deep equality for JSON-shaped data. */
export const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
