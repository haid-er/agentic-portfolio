/**
 * Provider router: groq -> gemini -> deepseek with per-attempt timeouts and failover.
 *
 * - A provider is a candidate when admin enabled it, its key is set, it is not cooling
 *   down after a recent failure, it has a vision model when images are sent, and (for
 *   DeepSeek) the request fits the remaining per-instance token budget.
 * - Non-streaming calls fail over on any provider error. Streams fail over only until the
 *   first visible token; after that an error ends the stream (the client keeps the text).
 * - Every hop is recorded in `route` so demos can show how a request was served.
 */
import 'server-only'
import type { ProviderId } from '@/lib/content'
import type { AiMessage, AiRouteStep, AiTextRequest, AiUsage } from '../types'
import { aiConfig, clampMaxTokens, modelList, providerSettings, ROUTER_ORDER, TIMEOUTS } from './config'
import { GatewayError, ProviderError } from './errors'
import { coolingFor, deepseekCanAfford, deepseekCharge, deepseekReserve, healthKey, markFailure, markSuccess } from './health'
import { gemini } from './providers/gemini'
import { deepseek, groq } from './providers/openai'
import type { ProviderAdapter, ProviderCall, ProviderResult, StreamEnd } from './providers/types'
import { ThinkFilter } from './think'

const ADAPTERS: Record<ProviderId, ProviderAdapter> = { groq, gemini, deepseek }

export interface Candidate {
  id: ProviderId
  model: string
  key: string
  maxTokens: number
}

export interface Plan {
  candidates: Candidate[]
  skipped: AiRouteStep[]
  /** Smallest cooldown among skipped providers (for Retry-After). */
  retryAfterSec?: number
}

/** Decide which providers may serve this request, in router order. */
/** `calls` = provider calls one attempt may make (2 for structured output: first + repair). */
export function planRoute(req: Pick<AiTextRequest, 'vision' | 'maxTokens'>, estInputTokens: number, calls = 1): Plan {
  const cfg = aiConfig()
  const candidates: Candidate[] = []
  const skipped: AiRouteStep[] = []
  let retryAfterSec: number | undefined
  for (const id of ROUTER_ORDER) {
    const p = providerSettings(id)
    if (!p.enabled) continue
    const skip = (reason: string, model?: string) => skipped.push({ provider: id, outcome: 'skipped', reason: model ? `${reason} (${model})` : reason, ms: 0 })
    if (!p.key) { skip('no-key'); continue }
    const models = modelList(req.vision ? p.visionModel : p.model)
    if (!models.length) { skip('no-vision'); continue }
    const maxTokens = clampMaxTokens(req.maxTokens, id)
    if (id === 'deepseek' && !deepseekCanAfford(cfg.deepseekBudgetTokens, estInputTokens * calls, maxTokens * calls)) { skip('budget'); continue }
    for (const model of models) {
      const cooling = coolingFor(healthKey(id, model))
      if (cooling) {
        skip('cooling', models.length > 1 ? model : undefined)
        retryAfterSec = Math.min(retryAfterSec ?? cooling, cooling)
        continue
      }
      candidates.push({ id, model, key: p.key, maxTokens })
    }
  }
  return { candidates, skipped, retryAfterSec }
}

/** Merge request.system + system-role messages; keep user/assistant turns. */
export function splitSystem(req: Pick<AiTextRequest, 'system' | 'messages'>, extra?: string) {
  const sys: string[] = []
  if (req.system) sys.push(req.system)
  const messages: AiMessage[] = []
  for (const m of req.messages) {
    if (m.role === 'system') sys.push(typeof m.content === 'string' ? m.content : m.content.map((p) => (p.type === 'text' ? p.text : '')).join('\n'))
    else messages.push(m)
  }
  if (extra) sys.push(extra)
  return { system: sys.join('\n\n'), messages }
}

/* ------------------------------------------------------------------ */
/* attempts                                                             */
/* ------------------------------------------------------------------ */

