/**
 * A small, deterministic AMQP 0-9-1 broker model (RabbitMQ semantics, simplified):
 * producers publish to one exchange (direct / topic / fanout), bindings copy messages into
 * queues, consumers get pushed messages up to their prefetch (basic.qos) and ack or nack them.
 * Nacked-twice, overflowed (x-max-length + drop-head) and rejected messages are dead-lettered.
 *
 * The broker is plain TypeScript with no React: `step(dt)` advances simulated time and
 * `snapshot()` returns render data. Transit legs exist only so the diagram can animate them.
 */
import { seeded } from '@/lib/utils'

export type ExchangeType = 'direct' | 'topic' | 'fanout'
export type NodeId = string
export type LogTone = 'info' | 'ok' | 'warn' | 'danger'
export type DeadReason = 'rejected' | 'maxlen'

export interface Msg {
  id: number
  copy: string
  key: string
  producer: number
  redelivered: boolean
  poison: boolean
  death?: DeadReason
}

export interface ProducerState { id: NodeId; label: string; key: string; on: boolean; ink: number }
export interface QueueState {
  id: NodeId
  name: string
  binding: string
  maxLength: number
  ready: Msg[]
  /** Round-robin pointer over this queue's consumers. */
  rr: number
  deadLettered: number
}
export interface ConsumerState {
  id: NodeId
  label: string
  queueId: NodeId
  prefetch: number
  workMs: number
  failPct: number
  autoAck: boolean
  alive: boolean
  inbound: number
  buffer: Msg[]
  current: { msg: Msg; left: number; total: number } | null
  acked: number
  nacked: number
}

type Arrive =
  | { kind: 'exchange' }
  | { kind: 'queue'; queueId: NodeId; requeue?: boolean }
  | { kind: 'consumer'; consumerId: NodeId }
  | { kind: 'dlq'; reason: DeadReason }

export interface Transit { key: string; msg: Msg; from: NodeId; to: NodeId; t: number; dur: number; arrive: Arrive }
export interface LogLine { id: number; t: number; text: string; tone: LogTone }

export interface Stats {
  published: number
  routed: number
  unroutable: number
  delivered: number
  acked: number
  requeued: number
  deadLettered: number
  dropped: number
  lost: number
}

export interface Snapshot {
  now: number
  exchange: ExchangeType
  rate: number
  dlx: boolean
  producers: ProducerState[]
  queues: QueueState[]
  dlq: QueueState
  consumers: ConsumerState[]
  transits: Transit[]
  stats: Stats
  log: LogLine[]
  ackRate: number
}

export const EXCHANGE = 'sensors'
export const DLX = 'dlx'
export const DLQ_ID = 'dlq'
const DLQ_KEEP = 60
const LOG_KEEP = 80
const LEG_MS = { publish: 420, route: 520, deliver: 360, back: 420, dead: 620 }

/** Default binding keys per exchange type (queues: har.windows, alerts, archive). */
export const PRESET_BINDINGS: Record<ExchangeType, [string, string, string]> = {
  direct: ['sensor.phone.accel', 'sensor.watch.hr', 'sensor.phone.gyro'],
  topic: ['sensor.*.accel', 'sensor.watch.#', '#'],
  fanout: ['', '', ''],
}

