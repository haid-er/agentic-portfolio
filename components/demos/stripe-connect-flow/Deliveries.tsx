/** Webhook event sequence: every event Stripe created, with each delivery attempt and what the handler did. */
import { useState } from 'react'
import { Badge, Button, EmptyState, ErrorState, type Tone } from '@/components/ui'
import { cx } from '@/lib/utils'
import { MAX_ATTEMPTS, simTime, type Attempt, type Delivery, type Handled, type SimState } from './engine'

const RESULT: Record<Attempt['result'], { label: string; tone: Tone }> = {
  ok: { label: '200', tone: 'ok' },
  http_500: { label: '500', tone: 'danger' },
  timeout: { label: 'timeout', tone: 'danger' },
}

const HANDLED: Record<Handled, { label: string; tone: Tone }> = {
  applied: { label: 'applied', tone: 'ok' },
  duplicate: { label: 'duplicate skipped', tone: 'accent' },
  stale: { label: 'stale skipped', tone: 'warn' },
  reapplied: { label: 'applied twice', tone: 'danger' },
}

const LIMIT = 14

export function Deliveries({ state, onResend }: { state: SimState; onResend: (key: string) => void }) {
  const [all, setAll] = useState(false)
  if (state.events.length === 0) {
    return (
      <EmptyState title="No events yet">
        Onboard a creator. Each API call below creates events, and Stripe delivers them to your webhook endpoint.
      </EmptyState>
    )
  }

  const byEvent = new Map<string, Attempt[]>()
  for (const a of state.attempts) byEvent.set(a.eventId, [...(byEvent.get(a.eventId) ?? []), a])
  const pending = new Map<string, Delivery>()
  for (const d of state.queue) if (!pending.has(d.eventId) || (pending.get(d.eventId)?.dueAt ?? 0) > d.dueAt) pending.set(d.eventId, d)
  const deadKeys = new Set(state.dead)

  const events = [...state.events].reverse()
  const shown = all ? events : events.slice(0, LIMIT)
  const dead = state.attempts.filter((a) => deadKeys.has(a.key) && a.n === MAX_ATTEMPTS)

  return (
    <div className="grid gap-3">
      {dead.length > 0 ? (
        <ErrorState title={`${dead.length} ${dead.length === 1 ? 'delivery' : 'deliveries'} gave up after ${MAX_ATTEMPTS} attempts`}>
          <p className="m-0 mb-2">Stripe stops retrying and the event is only in the Dashboard. Resend it once your endpoint is healthy.</p>
          <ul className="m-0 p-0 list-none grid gap-2">
            {dead.map((a) => {
              const ev = state.events.find((e) => e.id === a.eventId)
              return (
                <li key={a.key} className="flex flex-wrap items-center gap-2">
                  <code className="mono normal-case tracking-normal text-ink">{ev?.type}</code>
                  <Button size="sm" variant="secondary" icon="refresh" onClick={() => onResend(a.key)}>Resend</Button>
                </li>
              )
            })}
          </ul>
        </ErrorState>
      ) : null}

      <ol className="m-0 p-0 list-none grid" aria-label="Webhook events, newest first">
        {shown.map((ev) => {
          const tries = byEvent.get(ev.id) ?? []
          const next = pending.get(ev.id)
          return (
            <li key={ev.id} className="grid gap-1 py-2 border-b border-rule-soft last:border-b-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <code className="font-mono text-0 text-ink break-all">{ev.type}</code>
                <span className="mono text-ink-3 nums">{simTime(ev.created)}</span>
              </div>
              <p className="m-0 text-00 text-ink-2 break-words">
                <span className="font-mono text-ink-3">{ev.id.slice(0, 12)}…</span> {ev.summary}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                {tries.map((a, i) => (
                  <span key={`${a.key}-${a.n}-${i}`} className="inline-flex items-center gap-1">
                    <Badge tone={RESULT[a.result].tone} className={cx(a.redelivery && 'border-dashed')}>
                      <span className="sr-only">Attempt </span>
                      {a.redelivery ? 'again ' : `#${a.n} `}
                      {RESULT[a.result].label}
                    </Badge>
                    {a.handled ? <Badge tone={HANDLED[a.handled].tone}>{HANDLED[a.handled].label}</Badge> : null}
                  </span>
                ))}
                {next ? (
                  <Badge tone="warn">
                    {next.n > 1 ? `retry #${next.n} at ${simTime(next.dueAt)}` : next.redelivery ? 'redelivery queued' : 'queued'}
                  </Badge>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
      {events.length > LIMIT ? (
        <Button size="sm" variant="ghost" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Show recent only' : `Show all ${events.length} events`}
        </Button>
      ) : null}
    </div>
  )
}
