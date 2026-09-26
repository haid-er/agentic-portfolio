'use client'
/** Editable reference prices, with where and when they were read. */
import { Button, controlClasses, Table, TableWrap, Td, Th } from '@/components/ui'
import { cx } from '@/lib/utils'
import { MODELS, PRICES_CHECKED, PROVIDERS, type ModelPrice, type PriceOverrides, type ProviderId } from './prices'

type Field = 'input' | 'output' | 'cacheRead'
const FIELDS: Array<{ key: Field; label: string }> = [
  { key: 'input', label: 'Input' },
  { key: 'output', label: 'Output' },
  { key: 'cacheRead', label: 'Cached input' },
]

export function PriceSheet({ models, overrides, onChange }: {
  models: ModelPrice[]
  overrides: PriceOverrides
  onChange: (o: PriceOverrides) => void
}) {
  const set = (id: string, key: Field, raw: string) => {
    const v = Number(raw)
    if (raw === '' || !Number.isFinite(v) || v < 0 || v > 1000) return
    onChange({ ...overrides, [id]: { ...overrides[id], [key]: v } })
  }
  const edited = Object.keys(overrides).length > 0
  return (
    <div className="grid gap-3">
      <p className="m-0 text-0 text-ink-2 measure">
        USD per 1M tokens, standard tier, short-context rates, read from each provider&apos;s public pricing page on {PRICES_CHECKED}.
        Prices move often: edit any cell and every figure on this page updates. Edits stay in this browser.
      </p>
      <TableWrap label="Price sheet">
        <Table className="min-w-[560px]">
          <thead>
            <tr><Th>Model</Th>{FIELDS.map((f) => <Th key={f.key} className="text-right">{f.label}</Th>)}<Th className="text-right">Batch</Th></tr>
          </thead>
          <tbody>
            {models.map((m) => {
              const base = MODELS.find((x) => x.id === m.id)
              return (
                <tr key={m.id}>
                  <Td><span className="font-mono text-0">{m.id}</span><span className="block mono text-ink-3">{PROVIDERS[m.provider].label}</span></Td>
                  {FIELDS.map((f) => {
                    const v = m[f.key]
                    const changed = base && base[f.key] !== v
                    return (
                      <Td key={f.key} className="text-right">
                        {v == null ? (
                          <span className="text-ink-3" title="Not listed">—</span>
                        ) : (
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step="any"
                            defaultValue={v}
                            key={`${m.id}-${f.key}-${v}`}
                            aria-label={`${m.id} ${f.label} price, dollars per million tokens`}
                            onBlur={(e) => set(m.id, f.key, e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') set(m.id, f.key, e.currentTarget.value) }}
                            className={cx(controlClasses, 'w-24 text-right nums font-mono text-0', changed && 'border-accent')}
                          />
                        )}
                      </Td>
                    )
                  })}
                  <Td className="text-right mono text-ink-2">{m.batch == null ? '—' : `×${m.batch}`}</Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </TableWrap>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => (
          <a key={p} href={PROVIDERS[p].url} target="_blank" rel="noopener noreferrer" className="min-h-tap inline-flex items-center mono text-accent-ink underline underline-offset-4">
            {PROVIDERS[p].label} pricing
          </a>
        ))}
        {edited ? <Button size="sm" variant="secondary" icon="refresh" onClick={() => onChange({})}>Reset to reference prices</Button> : null}
      </div>
    </div>
  )
}
