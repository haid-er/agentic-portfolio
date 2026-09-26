/**
 * Pure, deterministic simulation of a Stripe Connect marketplace.
 * No network, no keys: every "API call" appends synthetic events, and a
 * delivery scheduler plays them to a webhook endpoint with retries.
 *
 * Two ledgers are kept:
 *  - `truth`: every event applied exactly once, in creation order (what Stripe knows)
 *  - `handler`: what our webhook handler applied from the deliveries it received
 * When dedupe is off and Stripe redelivers, the two drift apart. That is the lesson.
 */

export type EventType =
  | 'account.updated'
  | 'product.created'
  | 'price.created'
  | 'customer.created'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted'
  | 'invoice.created'
  | 'invoice.finalized'
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'application_fee.created'
  | 'transfer.created'

export type SubStatus = 'none' | 'active' | 'past_due' | 'canceled'
export type AccountStatus = 'none' | 'pending' | 'enabled'

export interface Split {
  amount: number // cents charged to the fan
  stripeFee: number // processing fee, paid by the platform on destination charges
  appFee: number // platform's application fee
  creatorNet: number // transferred to the connected account
  platformNet: number // appFee - stripeFee
}

export interface StripeEvent {
  id: string
  seq: number // creation order, used to reject stale status updates
  type: EventType
  created: number // sim minutes
  object: string // id of the object the event is about
  summary: string
  account?: AccountStatus
  sub?: SubStatus
  split?: Split
}

export type AttemptResult = 'ok' | 'http_500' | 'timeout'
export type Handled = 'applied' | 'duplicate' | 'stale' | 'reapplied'

export interface Attempt {
  key: string
  eventId: string
  n: number // attempt number for this delivery chain
  at: number
  result: AttemptResult
  handled?: Handled
  redelivery: boolean
}

export interface Delivery {
  key: string
  eventId: string
  n: number
  dueAt: number
  redelivery: boolean
}

export interface Ledger {
  account: AccountStatus
  sub: SubStatus
  /** last applied event seq per object (account, subscription) */
  versions: Record<string, number>
  gross: number
  creator: number
  platform: number
  stripeFees: number
  invoicesPaid: number
}

export interface ApiCall {
  id: string
  at: number
  method: 'POST' | 'DELETE'
  path: string
  idemKey?: string
  status: number
  note: string
  replay?: boolean
}

export interface Config {
  priceCents: number
  feePercent: number // application_fee_percent
  failRate: number // 0..1 chance a delivery attempt fails
  duplicates: boolean // Stripe sometimes delivers an event more than once
  dedupe: boolean // handler keeps processed event ids
  declineRenewal: boolean // next renewal charge declines once
}

export interface SimState {
  now: number
  seq: number
  rng: number
  events: StripeEvent[]
  queue: Delivery[]
  attempts: Attempt[]
  dead: string[] // delivery keys that exhausted retries
  processed: string[]
  handler: Ledger
  api: ApiCall[]
  idem: Record<string, string> // idempotency key -> original api call id
  accountId?: string
  priceId?: string
  subId?: string
  subCount: number
  subKey?: string // Idempotency-Key used by the first subscribe call
  pendingRetry: boolean // an invoice is waiting for a Smart Retry
  canceled: boolean
  period: number
}

/** Compressed retry schedule (minutes after each failed attempt). Stripe's real one spans up to 3 days. */
export const RETRY_DELAYS = [1, 5, 30, 120, 360, 720, 1440]
export const MAX_ATTEMPTS = RETRY_DELAYS.length + 1

/** Illustrative card pricing, editable in the UI copy: 2.9% + 30c. */
export const CARD_PCT = 0.029
export const CARD_FIXED = 30

export const EMPTY_LEDGER: Ledger = {
  account: 'none', sub: 'none', versions: {}, gross: 0, creator: 0, platform: 0, stripeFees: 0, invoicesPaid: 0,
}

