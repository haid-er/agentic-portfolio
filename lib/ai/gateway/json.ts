/**
 * Structured-output helpers: pull JSON out of a model reply and check it against the
 * request's JSON Schema (the subset z.toJSONSchema emits). The client re-validates with
 * the original zod schema; this server check lets us repair once before replying.
 */
import 'server-only'

type Schema = Record<string, unknown>

/** Drop keys providers reject or do not need ($schema, $id). */
export function cleanSchema(schema: Schema): Schema {
  const { $schema: _s, $id: _i, ...rest } = schema
  return rest
}

export function rootIsObject(schema: Schema): boolean {
  return schema.type === 'object' || (schema.type === undefined && typeof schema.properties === 'object')
}

export function schemaInstructions(name: string, schema: Schema): string {
  return [
    `You are a JSON API. Reply with ONE JSON value that matches the JSON Schema named "${name}" below.`,
    'No prose, no markdown fences, no comments. Use only facts present in the input; when a value is unknown, use an empty string, empty array or null where the schema allows it.',
    `Schema:\n${JSON.stringify(schema)}`,
  ].join('\n')
}

/** Parse the first JSON value in a reply (tolerates ```json fences and chatter around it). */
export function extractJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const t = text.trim()
  const attempts: string[] = [t]
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(t)?.[1]
  if (fenced) attempts.push(fenced.trim())
  const start = t.search(/[[{]/)
  if (start >= 0) {
    const close = t[start] === '{' ? '}' : ']'
    const end = t.lastIndexOf(close)
    if (end > start) attempts.push(t.slice(start, end + 1))
  }
  for (const a of attempts) {
    try {
      return { ok: true, value: JSON.parse(a) }
    } catch { /* next */ }
  }
  return { ok: false, error: 'Reply was not valid JSON' }
}

/* ------------------------------------------------------------------ */
/* validator                                                            */
/* ------------------------------------------------------------------ */

interface Ctx {
  root: Schema
  issues: string[]
  depth: number
  /** Shared across anyOf sub-contexts: total `check` calls for this validation. */
  work: { visits: number; gaveUp: boolean }
}

const MAX_ISSUES = 8
/**
 * The schema comes from the client, so the validator must not do unbounded work.
 * Model output is capped by maxTokens, so a legit check needs a few hundred visits.
 */
const MAX_VISITS = 10_000
const MAX_DEPTH = 64

function typeOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  return typeof v
}

function typeMatches(want: string, v: unknown): boolean {
  const got = typeOf(v)
  return want === got || (want === 'number' && got === 'integer')
}

function resolveRef(ref: string, root: Schema): Schema | undefined {
  if (ref === '#') return root
  if (!ref.startsWith('#/')) return undefined
  let node: unknown = root
  for (const seg of ref.slice(2).split('/')) {
    const key = seg.replace(/~1/g, '/').replace(/~0/g, '~')
    node = node && typeof node === 'object' ? (node as Schema)[key] : undefined
  }
  return node && typeof node === 'object' ? (node as Schema) : undefined
}

/** Returns the (possibly pruned) value; pushes issues into ctx. */
function check(value: unknown, schema: Schema, path: string, ctx: Ctx): unknown {
  if (ctx.issues.length >= MAX_ISSUES || ctx.work.gaveUp) return value
  if (++ctx.work.visits > MAX_VISITS || ctx.depth > MAX_DEPTH) {
    ctx.work.gaveUp = true
    return value
  }
  const at = path || '(root)'
  const fail = (msg: string) => { ctx.issues.push(`${at}: ${msg}`) }

  if (typeof schema.$ref === 'string') {
    const target = resolveRef(schema.$ref, ctx.root)
    if (!target) return value
    ctx.depth++
    const out = check(value, target, path, ctx)
    ctx.depth--
    return out
  }

  const alternatives = (schema.anyOf ?? schema.oneOf) as Schema[] | undefined
  if (Array.isArray(alternatives)) {
    for (const alt of alternatives) {
      const sub: Ctx = { root: ctx.root, issues: [], depth: ctx.depth + 1, work: ctx.work }
      const out = check(value, alt, path, sub)
      if (!sub.issues.length) return out
    }
    fail('does not match any allowed shape')
    return value
  }
  if (Array.isArray(schema.allOf)) {
    let out = value
    ctx.depth++
    for (const part of schema.allOf as Schema[]) out = check(out, part, path, ctx)
    ctx.depth--
    return out
  }

  if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) fail(`must be ${JSON.stringify(schema.const)}`)
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
    fail(`must be one of ${schema.enum.slice(0, 8).map((e) => JSON.stringify(e)).join(', ')}`)
  }

  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string]
  if (types.length && !types.some((t) => typeMatches(t, value))) {
    fail(`expected ${types.join(' | ')}, got ${typeOf(value)}`)
    return value
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) fail(`shorter than ${schema.minLength}`)
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) fail(`longer than ${schema.maxLength}`)
    // `pattern` is deliberately not evaluated: it is a client-supplied regex (ReDoS risk on
    // the shared server). The client's zod schema still enforces it.
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) fail(`must be >= ${schema.minimum}`)
    if (typeof schema.maximum === 'number' && value > schema.maximum) fail(`must be <= ${schema.maximum}`)
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) fail(`must be > ${schema.exclusiveMinimum}`)
    if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) fail(`must be < ${schema.exclusiveMaximum}`)
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) fail(`needs at least ${schema.minItems} items`)
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) fail(`allows at most ${schema.maxItems} items`)
    const prefix = Array.isArray(schema.prefixItems) ? (schema.prefixItems as Schema[]) : []
    const items = schema.items && typeof schema.items === 'object' ? (schema.items as Schema) : undefined
    return value.map((v, i) => {
      const s = prefix[i] ?? items
      return s ? check(v, s, `${path}[${i}]`, ctx) : v
    })
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const props = (schema.properties ?? {}) as Record<string, Schema>
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : []
    for (const key of required) if (!(key in obj)) fail(`missing "${key}"`)
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      const sub = props[k]
      if (sub) out[k] = check(v, sub, path ? `${path}.${k}` : k, ctx)
      else if (schema.additionalProperties === false) continue // prune extras, as zod's default object does
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        out[k] = check(v, schema.additionalProperties as Schema, path ? `${path}.${k}` : k, ctx)
      } else out[k] = v
    }
    return out
  }

  return value
}

