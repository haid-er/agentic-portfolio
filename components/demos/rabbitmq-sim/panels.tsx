'use client'
/** Side panels, tables and read-outs for the RabbitMQ sim. All state comes from the broker snapshot. */
import { useState } from 'react'
import {
  Badge, Button, DemoPanel, EmptyState, Input, Segmented, Table, TableWrap, Td, Th, Toggle, Tr, useToast,
} from '@/components/ui'
import { cx } from '@/lib/utils'
import {
  bindingMatches, DLX, EXCHANGE, validateBinding,
  type ConsumerPatch, type ConsumerState, type ConsumerView, type ExchangeType, type LogTone, type QueueState, type Snapshot,
} from './engine'
import { inkFill } from './Diagram'
import { Range } from './Range'

const EXCHANGE_OPTIONS = [
  { value: 'direct', label: 'Direct' },
  { value: 'topic', label: 'Topic' },
  { value: 'fanout', label: 'Fanout' },
] as const

const EXCHANGE_HINT: Record<ExchangeType, string> = {
  direct: 'A message goes to every queue whose binding key equals its routing key exactly.',
  topic: 'Binding keys are patterns: * matches exactly one word, # matches zero or more words.',
  fanout: 'Routing keys are ignored: every bound queue gets a copy of every message.',
}

export function BindingsPanel({ snap, onExchange, onBinding, onRate, onDlx, onMaxLength, onToggleProducer }: {
  snap: Snapshot
  onExchange: (t: ExchangeType) => void
  onBinding: (queueId: string, key: string) => void
  onRate: (r: number) => void
  onDlx: (v: boolean) => void
  onMaxLength: (n: number) => void
  onToggleProducer: (id: string) => void
}) {
  const maxLength = snap.queues[0]?.maxLength ?? 25
  return (
    <DemoPanel title="Exchange & bindings" meta={`${EXCHANGE} · ${snap.exchange}`}>
      <div className="grid gap-4">
        <Segmented label="Exchange type" options={EXCHANGE_OPTIONS} value={snap.exchange} onChange={onExchange} />
        <p className="m-0 text-0 text-ink-2">{EXCHANGE_HINT[snap.exchange]}</p>

        {snap.queues.map((q) => {
          const error = validateBinding(snap.exchange, q.binding)
          const hits = snap.producers.filter((p) => bindingMatches(snap.exchange, q.binding, p.key))
          return (
            <div key={q.id} className="grid gap-1">
              <Input
                label={`Binding · ${q.name}`}
                value={snap.exchange === 'fanout' ? '' : q.binding}
                placeholder={snap.exchange === 'fanout' ? 'ignored by fanout' : 'e.g. sensor.*.accel'}
                disabled={snap.exchange === 'fanout'}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                maxLength={60}
                error={error ?? undefined}
                onChange={(e) => onBinding(q.id, e.target.value.toLowerCase())}
                className="font-mono text-0"
              />
              <p className="m-0 text-00 font-mono text-ink-3" aria-live="polite">
                {hits.length ? `matches ${hits.map((p) => p.key).join(', ')}` : 'matches no producer'}
              </p>
            </div>
          )
        })}

        <fieldset className="m-0 p-0 border-0 grid gap-2">
          <legend className="mono text-ink-2 mb-1">Producers (routing keys)</legend>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
            {snap.producers.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.on}
                onClick={() => onToggleProducer(p.id)}
                className={cx(
                  'min-h-tap flex items-center gap-2 px-3 border rounded-1 text-left font-mono text-00',
                  p.on ? 'border-rule bg-surface text-ink' : 'border-rule bg-bg-2 text-ink-3',
                )}
              >
                <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4.5" className={inkFill(p.ink)} /></svg>
                <span className="min-w-0 [overflow-wrap:anywhere]">{p.key}</span>
                <span className="ml-auto">{p.on ? 'on' : 'off'}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <Range label="Publish rate (per producer)" value={snap.rate} min={0.2} max={5} step={0.1} format={(v) => `${v.toFixed(1)} msg/s`} onChange={onRate} />
        <Range
          label="x-max-length (each queue)"
          value={maxLength}
          min={5}
          max={50}
          format={(v) => `${v} msgs`}
          onChange={onMaxLength}
          hint="On overflow the oldest ready message is dropped from the head (x-overflow: drop-head) and dead-lettered."
        />
        <Toggle label={`Dead-letter exchange (${DLX})`} checked={snap.dlx} onChange={onDlx} />
      </div>
    </DemoPanel>
  )
}

