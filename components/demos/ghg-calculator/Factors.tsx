'use client'
/** Editable emission-factor library. Overrides persist locally and flow into every line. */
import { Button, Table, TableWrap, Td, Th, controlClasses } from '@/components/ui'
import { cx } from '@/lib/utils'
import { ALL_FACTORS, categoryOf, type CalcState } from './model'

export function FactorTable({ overrides, onSet, onReset }: {
  overrides: CalcState['overrides']
  onSet: (id: string, kg: number | undefined) => void
  onReset: () => void
}) {
  const edited = Object.keys(overrides).length
  return (
    <div className="grid gap-3">
      <TableWrap label="Emission factor library">
        <Table className="min-w-[560px]">
          <thead>
            <tr>
              <Th>Activity</Th>
              <Th>Scope</Th>
              <Th>kgCO₂e per unit</Th>
              <Th>Source</Th>
            </tr>
          </thead>
          <tbody>
            {ALL_FACTORS.map((f) => {
              const v = overrides[f.id]
              const changed = v !== undefined && v !== f.kg
              return (
                <tr key={f.id}>
                  <Td>{f.label}</Td>
                  <Td className="mono">{categoryOf(f.category).scope}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        aria-label={`${f.label}, kgCO₂e per ${f.unit}`}
                        defaultValue={v ?? f.kg}
                        key={`${f.id}:${v ?? 'd'}`}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                        onBlur={(e) => {
                          const n = Number(e.target.value)
                          if (e.target.value.trim() === '' || !Number.isFinite(n) || n < 0) { e.target.value = String(v ?? f.kg); return }
                          onSet(f.id, n === f.kg ? undefined : n)
                        }}
                        className={cx(controlClasses, 'w-28 nums', changed && 'border-accent')}
                      />
                      <span className="mono text-ink-3 whitespace-nowrap">/ {f.unit}</span>
                    </div>
                    {changed ? <span className="text-00 text-accent-ink">edited · default {f.kg}</span> : null}
                  </Td>
                  <Td className="text-ink-3 text-00">{f.source}</Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </TableWrap>
      <Button variant="secondary" size="sm" icon="refresh" onClick={onReset} disabled={!edited} className="justify-self-start">
        Restore default factors{edited ? ` (${edited} edited)` : ''}
      </Button>
    </div>
  )
}
