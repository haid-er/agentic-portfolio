/**
 * AI gateway: SERVER API. Owner: ai-gateway.
 * Only /api/ai/* route handlers import this. Keys are read in gateway/config.ts and never
 * leave the server.
 *
 * Responsibilities (BRIEF 4):
 * - Provider router: groq -> gemini -> deepseek (only if content/ai.json enables it) with
 *   per-provider timeouts and failover; hard max_tokens clamp; per-instance DeepSeek budget.
 * - Per-IP rate limit (content/ai.json perIpPerMinute) + input caps (maxInputChars, image size).
 * - Per-demo gate: content/playground.json demo must be enabled.
 * - Structured output: JSON mode + validation against the request's JSON schema (1 repair turn).
 * - Usage headers (AI_HEADERS) on every response.
 */
import 'server-only'
import { PROVIDER_IDS } from '@/lib/content'
import {
  AI_HEADERS,
  AI_LIMITS,
  type AiMeta,
  type AiObjectWireRequest,
  type AiProviderState,
  type AiRouteStep,
  type AiStatus,
  type AiTextRequest,
  type AiTextResult,
} from './types'
import { aiConfig, isDemoAllowed, modelList, providerSettings } from './gateway/config'
import { GatewayError, ProviderError } from './gateway/errors'
import { coolingFor, deepseekCanAfford, deepseekLeft, healthKey } from './gateway/health'
import { assertSchemaSafe, cleanSchema, extractJson, rootIsObject, schemaInstructions, validateAgainst } from './gateway/json'
import { checkInput, peekRate, takeRate, type RateState } from './gateway/limits'
import { completeOnce, planRoute, routeComplete, routeStream, splitSystem, type Plan } from './gateway/router'
import type { ProviderAdapter, ProviderCall, StreamEnd } from './gateway/providers/types'

export { GatewayError }
export type { RateState }

export interface GatewayContext {
  ip: string
  signal?: AbortSignal
}

/** Best-effort client IP from Vercel / proxy headers. */
export function clientIp(req: Request): string {
  const vercel = req.headers.get('x-vercel-forwarded-for')
  const fwd = vercel ?? req.headers.get('x-forwarded-for')
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? '0.0.0.0').trim() || '0.0.0.0'
}

/* ------------------------------------------------------------------ */
/* status                                                               */
/* ------------------------------------------------------------------ */

function providerState(id: (typeof PROVIDER_IDS)[number]): { state: AiProviderState; retryInSec?: number } {
  const p = providerSettings(id)
  if (!p.enabled) return { state: 'off' }
  if (!p.key) return { state: 'no-key' }
  // Cooling only when every listed model is parked.
  const waits = modelList(p.model).map((m) => coolingFor(healthKey(id, m)))
  if (waits.length && waits.every((w) => w > 0)) return { state: 'cooling', retryInSec: Math.min(...waits) }
  if (id === 'deepseek') {
    const cfg = aiConfig()
    if (!deepseekCanAfford(cfg.deepseekBudgetTokens, 0, Math.min(cfg.maxTokens, 64))) return { state: 'budget' }
  }
  return { state: 'ready' }
}

export async function getStatus(): Promise<AiStatus> {
  const cfg = aiConfig()
  const providers = PROVIDER_IDS.map((id) => {
    const p = providerSettings(id)
    const s = providerState(id)
    return {
      id,
      enabled: p.enabled,
      configured: Boolean(p.key),
      model: p.model,
      ...(p.visionModel ? { visionModel: p.visionModel } : {}),
      ...s,
    }
  })
  const usable = providers.filter((p) => p.state === 'ready' || p.state === 'cooling')
  return {
    available: usable.length > 0,
    providers,
    vision: usable.some((p) => p.visionModel),
    browserFallback: cfg.browserFallback,
    limits: {
      maxTokens: cfg.maxTokens,
      maxInputChars: cfg.maxInputChars,
      perIpPerMinute: cfg.perIpPerMinute,
      maxImageBytes: AI_LIMITS.maxImageBytes,
      maxImages: AI_LIMITS.maxImages,
    },
    ...(cfg.providers.deepseek.enabled ? { deepseekBudgetLeft: deepseekLeft(cfg.deepseekBudgetTokens) } : {}),
  }
}

/* ------------------------------------------------------------------ */
/* shared preflight                                                     */
/* ------------------------------------------------------------------ */

interface Preflight {
  plan: Plan
  estInput: number
  started: number
}

