'use client'
/**
 * The "Proves" chip row on a gallery card. Each chip filters the gallery to that
 * skill (a skill landing). Rows wrap; more than three skills collapse behind "+N".
 */
import { useState } from 'react'
import { ChipRow, SkillButtonChip } from './SkillChips'

const VISIBLE = 3

export function ProvesRow({ proves, activeId, layer, countFor, onPick }: {
  proves: { id: string; name: string }[]
  activeId: string
  layer: number
  countFor: (id: string) => number
  onPick: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const list = open ? proves : proves.slice(0, VISIBLE)
  const extra = proves.length - VISIBLE
  return (
    <ChipRow label="Proves">
      {list.map((s) => {
        const n = countFor(s.id)
        const active = s.id === activeId
        return (
          <li key={s.id} className="max-w-full">
            <SkillButtonChip
              name={s.name}
              layer={layer}
              active={active}
              onClick={() => onPick(s.id)}
              tail={active ? '× clear' : `→ ${n} ${n === 1 ? 'proof' : 'proofs'}`}
            />
          </li>
        )
      })}
      {extra > 0 ? (
        <li>
          {/* One toggle that stays mounted, so keyboard focus never drops to <body>. */}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mono inline-flex min-h-tap items-center border border-dashed border-rule rounded-1 px-3 text-ink-2 hover:text-ink"
            aria-label={open ? 'Show fewer skills' : `Show ${extra} more skills`}
          >
            {open ? 'Show fewer' : `+${extra}`}
          </button>
        </li>
      ) : null}
    </ChipRow>
  )
}