export type SchemaCheck = { ok: true; value: unknown } | { ok: false; issues: string[] }

const newCtx = (root: Schema): Ctx => ({ root, issues: [], depth: 0, work: { visits: 0, gaveUp: false } })

/**
 * Check `value` against `schema`. If the check runs out of budget it stops and passes the
 * value through untouched: the client's zod schema is the final authority anyway.
 */
export function validateAgainst(value: unknown, schema: Schema, name?: string): SchemaCheck {
  const ctx = newCtx(schema)
  const out = check(value, schema, '', ctx)
  if (ctx.work.gaveUp) return { ok: true, value }
  if (!ctx.issues.length) return { ok: true, value: out }

  // Common slip: the model wraps the answer as {"SchemaName": {...}}.
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value)
    const only = entries.length === 1 ? entries[0] : undefined
    if (only && (!name || only[0].toLowerCase() === name.toLowerCase() || rootIsObject(schema))) {
      const inner = newCtx(schema)
      const unwrapped = check(only[1], schema, '', inner)
      if (inner.work.gaveUp) return { ok: true, value: only[1] }
      if (!inner.issues.length) return { ok: true, value: unwrapped }
    }
  }
  return { ok: false, issues: ctx.issues }
}

/* ------------------------------------------------------------------ */
/* preflight                                                            */
/* ------------------------------------------------------------------ */

/** Keywords whose subschemas apply to a child of the value (so recursion through them is bounded by the value). */
const DESCENDING = new Set(['properties', 'items', 'prefixItems', 'additionalProperties'])

/**
 * Reject request schemas the validator cannot check safely (throws a message for a 400):
 * - `$ref` must point inside the schema at `#`, `#/$defs/...` or `#/definitions/...`;
 * - every `$ref` cycle must pass through properties/items (a recursive tree is fine,
 *   `{"allOf":[{"$ref":"#"}]}` is not: it recurses without consuming the value).
 */
export function assertSchemaSafe(schema: Schema): void {
  const refs = new Map<string, Schema>()
  // Walk every subschema; for each, remember which refs it reaches without descending.
  const visit = (node: unknown, depth: number) => {
    if (depth > MAX_DEPTH) throw new Error('JSON Schema is nested too deeply.')
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { for (const n of node) visit(n, depth + 1); return }
    const ref = (node as Schema).$ref
    if (ref !== undefined) {
      if (typeof ref !== 'string' || !(ref === '#' || /^#\/(\$defs|definitions)\/[^/]+$/.test(ref))) {
        throw new Error('JSON Schema $ref must be "#" or point into #/$defs.')
      }
      const target = resolveRef(ref, schema)
      if (!target) throw new Error(`JSON Schema $ref ${ref} does not resolve.`)
      refs.set(ref, target)
    }
    for (const v of Object.values(node as Schema)) visit(v, depth + 1)
  }
  visit(schema, 0)

  // Refs reachable from a schema node without passing a descending keyword.
  const direct = (node: unknown, out: Set<string>) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { for (const n of node) direct(n, out); return }
    for (const [k, v] of Object.entries(node as Schema)) {
      if (k === '$ref' && typeof v === 'string') out.add(v)
      else if (!DESCENDING.has(k) && k !== '$defs' && k !== 'definitions') direct(v, out)
    }
  }
  const edges = new Map<string, Set<string>>()
  for (const [ref, target] of [['#', schema] as const, ...refs]) {
    const out = new Set<string>()
    direct(target, out)
    edges.set(ref, out)
  }
  // Depth-first search for a cycle in the "recurses without descending" graph.
  const state = new Map<string, 1 | 2>()
  const dfs = (ref: string) => {
    if (state.get(ref) === 2) return
    if (state.get(ref) === 1) throw new Error('JSON Schema has a $ref cycle that never descends into the value.')
    state.set(ref, 1)
    for (const next of edges.get(ref) ?? []) dfs(next)
    state.set(ref, 2)
  }
  for (const ref of edges.keys()) dfs(ref)
}
