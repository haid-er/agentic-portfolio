/**
 * "Proves" chip rows (DESIGN.md 6.3 wood-type slugs, adapted): skill on the left,
 * the landing on the right. Links go to the skill landing (/playground?skill=id),
 * so a visitor can see every demo that proves the same skill.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Tag } from '@/components/ui'
import { cx } from '@/lib/utils'

export const skillHref = (id: string) => `/playground?skill=${encodeURIComponent(id)}`

const chipClasses = cx(
  'group/chip inline-flex max-w-full items-stretch min-h-tap no-underline text-left',
  'border border-rule rounded-1 overflow-hidden bg-surface',
  'strata:shadow-[inset_0_-3px_0_var(--chip-layer)]',
)

/** The chip body, shared by link and button chips. */
export function ChipBody({ name, tail, active }: { name: string; tail: string; active?: boolean }) {
  return (
    <>
      <span className={cx('flex items-center px-3 text-0 font-semibold', active ? 'bg-ink text-bg' : 'text-ink')}>{name}</span>
      <span aria-hidden="true" className="relative w-3 self-center border-t border-rule">
        <span className="absolute -top-[2.5px] left-0 size-1 rounded-full bg-ink opacity-0 group-hover/chip:opacity-100 group-focus-visible/chip:opacity-100 motion-safe:group-hover/chip:translate-x-2 motion-safe:group-focus-visible/chip:translate-x-2 motion-safe:transition-transform motion-safe:duration-[420ms]" />
      </span>
      <span className="flex items-center bg-bg-2 px-2 font-mono text-00 text-accent-ink transition-colors group-hover/chip:text-ink">
        {tail}
      </span>
    </>
  )
}

export function SkillLinkChip({ id, name, layer = 1, tail = '→ all proofs' }: { id: string; name: string; layer?: number; tail?: string }) {
  return (
    <Link
      href={skillHref(id)}
      className={chipClasses}
      style={{ ['--chip-layer' as string]: `var(--layer-${layer})` }}
      aria-label={`${name}: see every demo that proves it`}
    >
      <ChipBody name={name} tail={tail} />
    </Link>
  )
}

export function SkillButtonChip({ name, active, onClick, layer = 1, tail }: {
  name: string
  active: boolean
  onClick: () => void
  layer?: number
  tail: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={chipClasses}
      style={{ ['--chip-layer' as string]: `var(--layer-${layer})` }}
    >
      <ChipBody name={name} tail={tail} active={active} />
    </button>
  )
}

/** Labelled chip row that wraps (never overflows at 360px). */
export function ChipRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-s2', className)}>
      <p className="mono m-0 text-ink-3">{label}</p>
      <ul className="m-0 flex list-none flex-wrap gap-x-s3 gap-y-s2 p-0">{children}</ul>
    </div>
  )
}

/** Free-text registry skills as plain tags. */
export function SkillTags({ skills }: { skills: string[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-s2 p-0">
      {skills.map((s) => <li key={s}><Tag>{s}</Tag></li>)}
    </ul>
  )
}