type CallShape = Omit<ProviderCall, 'model' | 'maxTokens' | 'signal'>

interface Attempt {
  signal: AbortSignal
  /** Abort this attempt with a timeout reason. */
  expire: (why: string) => void
  done: () => void
}

function startAttempt(clientSignal: AbortSignal | undefined, deadline: number, ms: number): Attempt {
  const ac = new AbortController()
  const budget = Math.max(1_000, Math.min(ms, deadline - Date.now()))
  const expire = (why: string) => ac.abort(new ProviderError('timeout', why))
  const timer = setTimeout(() => expire(`Timed out after ${Math.round(budget / 1000)}s`), budget)
  const signal = clientSignal ? AbortSignal.any([ac.signal, clientSignal]) : ac.signal
  return { signal, expire, done: () => clearTimeout(timer) }
}

function throwIfClientAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new GatewayError('aborted', 'Request aborted by the client', 499)
}

function failureStep(c: Candidate, e: unknown, t0: number): { step: AiRouteStep; err: ProviderError } {
  const err = e instanceof ProviderError ? e : new ProviderError('network', e instanceof Error ? e.message : 'Unknown error')
  markFailure(healthKey(c.id, c.model), err.opts.cooldownSec ?? (err.reason === 'timeout' ? 15 : undefined))
  if (process.env.NODE_ENV !== 'test') console.warn(`[ai-gateway] ${c.id}/${c.model} ${err.reason}: ${err.message.slice(0, 160)}`)
  return { step: { provider: c.id, outcome: 'failed', reason: err.reason, ms: Date.now() - t0 }, err }
}

/** Turn "everything failed" into one honest client-facing error. */
export function exhausted(plan: Plan, failures: ProviderError[]): GatewayError {
  if (!plan.candidates.length && !failures.length) {
    if (plan.retryAfterSec) {
      return new GatewayError('quota_exhausted', 'Demo quota reached: every AI provider is cooling down.', 503, plan.retryAfterSec)
    }
    const why = plan.skipped.some((s) => s.reason === 'budget') ? 'the paid fallback budget is spent' : 'no provider is configured'
    return new GatewayError('unavailable', `AI is unavailable right now (${why}).`, 503)
  }
  const last = failures[failures.length - 1]
  if (last?.reason === 'invalid_output') {
    return new GatewayError('invalid_output', 'The model did not return valid structured output.', 502)
  }
  if (failures.length && failures.every((f) => f.reason === 'auth' || f.reason === 'model')) {
    return new GatewayError('unavailable', 'AI is unavailable right now (provider keys or model ids need attention in admin).', 503)
  }
  if (failures.length && failures.every((f) => f.reason === 'rejected')) {
    return new GatewayError('upstream', `Providers rejected the request: ${failures[0].message}`, 502)
  }
  const retry = Math.min(...failures.map((f) => f.opts.cooldownSec ?? 30), plan.retryAfterSec ?? 300)
  return new GatewayError('quota_exhausted', 'Demo quota reached: the free AI providers are busy. Try again shortly.', 503, retry)
}

export interface Served<T> {
  provider: ProviderId
  model: string
  route: AiRouteStep[]
  value: T
}

interface Budget {
  /** The worst case this attempt reserved (input + full output cap, per call). */
  reserved: AiUsage
  /** Release the reservation and charge what was really used (idempotent). */
  settle: (used: AiUsage) => void
}

const NO_USAGE: AiUsage = { inputTokens: 0, outputTokens: 0 }

/** Failures that happen before the provider generates (so nothing was billed). */
const UNBILLED = new Set(['rate_limited', 'auth', 'model', 'rejected'])

/**
 * Reserve DeepSeek budget for the attempt, re-checking affordability right before the
 * call (earlier attempts can take ~40s, and parallel requests share the budget).
 * Returns null when DeepSeek can no longer afford it, so the caller skips it.
 */
