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
}

const MAX_ISSUES = 8

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
  if (ctx.issues.length >= MAX_ISSUES || ctx.depth > 64) return value
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
      const sub: Ctx = { root: ctx.root, issues: [], depth: ctx.depth + 1 }
      const out = check(value, alt, path, sub)
      if (!sub.issues.length) return out
    }
    fail('does not match any allowed shape')
    return value
  }
  if (Array.isArray(schema.allOf)) {
    let out = value
    for (const part of schema.allOf as Schema[]) out = check(out, part, path, ctx)
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
    if (typeof schema.pattern === 'string') {
      try {
        if (!new RegExp(schema.pattern, 'u').test(value)) fail(`does not match /${schema.pattern}/`)
      } catch { /* unsupported pattern: skip */ }
    }
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

export function validateAgainst(value: unknown, schema: Schema, name?: string): SchemaCheck {
  const ctx: Ctx = { root: schema, issues: [], depth: 0 }
  const out = check(value, schema, '', ctx)
  if (!ctx.issues.length) return { ok: true, value: out }

  // Common slip: the model wraps the answer as {"SchemaName": {...}}.
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value)
    const only = entries.length === 1 ? entries[0] : undefined
    if (only && (!name || only[0].toLowerCase() === name.toLowerCase() || rootIsObject(schema))) {
      const inner: Ctx = { root: schema, issues: [], depth: 0 }
      const unwrapped = check(only[1], schema, '', inner)
      if (!inner.issues.length) return { ok: true, value: unwrapped }
    }
  }
  return { ok: false, issues: ctx.issues }
}
