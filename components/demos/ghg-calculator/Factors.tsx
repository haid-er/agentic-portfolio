'use client'
/** Editable emission-factor library. Overrides persist locally and flow into every line. */
import { useId, useState } from 'react'
import { Button, Table, TableWrap, Td, Th, controlClasses } from '@/components/ui'
import { cx } from '@/lib/utils'
import { ALL_FACTORS, MAX_OVERRIDE, categoryOf, type CalcState, type Factor } from './model'

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
                    <FactorInput factor={f} value={v} changed={changed} onSet={onSet} />
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

/** One factor cell: commits on blur/Enter, rejects out-of-range values with a visible message. */
function FactorInput({ factor: f, value: v, changed, onSet }: {
  factor: Factor
  value: number | undefined
  changed: boolean
  onSet: (id: string, kg: number | undefined) => void
}) {
  const [error, setError] = useState('')
  const errId = useId()
  return (
    <>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          max={MAX_OVERRIDE}
          step="any"
          aria-label={`${f.label}, kgCO₂e per ${f.unit}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          defaultValue={v ?? f.kg}
          key={`${f.id}:${v ?? 'd'}`}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          onBlur={(e) => {
            const text = e.target.value.trim()
            const n = Number(text)
            const msg = text === '' || !Number.isFinite(n) ? 'Enter a number'
              : n < 0 ? 'Minimum 0'
              : n > MAX_OVERRIDE ? `Maximum ${MAX_OVERRIDE.toLocaleString('en-GB')}`
              : ''
            setError(msg)
            if (msg) { e.target.value = String(v ?? f.kg); return }
            onSet(f.id, n === f.kg ? undefined : n)
          }}
          className={cx(controlClasses, 'w-28 nums', error ? 'border-danger' : changed && 'border-accent')}
        />
        <span className="mono text-ink-3 whitespace-nowrap">/ {f.unit}</span>
      </div>
      {error ? <span id={errId} role="alert" className="block text-00 text-danger">{error} · kept {v ?? f.kg}</span>
        : changed ? <span className="text-00 text-accent-ink">edited · default {f.kg}</span> : null}
    </>
  )
}
