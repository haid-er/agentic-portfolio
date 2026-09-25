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
  const hidden = proves.length - list.length
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
      {hidden > 0 ? (
        <li>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mono inline-flex min-h-tap items-center border border-dashed border-rule rounded-1 px-3 text-ink-2 hover:text-ink"
            aria-label={`Show ${hidden} more skills`}
          >
            +{hidden}
          </button>
        </li>
      ) : null}
    </ChipRow>
  )
}
