'use client'
/** Cost comparison table across models, and the savings waterfall for one model. */
import { Badge, Table, TableWrap, Td, Th } from '@/components/ui'
import { cx } from '@/lib/utils'
import { DAYS_PER_MONTH, formatUsd, requestCost, type Workload } from './cost'
import { PROVIDERS, type ModelPrice } from './prices'

export const MIN_CACHE_PREFIX = 1024

export function CostTable({ models, workload, selected, onSelect }: {
  models: ModelPrice[]
  workload: Workload
  selected: string
  onSelect: (id: string) => void
}) {
  const month = workload.requestsPerDay * DAYS_PER_MONTH
  const rows = models
    .map((m) => ({ m, c: requestCost(m, workload) }))
    .sort((a, b) => a.c.optimised - b.c.optimised)
  const max = Math.max(...rows.map((r) => r.c.baseline), 0) || 1
  const cheapest = rows[0]?.m.id
  return (
    <TableWrap label="Estimated cost per model">
      <Table className="min-w-[640px]">
        <thead>
          <tr>
            <Th>Model</Th>
            <Th className="text-right">Per request</Th>
            <Th className="text-right">Month · list</Th>
            <Th className="text-right">Month · optimised</Th>
            <Th className="w-[28%]">Optimised vs list</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, c }) => {
            const on = m.id === selected
            const saved = c.baseline ? 1 - c.optimised / c.baseline : 0
            return (
              <tr key={m.id} className={cx(on && 'bg-bg-2')}>
                <Td>
                  <button type="button" onClick={() => onSelect(m.id)} aria-pressed={on} className="grid min-h-tap text-left">
                    <span className={cx('font-mono text-0 underline underline-offset-4', on ? 'decoration-accent' : 'decoration-rule-soft')}>{m.id}</span>
                    <span className="flex flex-wrap items-center gap-1 mono text-ink-3">
                      {PROVIDERS[m.provider].label} · {m.tier}
                      {m.id === cheapest ? <Badge tone="ok">cheapest</Badge> : null}
                    </span>
                  </button>
                </Td>
                <Td className="text-right whitespace-nowrap">{formatUsd(c.optimised)}</Td>
                <Td className="text-right whitespace-nowrap text-ink-2">{formatUsd(c.baseline * month)}</Td>
                <Td className="text-right whitespace-nowrap font-semibold">{formatUsd(c.optimised * month)}</Td>
                <Td>
                  <span className="relative block h-3 bg-rule-soft rounded-0" aria-hidden="true">
                    <span className="absolute inset-y-0 left-0 bg-ink-3 opacity-40 rounded-0" style={{ width: `${(c.baseline / max) * 100}%` }} />
                    <span className="absolute inset-y-0 left-0 bg-data-1 rounded-0" style={{ width: `${(c.optimised / max) * 100}%` }} />
                  </span>
                  <span className="mono text-ink-3 nums">−{Math.round(saved * 100)}%</span>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </TableWrap>
  )
}

export function Savings({ model, workload }: { model: ModelPrice; workload: Workload }) {
  const c = requestCost(model, workload)
  const month = workload.requestsPerDay * DAYS_PER_MONTH
  const base = c.baseline || 1
  const bars = [
    { label: 'List price', value: c.baseline, ink: 'var(--ink-3)', sign: '' },
    { label: 'Prompt caching', value: c.cacheSaving, ink: 'var(--data-2)', sign: '−', offset: c.withCache },
    { label: 'Batch tier', value: c.batchSaving, ink: 'var(--data-3)', sign: '−', offset: c.optimised },
    { label: 'You pay', value: c.optimised, ink: 'var(--data-1)', sign: '' },
  ]
  const shortPrefix = workload.prefixTokens > 0 && workload.prefixTokens < MIN_CACHE_PREFIX && workload.cacheHitRate > 0
  return (
    <div className="grid gap-3">
      <p className="m-0 flex flex-wrap items-baseline gap-2">
        <span className="display text-4 nums">{formatUsd(c.optimised * month)}</span>
        <span className="mono text-ink-3">per month on {model.id}</span>
      </p>
      <ol className="grid gap-2 m-0 p-0 list-none" aria-label="Savings waterfall, per month">
        {bars.map((b) => (
          <li key={b.label} className="grid gap-1">
            <span className="flex justify-between gap-2 mono text-ink-2">
              <span>{b.label}</span>
              <span className="nums text-ink">{b.sign}{formatUsd(b.value * month)}</span>
            </span>
            <span className="relative block h-3 bg-rule-soft rounded-0" aria-hidden="true">
              <span
                className="absolute inset-y-0 rounded-0"
                style={{ left: `${((b.offset ?? 0) / base) * 100}%`, width: `${Math.max(0, (b.value / base) * 100)}%`, background: b.ink }}
              />
            </span>
          </li>
        ))}
      </ol>
      <ul className="grid gap-1 m-0 pl-4 text-00 text-ink-2">
        {model.cacheRead == null ? <li>No cached-input price is listed for this model, so caching saves nothing here.</li> : null}
        {model.cacheWrite != null ? <li>Cache writes cost {formatUsd(model.cacheWrite)} per 1M tokens, above the input price, so a low hit rate can cost more than no cache.</li> : null}
        {model.batch == null ? <li>No batch tier is listed for this provider.</li> : null}
        {shortPrefix ? <li className="text-warn">The static prefix is under ~{MIN_CACHE_PREFIX.toLocaleString('en-US')} tokens. Many providers only cache longer prefixes, so this saving may not happen.</li> : null}
        {model.note ? <li>{model.note}</li> : null}
      </ul>
    </div>
  )
}