const WORD = /^([a-z0-9_-]+|\*|#)$/
const DIRECT_WORD = /^[a-z0-9_-]+$/

/** Returns an error message, or null when the binding key is valid for this exchange type. */
export function validateBinding(type: ExchangeType, key: string): string | null {
  if (type === 'fanout') return null
  if (!key) return 'Binding key is empty: nothing will match.'
  if (key.length > 60) return 'Keep binding keys under 60 characters.'
  const words = key.split('.')
  if (type === 'direct') return words.every((w) => DIRECT_WORD.test(w)) ? null : 'Direct keys are literal words (a-z, 0-9, _ -) joined by dots. No * or #.'
  return words.every((w) => WORD.test(w)) ? null : 'Topic keys are dot-separated words, * (exactly one word) or # (zero or more words).'
}

/** AMQP topic matching: `*` matches one word, `#` matches zero or more words. */
export function topicMatch(pattern: string, key: string): boolean {
  const p = pattern.split('.')
  const k = key.split('.')
  const memo = new Map<string, boolean>()
  const go = (i: number, j: number): boolean => {
    const id = `${i}:${j}`
    const hit = memo.get(id)
    if (hit !== undefined) return hit
    let r: boolean
    if (i === p.length) r = j === k.length
    else if (p[i] === '#') r = go(i + 1, j) || (j < k.length && go(i, j + 1))
    else r = j < k.length && (p[i] === '*' || p[i] === k[j]) && go(i + 1, j + 1)
    memo.set(id, r)
    return r
  }
  return go(0, 0)
}

export function bindingMatches(type: ExchangeType, binding: string, key: string): boolean {
  if (type === 'fanout') return true
  if (validateBinding(type, binding)) return false
  return type === 'direct' ? binding === key : topicMatch(binding, key)
}

export interface ConsumerPatch { prefetch?: number; workMs?: number; failPct?: number; autoAck?: boolean }

export interface Scenario {
  exchange: ExchangeType
  rate: number
  dlx: boolean
  maxLength: number
  producersOn: [boolean, boolean, boolean, boolean]
  consumers: Record<string, ConsumerPatch>
}

export class Broker {
  now = 0
  exchange: ExchangeType = 'topic'
  rate = 1.2
  dlx = true
  animate = true
  producers: ProducerState[] = [
    { id: 'p-phone-accel', label: 'phone · accel', key: 'sensor.phone.accel', on: true, ink: 1 },
    { id: 'p-phone-gyro', label: 'phone · gyro', key: 'sensor.phone.gyro', on: true, ink: 2 },
    { id: 'p-watch-accel', label: 'watch · accel', key: 'sensor.watch.accel', on: true, ink: 3 },
    { id: 'p-watch-hr', label: 'watch · hr', key: 'sensor.watch.hr', on: true, ink: 4 },
  ]
  queues: QueueState[] = [
    { id: 'q-windows', name: 'har.windows', binding: PRESET_BINDINGS.topic[0], maxLength: 25, ready: [], rr: 0, deadLettered: 0 },
    { id: 'q-alerts', name: 'alerts', binding: PRESET_BINDINGS.topic[1], maxLength: 25, ready: [], rr: 0, deadLettered: 0 },
    { id: 'q-archive', name: 'archive', binding: PRESET_BINDINGS.topic[2], maxLength: 25, ready: [], rr: 0, deadLettered: 0 },
  ]
  dlq: QueueState = { id: DLQ_ID, name: 'dead.letters', binding: '#', maxLength: DLQ_KEEP, ready: [], rr: 0, deadLettered: 0 }
  consumers: ConsumerState[] = [
    consumer('c-a', 'worker-a', 'q-windows', 1, 700),
    consumer('c-b', 'worker-b', 'q-windows', 1, 700),
    consumer('c-alerts', 'alerter', 'q-alerts', 2, 450),
    consumer('c-archive', 'archiver', 'q-archive', 4, 300),
  ]
  transits: Transit[] = []
  stats: Stats = { published: 0, routed: 0, unroutable: 0, delivered: 0, acked: 0, requeued: 0, deadLettered: 0, dropped: 0, lost: 0 }
  log: LogLine[] = []

  private seq = 0
  private logSeq = 0
  private acc = [0.1, 0.35, 0.6, 0.85]
  private ackTimes: number[] = []
  private rand = seeded(417)

  /* ------------------------------ commands ------------------------------ */

  setExchange(type: ExchangeType) {
    this.exchange = type
    const keys = PRESET_BINDINGS[type]
    this.queues.forEach((q, i) => { q.binding = keys[i] ?? '' })
    this.note(`exchange.declare ${EXCHANGE} type=${type}; bindings reset to the ${type} preset`, 'info')
  }

  setBinding(queueId: NodeId, key: string) {
    const q = this.queues.find((x) => x.id === queueId)
    if (q) q.binding = key.trim()
  }

  setMaxLength(n: number) { this.queues.forEach((q) => { q.maxLength = n }) }

  toggleProducer(id: NodeId) {
    const p = this.producers.find((x) => x.id === id)
    if (p) p.on = !p.on
  }

  patchConsumer(id: NodeId, patch: ConsumerPatch) {
    const c = this.consumers.find((x) => x.id === id)
    if (c) Object.assign(c, patch)
  }

  /** Publish n messages at once from every producer that is on (or from all if none are). */
  burst(n: number) {
    const on = this.producers.filter((p) => p.on)
    const pool = on.length ? on : this.producers
    for (let i = 0; i < n; i++) this.publish(pool[i % pool.length] as ProducerState, false)
    this.note(`burst: ${n} messages published`, 'info')
  }

  publishPoison() {
    const p = this.producers[0] as ProducerState
    this.publish(p, true)
    this.note(`published a poison message on ${p.key}: every handler will throw on it`, 'warn')
  }

  /** Simulates the consumer process dying: its unacked messages go back to the queue. */
  kill(id: NodeId): number {
    const c = this.consumers.find((x) => x.id === id)
    if (!c || !c.alive) return 0
    c.alive = false
    const held: Msg[] = []
    this.transits = this.transits.filter((tr) => {
      if (tr.arrive.kind === 'consumer' && tr.arrive.consumerId === id) { held.push(tr.msg); return false }
      return true
    })
    if (c.current) held.push(c.current.msg)
    held.push(...c.buffer)
    c.current = null
    c.buffer = []
    c.inbound = 0
    if (c.autoAck) {
      this.stats.lost += held.length
      this.note(`${c.label} died with auto-ack: ${held.length} delivered message(s) lost for good`, 'danger')
    } else {
      held.forEach((m) => {
        m.redelivered = true
        this.stats.requeued++
        this.leg(m, c.id, c.queueId, LEG_MS.back, { kind: 'queue', queueId: c.queueId, requeue: true })
      })
      this.note(`${c.label} connection lost: ${held.length} unacked message(s) requeued with redelivered=true`, held.length ? 'warn' : 'info')
    }
    return held.length
  }

  revive(id: NodeId) {
    const c = this.consumers.find((x) => x.id === id)
    if (!c || c.alive) return
    c.alive = true
    this.note(`${c.label} reconnected: basic.qos(${c.prefetch}); basic.consume(${this.queueName(c.queueId)})`, 'ok')
  }

  purgeDlq() {
    const n = this.dlq.ready.length
    this.dlq.ready = []
    this.note(`queue.purge ${this.dlq.name}: ${n} message(s) removed`, 'info')
  }

  /** Moves every dead letter back through the exchange (a "shovel" replay after a fix). */
  replayDlq() {
    const msgs = this.dlq.ready.splice(0)
    msgs.forEach((m) => {
      const fresh: Msg = { ...m, id: ++this.seq, copy: `${this.seq}`, redelivered: false, poison: false, death: undefined }
      this.stats.published++
      this.leg(fresh, DLQ_ID, 'x', LEG_MS.dead, { kind: 'exchange' })
    })
    this.note(`replayed ${msgs.length} dead letter(s) to ${EXCHANGE} with the poison flag cleared`, 'ok')
  }

  apply(s: Scenario) {
    this.transits = []
    this.queues.forEach((q) => { q.ready = []; q.rr = 0 })
    this.dlq.ready = []
    this.setExchange(s.exchange)
    this.rate = s.rate
    this.dlx = s.dlx
    this.setMaxLength(s.maxLength)
    this.producers.forEach((p, i) => { p.on = s.producersOn[i] ?? true })
    this.consumers.forEach((c) => {
      c.alive = true
      c.buffer = []
      c.current = null
      c.inbound = 0
      Object.assign(c, s.consumers[c.id] ?? {})
    })
  }

  /* ------------------------------ simulation ------------------------------ */

  step(dt: number) {
    this.now += dt
    this.produce(dt)
    this.moveTransits(dt)
    this.work(dt)
    this.dispatch()
    const cutoff = this.now - 5000
    while (this.ackTimes.length && (this.ackTimes[0] as number) < cutoff) this.ackTimes.shift()
  }

  snapshot(): Snapshot {
    return {
      now: this.now,
      exchange: this.exchange,
      rate: this.rate,
      dlx: this.dlx,
      producers: this.producers.map((p) => ({ ...p })),
      queues: this.queues.map((q) => ({ ...q, ready: q.ready.slice(0, 40) })),
      dlq: { ...this.dlq, ready: this.dlq.ready.slice(-12) },
      consumers: this.consumers.map((c) => ({ ...c, buffer: c.buffer.slice(0, 12) })),
      transits: this.transits.slice(),
      stats: { ...this.stats },
      log: this.log.slice(-LOG_KEEP),
      ackRate: Math.min(this.now, 5000) > 0 ? this.ackTimes.length / (Math.min(this.now, 5000) / 1000) : 0,
    }
  }

  unacked(c: ConsumerState) { return c.inbound + c.buffer.length + (c.current ? 1 : 0) }

  queueName(id: NodeId) { return id === DLQ_ID ? this.dlq.name : this.queues.find((q) => q.id === id)?.name ?? id }

  private produce(dt: number) {
    this.producers.forEach((p, i) => {
      if (!p.on) return
      let a = (this.acc[i] ?? 0) + (dt * this.rate) / 1000
      while (a >= 1) { this.publish(p, false); a -= 1 }
      this.acc[i] = a
    })
  }

  private publish(p: ProducerState, poison: boolean) {
    const id = ++this.seq
    const msg: Msg = { id, copy: `${id}`, key: p.key, producer: p.ink, redelivered: false, poison }
    this.stats.published++
    this.leg(msg, p.id, 'x', LEG_MS.publish, { kind: 'exchange' })
  }

  private leg(msg: Msg, from: NodeId, to: NodeId, dur: number, arrive: Arrive) {
    const tr: Transit = { key: `${msg.copy}:${from}>${to}:${this.now.toFixed(0)}`, msg, from, to, t: 0, dur: this.animate ? dur : 0, arrive }
    if (tr.dur === 0) this.land(tr)
    else this.transits.push(tr)
  }

  private moveTransits(dt: number) {
    const landed: Transit[] = []
    this.transits = this.transits.filter((tr) => {
      tr.t += dt / tr.dur
      if (tr.t >= 1) { landed.push(tr); return false }
      return true
    })
    landed.forEach((tr) => this.land(tr))
  }

  private land(tr: Transit) {
    const { msg, arrive } = tr
    if (arrive.kind === 'exchange') return this.route(msg)
    if (arrive.kind === 'dlq') {
      this.dlq.ready.push(msg)
      if (this.dlq.ready.length > DLQ_KEEP) this.dlq.ready.shift()
      return
    }
    if (arrive.kind === 'consumer') {
      const c = this.consumers.find((x) => x.id === arrive.consumerId)
      if (!c) return
      c.inbound = Math.max(0, c.inbound - 1)
      c.buffer.push(msg)
      return
    }
    const q = this.queues.find((x) => x.id === arrive.queueId)
    if (!q) return
    if (arrive.requeue) { q.ready.unshift(msg); return }
    if (q.ready.length >= q.maxLength) {
      const head = q.ready.shift()
      if (head) this.deadLetter(head, q, 'maxlen')
    }
    q.ready.push(msg)
  }

  private route(msg: Msg) {
    const targets = this.queues.filter((q) => bindingMatches(this.exchange, q.binding, msg.key))
    if (!targets.length) {
      this.stats.unroutable++
      this.note(`#${msg.id} ${msg.key}: no binding matched, dropped (no alternate exchange)`, 'warn')
      return
    }
    this.stats.routed += targets.length
    targets.forEach((q) => {
      const copy: Msg = { ...msg, copy: `${msg.id}.${q.id}` }
      this.leg(copy, 'x', q.id, LEG_MS.route, { kind: 'queue', queueId: q.id })
    })
  }

  private dispatch() {
    this.queues.forEach((q) => {
      const group = this.consumers.filter((c) => c.queueId === q.id && c.alive)
      if (!group.length) return
      let guard = 0
      while (q.ready.length && guard < 200) {
        guard++
        let picked: ConsumerState | undefined
        for (let i = 0; i < group.length; i++) {
          const c = group[(q.rr + i) % group.length] as ConsumerState
          if (c.autoAck || this.unacked(c) < c.prefetch) { picked = c; q.rr = (q.rr + i + 1) % group.length; break }
        }
        if (!picked) break
        const msg = q.ready.shift() as Msg
        this.stats.delivered++
        if (picked.autoAck) { this.stats.acked++; this.ackTimes.push(this.now) }
        picked.inbound++
        this.leg(msg, q.id, picked.id, LEG_MS.deliver, { kind: 'consumer', consumerId: picked.id })
      }
    })
  }

  private work(dt: number) {
    this.consumers.forEach((c) => {
      if (!c.alive) return
      let budget = dt
      while (budget > 0) {
        if (!c.current) {
          const next = c.buffer.shift()
          if (!next) break
          const total = Math.max(40, c.workMs * (0.75 + this.rand() * 0.5))
          c.current = { msg: next, left: total, total }
        }
        const cur = c.current
        const used = Math.min(budget, cur.left)
        cur.left -= used
        budget -= used
        if (cur.left > 0) break
        c.current = null
        this.finish(c, cur.msg)
      }
    })
  }

  private finish(c: ConsumerState, msg: Msg) {
    const failed = msg.poison || this.rand() * 100 < c.failPct
    const qName = this.queueName(c.queueId)
    if (c.autoAck) {
      if (failed) {
        this.stats.lost++
        c.nacked++
        this.note(`${c.label}: handler threw on #${msg.id}, but it was auto-acked on delivery. Lost.`, 'danger')
      } else c.acked++
      return
    }
    if (!failed) {
      c.acked++
      this.stats.acked++
      this.ackTimes.push(this.now)
      return
    }
    c.nacked++
    if (!msg.redelivered) {
      msg.redelivered = true
      this.stats.requeued++
      this.note(`${c.label}: basic.nack #${msg.id} requeue=true (first failure) → ${qName}`, 'warn')
      this.leg(msg, c.id, c.queueId, LEG_MS.back, { kind: 'queue', queueId: c.queueId, requeue: true })
      return
    }
    this.note(`${c.label}: basic.nack #${msg.id} requeue=false (already redelivered)`, 'danger')
    const q = this.queues.find((x) => x.id === c.queueId)
    if (q) this.deadLetter(msg, q, 'rejected', c.id)
  }

  private deadLetter(msg: Msg, q: QueueState, reason: DeadReason, from: NodeId = q.id) {
    if (!this.dlx) {
      this.stats.dropped++
      this.note(`#${msg.id} ${reason === 'maxlen' ? 'pushed out of a full' : 'rejected from'} ${q.name}: no dead-letter exchange, discarded`, 'danger')
      return
    }
    q.deadLettered++
    msg.death = reason
    this.stats.deadLettered++
    this.note(`#${msg.id} dead-lettered from ${q.name} (x-death reason: ${reason}) → ${DLX} → ${this.dlq.name}`, reason === 'maxlen' ? 'warn' : 'danger')
    this.leg(msg, from, DLQ_ID, LEG_MS.dead, { kind: 'dlq', reason })
  }

  private note(text: string, tone: LogTone) {
    this.log.push({ id: ++this.logSeq, t: this.now, text, tone })
    if (this.log.length > LOG_KEEP * 2) this.log.splice(0, this.log.length - LOG_KEEP)
  }
}

function consumer(id: string, label: string, queueId: string, prefetch: number, workMs: number): ConsumerState {
  return { id, label, queueId, prefetch, workMs, failPct: 0, autoAck: false, alive: true, inbound: 0, buffer: [], current: null, acked: 0, nacked: 0 }
}

/** Named presets that each teach one broker behaviour. */
export const SCENARIOS: Record<'steady' | 'backpressure' | 'poison' | 'autoack', { label: string; hint: string; config: Scenario }> = {
  steady: {
    label: 'Steady',
    hint: 'Four sensor streams on a topic exchange. Two competing workers share har.windows with prefetch 1, so work is spread fairly.',
    config: {
      exchange: 'topic', rate: 0.8, dlx: true, maxLength: 25, producersOn: [true, true, true, true],
      consumers: { 'c-a': { prefetch: 1, workMs: 600, failPct: 0, autoAck: false }, 'c-b': { prefetch: 1, workMs: 600, failPct: 0, autoAck: false }, 'c-alerts': { prefetch: 2, workMs: 300, failPct: 0, autoAck: false }, 'c-archive': { prefetch: 5, workMs: 150, failPct: 0, autoAck: false } },
    },
  },
  backpressure: {
    label: 'Backpressure',
    hint: 'The windows workers are slow and the queue is capped at 12. Watch it fill, then overflow: the oldest message is dead-lettered (drop-head).',
    config: {
      exchange: 'topic', rate: 1.5, dlx: true, maxLength: 12, producersOn: [true, false, true, false],
      consumers: { 'c-a': { prefetch: 1, workMs: 1800, failPct: 0, autoAck: false }, 'c-b': { prefetch: 1, workMs: 1800, failPct: 0, autoAck: false }, 'c-alerts': { prefetch: 2, workMs: 300, failPct: 0, autoAck: false }, 'c-archive': { prefetch: 5, workMs: 150, failPct: 0, autoAck: false } },
    },
  },
  poison: {
    label: 'Failures',
    hint: 'Handlers fail 25% of the time. A first failure is requeued (redelivered=true); a second one is nacked without requeue and lands in dead.letters.',
    config: {
      exchange: 'topic', rate: 0.8, dlx: true, maxLength: 25, producersOn: [true, true, true, true],
      consumers: { 'c-a': { prefetch: 2, workMs: 600, failPct: 25, autoAck: false }, 'c-b': { prefetch: 2, workMs: 600, failPct: 25, autoAck: false }, 'c-alerts': { prefetch: 2, workMs: 300, failPct: 25, autoAck: false }, 'c-archive': { prefetch: 5, workMs: 150, failPct: 0, autoAck: false } },
    },
  },
  autoack: {
    label: 'Auto-ack',
    hint: 'worker-a uses auto-ack, so prefetch is ignored and the broker floods it. Kill worker-a and compare with worker-b, which acks manually.',
    config: {
      exchange: 'topic', rate: 1, dlx: true, maxLength: 25, producersOn: [true, true, true, true],
      consumers: { 'c-a': { prefetch: 1, workMs: 900, failPct: 10, autoAck: true }, 'c-b': { prefetch: 3, workMs: 900, failPct: 10, autoAck: false }, 'c-alerts': { prefetch: 2, workMs: 300, failPct: 0, autoAck: false }, 'c-archive': { prefetch: 5, workMs: 150, failPct: 0, autoAck: false } },
    },
  },
}
export type ScenarioKey = keyof typeof SCENARIOS
