/** Org-chart data model: a flat list of people with manager ids (easy to edit, validate and export). */

export interface Person {
  id: string
  name: string
  title: string
  department: string
  managerId: string | null
}

export interface NestedPerson {
  name: string
  title: string
  department?: string
  reports: NestedPerson[]
}

export function childrenOf(people: Person[]): Map<string | null, Person[]> {
  const ids = new Set(people.map((p) => p.id))
  const map = new Map<string | null, Person[]>()
  for (const p of people) {
    const k = p.managerId && ids.has(p.managerId) ? p.managerId : null
    const list = map.get(k) ?? []
    list.push(p)
    map.set(k, list)
  }
  return map
}

/** Remove dangling manager ids, duplicate ids and cycles so the tree is always a forest. */
export function sanitize(people: Person[]): Person[] {
  const seen = new Set<string>()
  const out = people.map((p, i) => {
    let id = (p.id || `p${i + 1}`).trim()
    while (seen.has(id)) id = `${id}-${i + 1}`
    seen.add(id)
    return { ...p, id, name: p.name.trim() || 'Unnamed', title: p.title.trim(), department: p.department.trim() }
  })
  const ids = new Set(out.map((p) => p.id))
  const byId = new Map(out.map((p) => [p.id, p]))
  for (const p of out) {
    if (p.managerId && (!ids.has(p.managerId) || p.managerId === p.id)) p.managerId = null
  }
  // Break cycles: walk up from each node; if we come back to it, cut its manager link.
  for (const p of out) {
    const path = new Set<string>([p.id])
    let cur = p.managerId ? byId.get(p.managerId) : undefined
    while (cur) {
      if (path.has(cur.id)) { p.managerId = null; break }
      path.add(cur.id)
      cur = cur.managerId ? byId.get(cur.managerId) : undefined
    }
  }
  return out
}

export function wouldCycle(people: Person[], id: string, managerId: string | null): boolean {
  if (!managerId) return false
  const byId = new Map(people.map((p) => [p.id, p]))
  let cur: string | null = managerId
  while (cur) {
    if (cur === id) return true
    cur = byId.get(cur)?.managerId ?? null
  }
  return false
}

/** Delete a person; their direct reports move up to the deleted person's manager. */
export function removePerson(people: Person[], id: string): Person[] {
  const gone = people.find((p) => p.id === id)
  return people
    .filter((p) => p.id !== id)
    .map((p) => (p.managerId === id ? { ...p, managerId: gone?.managerId ?? null } : p))
}

export function newId(people: Person[]): string {
  let n = people.length + 1
  const ids = new Set(people.map((p) => p.id))
  while (ids.has(`p${n}`)) n++
  return `p${n}`
}

export function toNested(people: Person[]): NestedPerson[] {
  const kids = childrenOf(people)
  const build = (p: Person): NestedPerson => ({
    name: p.name,
    title: p.title,
    ...(p.department ? { department: p.department } : {}),
    reports: (kids.get(p.id) ?? []).map(build),
  })
  return (kids.get(null) ?? []).map(build)
}

export interface OrgStats { headcount: number; levels: number; widestSpan: number; departments: number; topCount: number }

export function stats(people: Person[]): OrgStats {
  const kids = childrenOf(people)
  let levels = 0
  const walk = (id: string, d: number) => {
    levels = Math.max(levels, d)
    for (const c of kids.get(id) ?? []) walk(c.id, d + 1)
  }
  for (const r of kids.get(null) ?? []) walk(r.id, 1)
  let widestSpan = 0
  for (const [k, v] of kids) if (k) widestSpan = Math.max(widestSpan, v.length)
  return {
    headcount: people.length,
    levels,
    widestSpan,
    departments: new Set(people.map((p) => p.department).filter(Boolean)).size,
    topCount: (kids.get(null) ?? []).length,
  }
}

export interface Placed { person: Person; x: number; depth: number }

/** Tidy-ish tree layout: leaves take the next column, parents centre over their children. x is in columns. */
export function layout(people: Person[]): { nodes: Placed[]; cols: number; depth: number } {
  const kids = childrenOf(people)
  const nodes: Placed[] = []
  let col = 0
  let depth = 0
  const place = (p: Person, d: number): number => {
    depth = Math.max(depth, d + 1)
    const cs = kids.get(p.id) ?? []
    let x: number
    if (!cs.length) x = col++
    else {
      const xs = cs.map((c) => place(c, d + 1))
      x = (xs[0] + xs[xs.length - 1]) / 2
    }
    nodes.push({ person: p, x, depth: d })
    return x
  }
  for (const r of kids.get(null) ?? []) place(r, 0)
  return { nodes, cols: Math.max(1, col), depth }
}