/** Demo gate + input caps + route plan. The per-IP limit is spent in the route (see `admit`). */
function preflight(req: AiTextRequest, extra: { schema?: unknown; calls?: number } = {}): Preflight {
  if (!isDemoAllowed(req.demo)) throw new GatewayError('unavailable', 'This demo is switched off by the site admin.', 503)
  const cfg = aiConfig()
  const stats = checkInput(req, cfg.maxInputChars, { schema: extra.schema, tools: req.tools })
  const plan = planRoute(req, stats.estTokens, extra.calls)
  return { plan, estInput: stats.estTokens, started: Date.now() }
}

/** Spend one request from this IP's per-minute allowance (throws 429). */
export function admit(ip: string): RateState {
  return takeRate(ip, aiConfig().perIpPerMinute)
}

export function rateFor(ip: string): RateState {
  return peekRate(ip, aiConfig().perIpPerMinute)
}

function meta(served: { provider: AiMeta['provider']; model: string; route: AiRouteStep[] }, usage: AiMeta['usage'], started: number): AiMeta {
  return { provider: served.provider, model: served.model, usage, latencyMs: Date.now() - started, route: served.route }
}

/* ------------------------------------------------------------------ */
/* text                                                                 */
/* ------------------------------------------------------------------ */

/** Non-streaming completion (supports tools). */
export async function complete(req: AiTextRequest, ctx: GatewayContext): Promise<AiTextResult> {
  const pf = preflight(req)
  const { system, messages } = splitSystem(req)
  const served = await routeComplete(pf.plan, { system, messages, temperature: req.temperature, tools: req.tools }, pf.estInput, ctx.signal, completeOnce)
  return { ...meta(served, served.value.usage, pf.started), text: served.value.text, ...(served.value.toolCalls ? { toolCalls: served.value.toolCalls } : {}) }
}

export interface GatewayStream {
  provider: AiMeta['provider']
  model: string
  /** Visible text chunks; returns the final meta. */
  chunks: AsyncGenerator<string, AiMeta>
  /** Stop early (visitor left): frees the provider attempt and the DeepSeek reservation. */
  close: () => void
}

/**
 * Open a stream. Resolves once the first visible token arrived (failover happens before
 * that), so callers can still answer with a JSON error + status when every provider fails.
 */
export async function openStream(req: AiTextRequest, ctx: GatewayContext): Promise<GatewayStream> {
  if (req.tools?.length) throw new GatewayError('bad_request', 'Tools are only supported without streaming (use generateText).', 400)
  const pf = preflight(req)
  const { system, messages } = splitSystem(req)
  const open = await routeStream(pf.plan, { system, messages, temperature: req.temperature }, pf.estInput, ctx.signal)
  async function* chunks(): AsyncGenerator<string, AiMeta> {
    let outChars = open.first.length
    let end: StreamEnd | undefined
    try {
      yield open.first
      for (;;) {
        const r = await open.rest.next()
        if (r.done) { end = r.value; break }
        outChars += r.value.length
        yield r.value
      }
    } finally {
      open.close() // no-op after a normal finish; releases everything when returned early
    }
    const usage = end.usage.inputTokens || end.usage.outputTokens
      ? end.usage
      : { inputTokens: pf.estInput, outputTokens: Math.ceil(outChars / 4) } // provider sent no usage: estimate
    return meta({ ...open, model: end.model || open.model }, usage, pf.started)
  }
  return { provider: open.provider, model: open.model, chunks: chunks(), close: open.close }
}

/** Streaming completion; yields text chunks, returns meta. */
export async function* stream(req: AiTextRequest, ctx: GatewayContext): AsyncGenerator<string, AiMeta> {
  const s = await openStream(req, ctx)
  return yield* s.chunks
}

/* ------------------------------------------------------------------ */
/* structured output                                                     */
/* ------------------------------------------------------------------ */