export function ConsumerPanel({ snap, selected, onSelect, onPatch, onKill, onRevive }: {
  snap: Snapshot
  selected: ConsumerView
  onSelect: (id: string) => void
  onPatch: (p: ConsumerPatch) => void
  onKill: () => void
  onRevive: () => void
}) {
  const c = selected
  const qName = snap.queues.find((q) => q.id === c.queueId)?.name ?? ''
  const unacked = c.unacked
  return (
    <DemoPanel title="Consumer" meta={`${c.label} ← ${qName}`}>
      <div className="grid gap-4">
        <Segmented label="Select consumer" options={snap.consumers.map((x) => ({ value: x.id, label: x.label }))} value={c.id} onChange={onSelect} />
        <div className="flex flex-wrap gap-2">
          <Badge tone={c.alive ? (c.current ? 'accent' : 'neutral') : 'danger'}>{c.alive ? (c.current ? 'busy' : 'idle') : 'down'}</Badge>
          <Badge>{unacked} unacked</Badge>
          <Badge tone="ok">{c.acked} acked</Badge>
          {c.nacked ? <Badge tone="warn">{c.nacked} failed</Badge> : null}
        </div>
        <Range
          label="Prefetch (basic.qos)"
          value={c.prefetch}
          min={1}
          max={10}
          onChange={(v) => onPatch({ prefetch: v })}
          hint={c.autoAck ? 'Ignored while auto-ack is on: the broker pushes without limit.' : 'Most unacked messages the broker will push to this consumer at once.'}
        />
        <Range label="Work per message" value={c.workMs} min={100} max={3000} step={50} format={(v) => `${v} ms`} onChange={(v) => onPatch({ workMs: v })} />
        <Range label="Handler failure rate" value={c.failPct} min={0} max={60} step={5} format={(v) => `${v}%`} onChange={(v) => onPatch({ failPct: v })} />
        <Toggle label="Auto-ack (acknowledge on delivery)" checked={c.autoAck} onChange={(v) => onPatch({ autoAck: v })} />
        <div className="flex flex-wrap gap-2">
          {c.alive
            ? <Button variant="danger" icon="close" onClick={onKill}>Kill {c.label}</Button>
            : <Button variant="primary" icon="refresh" onClick={onRevive}>Reconnect {c.label}</Button>}
        </div>
      </div>
    </DemoPanel>
  )
}