function withBudget(c: Candidate, estInput: number, calls = 1): Budget | null {
  const reserved = { inputTokens: estInput * calls, outputTokens: c.maxTokens * calls }
  if (c.id !== 'deepseek') return { reserved, settle: () => {} }
  if (!deepseekCanAfford(aiConfig().deepseekBudgetTokens, reserved.inputTokens, reserved.outputTokens)) return null
  const release = deepseekReserve(reserved.inputTokens + reserved.outputTokens)
  let settled = false
  return {
    reserved,
    settle: (used) => {
      if (settled) return
      settled = true
      release()
      deepseekCharge(used)
    },
  }
}

/** What a failed attempt probably cost: nothing if refused up front, else the reservation. */
function failedUsage(e: unknown, b: Budget): AiUsage {
  return e instanceof ProviderError && UNBILLED.has(e.reason) ? NO_USAGE : b.reserved
}

const budgetSkip = (c: Candidate): AiRouteStep => ({ provider: c.id, outcome: 'skipped', reason: 'budget', ms: 0 })

/**
 * Run `fn` against each candidate until one succeeds (non-streaming).
 * `fn` gets a ready ProviderCall and the adapter, so structured output can add a repair turn.
 */
export async function routeComplete<T extends { usage: AiUsage }>(
  plan: Plan,
  shape: CallShape,
  estInput: number,
  clientSignal: AbortSignal | undefined,
  fn: (adapter: ProviderAdapter, call: ProviderCall, key: string) => Promise<T & { model?: string }>,
  calls = 1,
): Promise<Served<T>> {
  const route: AiRouteStep[] = [...plan.skipped]
  const failures: ProviderError[] = []
  const deadline = Date.now() + TIMEOUTS.overall
  for (const c of plan.candidates) {
    throwIfClientAborted(clientSignal)
    if (Date.now() > deadline - 1_000) break
    const budget = withBudget(c, estInput, calls)
    if (!budget) { route.push(budgetSkip(c)); continue }
    const t0 = Date.now()
    const attempt = startAttempt(clientSignal, deadline, TIMEOUTS.complete)
    try {
      const value = await fn(ADAPTERS[c.id], { ...shape, model: c.model, maxTokens: c.maxTokens, signal: attempt.signal }, c.key)
      budget.settle(value.usage)
      markSuccess(healthKey(c.id, c.model))
      route.push({ provider: c.id, outcome: 'ok', ms: Date.now() - t0 })
      return { provider: c.id, model: value.model ?? c.model, route, value }
    } catch (e) {
      budget.settle(failedUsage(e, budget))
      throwIfClientAborted(clientSignal)
      if (e instanceof GatewayError) throw e
      const { step, err } = failureStep(c, e, t0)
      route.push(step)
      failures.push(err)
    } finally {
      attempt.done()
    }
  }
  throw Object.assign(exhausted(plan, failures), { route })
}

export async function completeOnce(adapter: ProviderAdapter, call: ProviderCall, key: string): Promise<ProviderResult> {
  const r = await adapter.complete(call, key)
  const text = ThinkFilter.strip(r.text)
  if (!text && !r.toolCalls?.length) throw new ProviderError('empty', 'Only reasoning, no answer (token cap too small?)')
  return { ...r, text }
}

/* ------------------------------------------------------------------ */
/* streaming                                                            */
/* ------------------------------------------------------------------ */

export interface OpenStream {
  provider: ProviderId
  model: string
  route: AiRouteStep[]
  /** Visible text already received (the first chunk). */
  first: string
  /** The rest of the visible text; returns usage when the provider finishes. */
  rest: AsyncGenerator<string, StreamEnd>
  /**
   * Release the attempt early (visitor left). Safe to call any time and more than once;
   * closes the upstream stream and charges an estimate of what was already generated.
   */
  close: () => void
}

/**
 * Open a stream on the first provider that produces a visible token.
 * Resolves only once text is flowing, so failures before that fail over transparently
 * and the HTTP response can still carry a proper status and provider headers.
 */