/** Structured output (JSON), validated against req.jsonSchema with one repair turn. */
export async function completeObject(req: AiObjectWireRequest, ctx: GatewayContext): Promise<AiMeta & { object: unknown }> {
  const schema = cleanSchema(req.jsonSchema)
  try {
    assertSchemaSafe(schema)
  } catch (e) {
    throw new GatewayError('bad_request', e instanceof Error ? e.message : 'Unsupported JSON Schema.', 400)
  }
  // Up to two provider calls per attempt (first + repair), so budget for both.
  const pf = preflight({ ...req, tools: undefined }, { schema, calls: 2 })
  const { system, messages } = splitSystem(req, schemaInstructions(req.schemaName, schema))
  const json = { name: req.schemaName, schema, rootIsObject: rootIsObject(schema) }

  const attempt = async (adapter: ProviderAdapter, call: ProviderCall, key: string) => {
    const first = await completeOnce(adapter, call, key)
    const checked = parseAndCheck(first.text, schema, req.schemaName)
    if (checked.ok) return { object: checked.value, usage: first.usage, model: first.model }

    // One repair turn on the same provider: show the model its own reply and the issues.
    const repair = await completeOnce(adapter, {
      ...call,
      temperature: 0,
      messages: [
        ...call.messages,
        { role: 'assistant', content: first.text.slice(0, 6_000) },
        { role: 'user', content: `That reply failed validation against "${req.schemaName}":\n- ${checked.issues.join('\n- ')}\nReturn the corrected JSON only.` },
      ],
    }, key)
    const usage = { inputTokens: first.usage.inputTokens + repair.usage.inputTokens, outputTokens: first.usage.outputTokens + repair.usage.outputTokens }
    const again = parseAndCheck(repair.text, schema, req.schemaName)
    if (again.ok) return { object: again.value, usage, model: repair.model }
    throw new ProviderError('invalid_output', again.issues.slice(0, 3).join('; '))
  }

  const served = await routeComplete(pf.plan, { system, messages, temperature: req.temperature ?? 0.2, json }, pf.estInput, ctx.signal, attempt, 2)
  return { ...meta(served, served.value.usage, pf.started), object: served.value.object }
}

function parseAndCheck(text: string, schema: Record<string, unknown>, name: string): { ok: true; value: unknown } | { ok: false; issues: string[] } {
  const parsed = extractJson(text)
  if (!parsed.ok) return { ok: false, issues: [parsed.error] }
  return validateAgainst(parsed.value, schema, name)
}

/* ------------------------------------------------------------------ */
/* HTTP helpers for the routes                                          */
/* ------------------------------------------------------------------ */

export function routeHeader(route: AiRouteStep[] | undefined): string {
  return (route ?? []).map((s) => `${s.provider}:${s.outcome === 'ok' ? 'ok' : s.reason ?? s.outcome}`).join('>')
}

/** ratelimit-* + x-ai-* + no-store headers. */
export function aiHeaders(rate: RateState | undefined, m?: Partial<AiMeta>): Record<string, string> {
  const h: Record<string, string> = {
    'cache-control': 'no-store',
    [AI_HEADERS.provider]: m?.provider ?? 'none',
    [AI_HEADERS.model]: m?.model ?? 'none',
  }
  if (rate) {
    h[AI_HEADERS.limit] = String(rate.limit)
    h[AI_HEADERS.remaining] = String(rate.remaining)
    h[AI_HEADERS.reset] = String(rate.resetSec)
  }
  const route = routeHeader(m?.route)
  if (route) h[AI_HEADERS.route] = route
  if (m?.latencyMs !== undefined) h[AI_HEADERS.latency] = String(m.latencyMs)
  if (m?.usage) {
    h[AI_HEADERS.inputTokens] = String(m.usage.inputTokens)
    h[AI_HEADERS.outputTokens] = String(m.usage.outputTokens)
  }
  return h
}

/** JSON error response in the AiErrorBody shape (+ AI headers when a rate state is known). */
export function errorResponse(e: unknown, rate?: RateState): Response {
  const g = e instanceof GatewayError ? e : new GatewayError('upstream', 'Unexpected gateway error', 502)
  if (!(e instanceof GatewayError)) console.error('[ai-gateway]', e)
  const route = (e as { route?: AiRouteStep[] } | null)?.route
  const headers: Record<string, string> = { 'content-type': 'application/json', ...aiHeaders(rate, { route }) }
  if (g.retryAfterSec) headers['retry-after'] = String(g.retryAfterSec)
  return new Response(JSON.stringify({ error: { code: g.code, message: g.message, ...(g.retryAfterSec ? { retryAfterSec: g.retryAfterSec } : {}) } }), {
    status: g.status,
    headers,
  })
}

/** Read and size-check a JSON body (Vercel caps bodies at 4.5 MB anyway). */
export async function readJson(req: Request): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? 0)
  if (len > AI_LIMITS.maxBodyBytes) throw new GatewayError('input_too_large', 'Request body is too large (4.5 MB max). Downscale images first.', 413)
  const raw = await req.text()
  if (raw.length > AI_LIMITS.maxBodyBytes) throw new GatewayError('input_too_large', 'Request body is too large (4.5 MB max).', 413)
  try {
    return JSON.parse(raw)
  } catch {
    throw new GatewayError('bad_request', 'Body must be JSON.', 400)
  }
}