export function StatsRow({ snap }: { snap: Snapshot }) {
  const s = snap.stats
  const cells: Array<{ label: string; value: string; tone?: 'warn' | 'danger' | 'ok' }> = [
    { label: 'Published', value: String(s.published) },
    { label: 'Routed copies', value: String(s.routed) },
    { label: 'Acked', value: String(s.acked), tone: 'ok' },
    { label: 'Acks / s (5 s)', value: snap.ackRate.toFixed(1) },
    { label: 'Requeued', value: String(s.requeued), tone: s.requeued ? 'warn' : undefined },
    { label: 'Dead-lettered', value: String(s.deadLettered), tone: s.deadLettered ? 'danger' : undefined },
    { label: 'Unroutable', value: String(s.unroutable), tone: s.unroutable ? 'warn' : undefined },
    { label: 'Lost or discarded', value: String(s.lost + s.dropped), tone: s.lost + s.dropped ? 'danger' : undefined },
  ]
  return (
    <dl className="m-0 grid grid-cols-2 xs:grid-cols-4 gap-px bg-rule-soft border border-rule rounded-2 overflow-hidden strata:border-rule-soft">
      {cells.map((c) => (
        <div key={c.label} className="bg-surface px-3 py-2 min-w-0">
          <dt className="mono text-ink-3">{c.label}</dt>
          <dd className={cx('m-0 display text-3 nums', c.tone === 'danger' && 'text-danger', c.tone === 'warn' && 'text-warn', c.tone === 'ok' && 'text-accent')}>{c.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function QueueTable({ snap }: { snap: Snapshot }) {
  return (
    <DemoPanel title="Queues">
      <TableWrap label="Queue depths">
        <Table>
          <thead>
            <Tr><Th>Queue</Th><Th>Binding</Th><Th className="text-right">Ready</Th><Th className="text-right">Unacked</Th><Th className="text-right">Dead-lettered</Th></Tr>
          </thead>
          <tbody>
            {snap.queues.map((q) => {
              const group = snap.consumers.filter((c) => c.queueId === q.id)
              const unacked = group.reduce((n, c) => n + c.unacked, 0)
              return (
                <Tr key={q.id}>
                  <Td className="font-mono whitespace-nowrap">{q.name}</Td>
                  <Td className="font-mono text-ink-2 whitespace-nowrap">{snap.exchange === 'fanout' ? '(fanout)' : q.binding || '(empty)'}</Td>
                  <Td className="text-right">{q.depth}/{q.maxLength}</Td>
                  <Td className="text-right">{unacked}</Td>
                  <Td className="text-right">{q.deadLettered}</Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </TableWrap>
    </DemoPanel>
  )
}

export function DlqPanel({ snap, onPurge, onReplay }: { snap: Snapshot; onPurge: () => void; onReplay: () => void }) {
  const items = snap.dlq.ready.slice().reverse()
  return (
    <DemoPanel
      title={`Dead letters · ${snap.dlq.name}`}
      meta={snap.dlq.depth > items.length ? `${snap.dlq.depth} held · newest ${items.length} shown` : `${snap.dlq.depth} held`}
      actions={items.length ? (
        <>
          <Button size="sm" variant="secondary" icon="refresh" onClick={onReplay}>Replay</Button>
          <Button size="sm" variant="ghost" icon="close" onClick={onPurge}>Purge</Button>
        </>
      ) : null}
    >
      {items.length ? (
        <ul className="m-0 p-0 list-none grid gap-1">
          {items.map((m) => (
            <li key={m.copy} className="flex flex-wrap items-center gap-2 py-1 border-b border-rule-soft font-mono text-00">
              <span className="text-ink nums">#{m.id}</span>
              <span className="text-ink-2 [overflow-wrap:anywhere]">{m.key}</span>
              <Badge tone={m.death === 'maxlen' ? 'warn' : 'danger'} className="ml-auto">{m.death === 'maxlen' ? 'maxlen' : 'rejected'}</Badge>
              {m.poison ? <Badge tone="danger">poison</Badge> : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={snap.dlx ? 'No dead letters yet' : 'Dead-lettering is off'}>
          {snap.dlx
            ? 'Try the Failures or Backpressure scenario, or publish a poison message.'
            : 'Failed and overflowed messages are being discarded. Turn the dead-letter exchange back on to keep them.'}
        </EmptyState>
      )}
    </DemoPanel>
  )
}

export function JavaPanel({ consumer: c, queue: q, snap }: { consumer: ConsumerState; queue: QueueState; snap: Snapshot }) {
  const toast = useToast()
  const bindArgs = snap.exchange === 'fanout' ? '""' : `"${q.binding}"`
  const code = [
    `// ${c.label}: equivalent RabbitMQ Java client setup (illustrative)`,
    `channel.exchangeDeclare("${EXCHANGE}", BuiltinExchangeType.${snap.exchange.toUpperCase()}, true);`,
    `channel.queueDeclare("${q.name}", true, false, false, Map.of(`,
    `    "x-max-length", ${q.maxLength},`,
    `    "x-overflow", "drop-head"${snap.dlx ? ',' : ''}`,
    ...(snap.dlx ? [`    "x-dead-letter-exchange", "${DLX}"`] : []),
    `));`,
    `channel.queueBind("${q.name}", "${EXCHANGE}", ${bindArgs});`,
    ...(c.autoAck ? ['// auto-ack: basicQos has no effect, the broker pushes freely'] : [`channel.basicQos(${c.prefetch}); // at most ${c.prefetch} unacked`]),
    '',
    'DeliverCallback onMessage = (tag, delivery) -> {',
    '  long deliveryTag = delivery.getEnvelope().getDeliveryTag();',
    ...(c.autoAck
      ? ['  handle(delivery.getBody()); // already acked: a crash here loses it']
      : [
          '  try {',
          '    handle(delivery.getBody());',
          '    channel.basicAck(deliveryTag, false);',
          '  } catch (Exception e) {',
          '    boolean requeue = !delivery.getEnvelope().isRedeliver();',
          '    channel.basicNack(deliveryTag, false, requeue); // 2nd failure -> DLX',
          '  }',
        ]),
    '};',
    `channel.basicConsume("${q.name}", ${c.autoAck}, onMessage, consumerTag -> {});`,
  ].join('\n')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast('Java snippet copied')
    } catch {
      toast('Copy failed: select the code and copy it by hand', { tone: 'warn' })
    }
  }
  return (
    <DemoPanel title="Java consumer" meta={c.label} actions={<Button size="sm" variant="ghost" icon="copy" onClick={copy}>Copy</Button>}>
      <pre className="m-0 p-3 bg-bg-2 border border-rule-soft rounded-1 text-00 leading-[1.6] overflow-x-auto max-w-full" tabIndex={0} aria-label="Java consumer code">
        <code>{code}</code>
      </pre>
    </DemoPanel>
  )
}

const TONE_CLASS: Record<LogTone, string> = { info: 'text-ink-2', ok: 'text-accent-ink', warn: 'text-warn', danger: 'text-danger' }
const TONE_MARK: Record<LogTone, string> = { info: '·', ok: '+', warn: '!', danger: '×' }
type LogFilter = 'all' | 'problems'

export function LogPanel({ snap }: { snap: Snapshot }) {
  const [filter, setFilter] = useState<LogFilter>('all')
  const lines = snap.log
    .filter((l) => filter === 'all' || l.tone === 'warn' || l.tone === 'danger')
    .slice(-40)
    .reverse()
  return (
    <DemoPanel title="Broker log" meta="newest first">
      <Segmented
        label="Show"
        options={[{ value: 'all', label: 'All' }, { value: 'problems', label: 'Problems' }] as const}
        value={filter}
        onChange={setFilter}
      />
      {lines.length ? (
        <ol className="m-0 mt-3 p-0 list-none max-h-72 overflow-y-auto font-mono text-00 grid gap-1" tabIndex={0} aria-label="Broker log lines">
          {lines.map((l) => (
            <li key={l.id} className="grid grid-cols-[4.5ch_1.5ch_1fr] gap-2">
              <span className="text-ink-3 nums">{(l.t / 1000).toFixed(1)}</span>
              <span aria-hidden="true" className={TONE_CLASS[l.tone]}>{TONE_MARK[l.tone]}</span>
              <span className={cx('[overflow-wrap:anywhere] normal-case', TONE_CLASS[l.tone])}>{l.text}</span>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="Nothing logged yet" className="mt-3">Routine publishes and acks are counted above; the log records routing changes, failures and crashes.</EmptyState>
      )}
    </DemoPanel>
  )
}