export function initialState(seed = 417): SimState {
  return {
    now: 0, seq: 0, rng: seed >>> 0, events: [], queue: [], attempts: [], dead: [], processed: [],
    handler: { ...EMPTY_LEDGER }, api: [], idem: {}, subCount: 0, pendingRetry: false, canceled: false, period: 0,
  }
}

export function split(priceCents: number, feePercent: number): Split {
  const stripeFee = Math.round(priceCents * CARD_PCT) + CARD_FIXED
  const appFee = Math.round((priceCents * feePercent) / 100)
  return { amount: priceCents, stripeFee, appFee, creatorNet: priceCents - appFee, platformNet: appFee - stripeFee }
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** mulberry32 step, pure: returns [0..1) and the next state. */
function rand(s: SimState): number {
  let a = (s.rng + 0x6d2b79f5) >>> 0
  s.rng = a
  let t = a
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  a = ((t ^ (t >>> 14)) >>> 0)
  return a / 4294967296
}

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
function newId(s: SimState, prefix: string): string {
  let out = ''
  for (let i = 0; i < 10; i++) out += ALPHA[Math.floor(rand(s) * ALPHA.length)]
  return `${prefix}_${out}`
}

function clone(s: SimState): SimState {
  return {
    ...s,
    events: [...s.events], queue: [...s.queue], attempts: [...s.attempts], dead: [...s.dead],
    processed: [...s.processed], handler: { ...s.handler }, api: [...s.api], idem: { ...s.idem },
  }
}

function emit(s: SimState, type: EventType, object: string, summary: string, extra: Partial<StripeEvent> = {}) {
  s.seq += 1
  const ev: StripeEvent = { id: newId(s, 'evt'), seq: s.seq, type, created: s.now, object, summary, ...extra }
  s.events.push(ev)
  // small network jitter, so arrivals are not always in creation order
  const jitter = Math.floor(rand(s) * 2)
  s.queue.push({ key: `${ev.id}#0`, eventId: ev.id, n: 1, dueAt: s.now + jitter, redelivery: false })
  return ev
}

function call(s: SimState, method: ApiCall['method'], path: string, note: string, idemKey?: string, status = 200): ApiCall {
  const c: ApiCall = { id: newId(s, 'req'), at: s.now, method, path, note, idemKey, status }
  s.api.push(c)
  return c
}

/* ------------------------------------------------------------------ */
/* event reducer, shared by both ledgers                               */
/* ------------------------------------------------------------------ */

export function applyEvent(l: Ledger, ev: StripeEvent): { ledger: Ledger; stale: boolean } {
  const next = { ...l }
  if (ev.account || ev.sub) {
    // status updates: never let an older event overwrite a newer one for the same object
    const seen = l.versions[ev.object] ?? -1
    if (ev.seq < seen) return { ledger: l, stale: true }
    next.versions = { ...l.versions, [ev.object]: ev.seq }
    if (ev.account) next.account = ev.account
    if (ev.sub) next.sub = ev.sub
  }
  if (ev.type === 'invoice.paid' && ev.split) {
    next.gross += ev.split.amount
    next.creator += ev.split.creatorNet
    next.platform += ev.split.platformNet
    next.stripeFees += ev.split.stripeFee
    next.invoicesPaid += 1
  }
  return { ledger: next, stale: false }
}

export function truthLedger(events: StripeEvent[]): Ledger {
  return events.reduce((l, ev) => applyEvent(l, ev).ledger, { ...EMPTY_LEDGER })
}

/* ------------------------------------------------------------------ */
/* API actions (each returns a new state)                               */
/* ------------------------------------------------------------------ */

export function onboardCreator(prev: SimState): SimState {
  const s = clone(prev)
  const acct = newId(s, 'acct')
  s.accountId = acct
  call(s, 'POST', '/v1/accounts', `type=express → ${acct}`)
  call(s, 'POST', '/v1/account_links', 'type=account_onboarding → hosted onboarding URL')
  emit(s, 'account.updated', acct, 'requirements.currently_due: identity, bank account', { account: 'pending' })
  s.now += 6 // the creator fills in the hosted form
  emit(s, 'account.updated', acct, 'charges_enabled: true, payouts_enabled: true', { account: 'enabled' })
  return s
}

export function createPrice(prev: SimState, cfg: Config): SimState {
  const s = clone(prev)
  const prod = newId(s, 'prod')
  const price = newId(s, 'price')
  s.priceId = price
  call(s, 'POST', '/v1/products', `creator membership → ${prod}`)
  call(s, 'POST', '/v1/prices', `${money(cfg.priceCents)} / month recurring → ${price}`)
  emit(s, 'product.created', prod, 'Creator membership')
  emit(s, 'price.created', price, `${money(cfg.priceCents)} per month`)
  return s
}

function chargeInvoice(s: SimState, cfg: Config, sub: string, declined: boolean, reason: string) {
  const inv = newId(s, 'in')
  const sp = split(cfg.priceCents, cfg.feePercent)
  emit(s, 'invoice.created', inv, reason)
  emit(s, 'invoice.finalized', inv, `amount_due ${money(sp.amount)}`)
  if (declined) {
    emit(s, 'payment_intent.payment_failed', newId(s, 'pi'), 'card_declined: insufficient_funds')
    emit(s, 'invoice.payment_failed', inv, 'Smart Retries scheduled')
    emit(s, 'customer.subscription.updated', sub, 'status: past_due', { sub: 'past_due' })
    s.pendingRetry = true
    return
  }
  emit(s, 'payment_intent.succeeded', newId(s, 'pi'), `${money(sp.amount)} captured on the platform`)
  emit(s, 'application_fee.created', newId(s, 'fee'), `${cfg.feePercent}% fee = ${money(sp.appFee)}`)
  emit(s, 'transfer.created', newId(s, 'tr'), `${money(sp.creatorNet)} → ${s.accountId ?? 'creator'}`)
  emit(s, 'invoice.paid', inv, `${money(sp.amount)} paid`, { split: sp })
}

/**
 * Create the subscription. `mode`:
 *  - 'first'    : a normal request with an Idempotency-Key
 *  - 'replay'   : the client timed out and retries with the SAME key → cached response
 *  - 'no-key'   : the client retries without a key → Stripe creates a second subscription
 */
export function subscribe(prev: SimState, cfg: Config, mode: 'first' | 'replay' | 'no-key'): SimState {
  const s = clone(prev)
  const key = s.subKey ?? newId(s, 'idem')
  if (mode === 'replay' && s.idem[key]) {
    call(s, 'POST', '/v1/subscriptions', `Idempotent replay: same response as ${s.idem[key]}, nothing charged twice`, key)
    const last = s.api[s.api.length - 1]
    if (last) last.replay = true
    return s
  }
  const cus = newId(s, 'cus')
  const sub = newId(s, 'sub')
  if (mode === 'first') {
    call(s, 'POST', '/v1/customers', `fan → ${cus}`)
    emit(s, 'customer.created', cus, 'Fan with a test card')
  }
  const c = call(
    s, 'POST', '/v1/subscriptions',
    `${sub}, application_fee_percent=${cfg.feePercent}, transfer_data.destination=${s.accountId ?? 'acct'}`,
    mode === 'first' ? key : undefined,
  )
  if (mode === 'first') { s.idem[key] = c.id; s.subKey = key }
  s.subId = sub
  s.subCount += 1
  emit(s, 'customer.subscription.created', sub, 'status: active', { sub: 'active' })
  chargeInvoice(s, cfg, sub, false, mode === 'no-key' ? 'DUPLICATE subscription invoice' : 'First period')
  return s
}

/** Test clock: jump one month (or 3 days to the Smart Retry when an invoice is past due). */
export function advanceClock(prev: SimState, cfg: Config): SimState {
  const s = clone(prev)
  if (!s.subId || s.canceled) return s
  if (s.pendingRetry) {
    s.now += 3 * 1440
    call(s, 'POST', '/v1/test_helpers/test_clocks/advance', '+3 days → Smart Retry')
    s.pendingRetry = false
    chargeInvoice(s, cfg, s.subId, false, 'Smart Retry of the failed renewal')
    emit(s, 'customer.subscription.updated', s.subId, 'status: active', { sub: 'active' })
    return s
  }
  s.now += 30 * 1440
  s.period += 1
  call(s, 'POST', '/v1/test_helpers/test_clocks/advance', '+1 month → renewal')
  chargeInvoice(s, cfg, s.subId, cfg.declineRenewal, `Renewal, period ${s.period + 1}`)
  return s
}

export function cancel(prev: SimState): SimState {
  const s = clone(prev)
  if (!s.subId) return s
  call(s, 'DELETE', `/v1/subscriptions/${s.subId}`, 'cancel immediately')
  emit(s, 'customer.subscription.deleted', s.subId, 'status: canceled', { sub: 'canceled' })
  s.pendingRetry = false
  s.canceled = true
  return s
}

/** Manually resend a dead delivery (Dashboard "Resend"). */
export function resend(prev: SimState, key: string): SimState {
  const s = clone(prev)
  const a = s.attempts.find((x) => x.key === key)
  if (!a) return s
  s.dead = s.dead.filter((k) => k !== key)
  s.queue.push({ key: `${a.eventId}#r${s.seq++}`, eventId: a.eventId, n: 1, dueAt: s.now, redelivery: true })
  return s
}

/* ------------------------------------------------------------------ */
/* delivery scheduler                                                  */
/* ------------------------------------------------------------------ */

export function nextDue(s: SimState): Delivery | undefined {
  let best: Delivery | undefined
  for (const d of s.queue) if (!best || d.dueAt < best.dueAt) best = d
  return best
}

/** Deliver the next due webhook: roll for failure, retry with backoff, or hand it to the handler. */
export function deliverNext(prev: SimState, cfg: Config): SimState {
  const d = nextDue(prev)
  if (!d) return prev
  const s = clone(prev)
  s.queue = s.queue.filter((q) => q !== d)
  s.now = Math.max(s.now, d.dueAt)
  const ev = s.events.find((e) => e.id === d.eventId)
  if (!ev) return s

  const roll = rand(s)
  const result: AttemptResult = roll < cfg.failRate ? (roll < cfg.failRate / 3 ? 'timeout' : 'http_500') : 'ok'
  const attempt: Attempt = { key: d.key, eventId: d.eventId, n: d.n, at: s.now, result, redelivery: d.redelivery }

  if (result !== 'ok') {
    const delay = RETRY_DELAYS[d.n - 1]
    if (delay === undefined) s.dead.push(d.key)
    else s.queue.push({ ...d, n: d.n + 1, dueAt: s.now + delay })
    s.attempts.push(attempt)
    return s
  }

  // 2xx: the handler runs
  if (cfg.dedupe && s.processed.includes(ev.id)) {
    attempt.handled = 'duplicate'
  } else {
    const again = s.processed.includes(ev.id)
    const { ledger, stale } = applyEvent(s.handler, ev)
    s.handler = ledger
    attempt.handled = stale ? 'stale' : again ? 'reapplied' : 'applied'
    if (!s.processed.includes(ev.id)) s.processed.push(ev.id)
  }
  s.attempts.push(attempt)

  // at-least-once delivery: sometimes the same event arrives again
  if (cfg.duplicates && !d.redelivery && rand(s) < 0.45) {
    s.queue.push({ key: `${ev.id}#dup${s.seq++}`, eventId: ev.id, n: 1, dueAt: s.now + 1 + Math.floor(rand(s) * 3), redelivery: true })
  }
  return s
}

/* ------------------------------------------------------------------ */
/* formatting                                                          */
/* ------------------------------------------------------------------ */

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export const money = (cents: number) => fmt.format(cents / 100)

/** Sim minutes → "D2 14:05" (day number since the clock started at 09:00). */
export function simTime(min: number): string {
  const t = min + 9 * 60 // the clock starts at 09:00 on day 1
  const d = Math.floor(t / 1440)
  const h = Math.floor((t % 1440) / 60)
  const m = t % 60
  return `D${d + 1} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