export async function routeStream(plan: Plan, shape: CallShape, estInput: number, clientSignal?: AbortSignal): Promise<OpenStream> {
  const route: AiRouteStep[] = [...plan.skipped]
  const failures: ProviderError[] = []
  const deadline = Date.now() + TIMEOUTS.overall
  for (const c of plan.candidates) {
    throwIfClientAborted(clientSignal)
    if (Date.now() > deadline - 1_000) break
    const budget = withBudget(c, estInput)
    if (!budget) { route.push(budgetSkip(c)); continue }
    const t0 = Date.now()
    const attempt = startAttempt(clientSignal, deadline, TIMEOUTS.overall)
    const firstTimer = setTimeout(() => attempt.expire(`No first token after ${TIMEOUTS.firstToken / 1000}s`), TIMEOUTS.firstToken)
    const filter = new ThinkFilter()
    const gen = ADAPTERS[c.id].stream({ ...shape, model: c.model, maxTokens: c.maxTokens, signal: attempt.signal }, c.key, TIMEOUTS.idle)
    try {
      let first = ''
      let end: StreamEnd | undefined
      while (!first) {
        const r = await gen.next()
        if (r.done) { end = r.value; break }
        first = filter.push(r.value)
      }
      clearTimeout(firstTimer)
      if (!first) {
        first = filter.flush()
        if (!first) throw new ProviderError('empty', 'Stream ended without text')
      }
      markSuccess(healthKey(c.id, c.model))
      route.push({ provider: c.id, outcome: 'ok', ms: Date.now() - t0 })
      const s = new StreamSession(gen, filter, end, attempt, budget, estInput, first.length)
      return { provider: c.id, model: c.model, route, first, rest: s.tail(), close: () => s.close() }
    } catch (e) {
      clearTimeout(firstTimer)
      attempt.done()
      budget.settle(failedUsage(e, budget))
      gen.return({ usage: NO_USAGE, model: c.model }).catch(() => {})
      throwIfClientAborted(clientSignal)
      if (e instanceof GatewayError) throw e
      const { step, err } = failureStep(c, e, t0)
      route.push(step)
      failures.push(err)
    }
  }
  throw Object.assign(exhausted(plan, failures), { route })
}

/**
 * Owns an open stream after its first token: relays the rest and makes sure the attempt
 * timer, the upstream generator and the DeepSeek reservation are released exactly once,
 * whether the stream finishes, errors, or is abandoned (even before `tail()` starts).
 */
class StreamSession {
  private closed = false
  private outChars: number

  constructor(
    private readonly gen: AsyncGenerator<string, StreamEnd>,
    private readonly filter: ThinkFilter,
    private end: StreamEnd | undefined,
    private readonly attempt: Attempt,
    private readonly budget: Budget,
    private readonly estInput: number,
    firstChars: number,
  ) {
    this.outChars = firstChars
  }

  async *tail(): AsyncGenerator<string, StreamEnd> {
    try {
      while (!this.end) {
        if (this.closed) throw new ProviderError('network', 'Stream closed')
        const r = await this.gen.next()
        if (r.done) { this.end = r.value; break }
        this.outChars += r.value.length
        const t = this.filter.push(r.value)
        if (t) yield t
      }
      const rest = this.filter.flush()
      if (rest) yield rest
      return this.end
    } finally {
      this.close()
    }
  }

  close() {
    if (this.closed) return
    this.closed = true
    if (!this.end) this.attempt.expire('Stream closed early') // aborts the upstream fetch
    this.attempt.done()
    const u = this.end?.usage
    // Ended early or no usage reported: the provider billed what it generated, so estimate.
    this.budget.settle(u && (u.inputTokens || u.outputTokens) ? u : { inputTokens: this.estInput, outputTokens: Math.ceil(this.outChars / 4) })
    if (!this.end) this.gen.return({ usage: NO_USAGE, model: '' }).catch(() => {})
  }
}
