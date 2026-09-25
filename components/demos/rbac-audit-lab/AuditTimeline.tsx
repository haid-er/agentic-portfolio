'use client'
/**
 * The audit log as a timeline, newest transaction first. Rows rolled back with their transaction
 * are struck through; rows written outside it (denials, rollbacks) stay. Committed transactions
 * can be reverted by a compensating transaction: the log is append-only, nothing is deleted.
 */
import { useState } from 'react'
import { Badge, Button, EmptyState, Segmented } from '@/components/ui'
import { useReducedMotion } from '@/lib/hooks'
import { cx } from '@/lib/utils'
import { userById, type Attr } from './model'
import type { AuditEvent, TxRecord } from './tx'

type Filter = 'all' | 'committed' | 'security'

const OUTCOME: Record<TxRecord['outcome'], { tone: 'ok' | 'warn' | 'danger'; text: string }> = {
  committed: { tone: 'ok', text: 'committed' },
  'rolled-back': { tone: 'warn', text: 'rolled back' },
  denied: { tone: 'danger', text: 'denied' },
}

const show = (v: Attr | undefined) => (v === undefined ? '∅' : String(v))

function Diff({ e }: { e: AuditEvent }) {
  if (!e.after) return null
  return (
    <span className="flex flex-wrap gap-x-3 font-mono text-00">
      {Object.keys(e.after).map((k) => (
        <span key={k} className="[overflow-wrap:anywhere]">
          {k}: <span className="text-ink-3">{show(e.before?.[k])}</span> → <span className="text-ink">{show(e.after?.[k])}</span>
        </span>
      ))}
    </span>
  )
}

function EventRow({ e, delay }: { e: AuditEvent; delay: number }) {
  const discarded = e.state === 'discarded'
  const dot = e.kind === 'access.denied' ? 'bg-danger' : e.kind === 'tx.rollback' ? 'bg-warn' : e.kind === 'tx.commit' ? 'bg-ok' : discarded ? 'bg-rule-soft' : 'bg-accent'
  return (
    <li
      className="relative grid gap-[2px] pl-6 pb-3 min-w-0 motion-safe:animate-[fade-in_var(--dur-med)_var(--ease-out)_both]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span aria-hidden="true" className="absolute left-[5px] top-0 bottom-0 w-px bg-rule-soft" />
      <span aria-hidden="true" className={cx('absolute left-0 top-[5px] size-[11px] rounded-pill border border-rule', dot)} />
      <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-00 text-ink-3 nums">#{e.seq}</span>
        <span className={cx('font-mono text-00 uppercase tracking-[.06em]', discarded ? 'text-ink-3 line-through' : 'text-ink')}>{e.kind}</span>
        {discarded ? <span className="text-00 text-ink-3">discarded by rollback</span> : null}
        {e.state === 'independent' ? <span className="text-00 text-ink-3">written outside the transaction</span> : null}
      </span>
      <span className={cx('text-0 [overflow-wrap:anywhere]', discarded ? 'text-ink-3 line-through' : 'text-ink-2')}>
        {e.note}{e.resourceId ? <span className="font-mono text-00 text-ink-3"> · {e.action} {e.resourceId}</span> : null}
      </span>
      {!discarded ? <Diff e={e} /> : null}
    </li>
  )
}

export function AuditTimeline({ txs, onRevert, newestId }: { txs: TxRecord[]; onRevert: (tx: TxRecord) => void; newestId: string | null }) {
  const [filter, setFilter] = useState<Filter>('all')
  const reduced = useReducedMotion()
  const shown = txs.filter((t) => filter === 'all' || (filter === 'committed' ? t.outcome === 'committed' : t.outcome === 'denied'))

  return (
    <div className="grid gap-3 min-w-0">
      <Segmented<Filter> label="Show" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'committed', label: 'Committed' }, { value: 'security', label: 'Denials' }]} />
      {shown.length === 0 ? (
        <EmptyState title={txs.length ? 'Nothing matches this filter' : 'The audit log is empty'}>
          Run a transaction. Try approving the North report as the reviewer, then inject a failure before step 3 and run it again.
        </EmptyState>
      ) : (
        <ol className="m-0 p-0 list-none grid gap-3" aria-label="Audit log by transaction">
          {shown.map((t) => {
            const o = OUTCOME[t.outcome]
            const fresh = t.id === newestId && !reduced
            return (
              <li key={t.id} className="grid gap-2 p-3 border border-rule-soft rounded-1 bg-surface min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-00 text-ink-3">{t.id}</span>
                  <Badge tone={o.tone}>{o.text}</Badge>
                  {t.revertOf ? <Badge tone="neutral">reverts {t.revertOf}</Badge> : null}
                  {t.revertedBy ? <Badge tone="neutral">reverted by {t.revertedBy}</Badge> : null}
                  <span className="text-0 flex-1 min-w-[10rem]">{t.label}</span>
                  {t.outcome === 'committed' && !t.revertedBy && !t.revertOf ? (
                    <Button size="sm" variant="secondary" icon="refresh" onClick={() => onRevert(t)}>Revert</Button>
                  ) : null}
                </div>
                <p className="m-0 font-mono text-00 text-ink-3">by {userById(t.actorId).label} · {new Date(t.events[0]?.at ?? Date.now()).toLocaleTimeString()}</p>
                <ol className="m-0 p-0 list-none" aria-label={`${t.id} events`}>
                  {t.events.map((e, i) => <EventRow key={e.seq} e={e} delay={fresh ? i * 160 : 0} />)}
                </ol>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
