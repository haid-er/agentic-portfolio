/** Mono kicker / label lines (DESIGN.md 4: mono, uppercase, tracked, >= --fs-00). */
import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/utils'

export interface MonoProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  tone?: 'ink' | 'ink-2' | 'ink-3' | 'accent'
  children?: ReactNode
}

const TONE = { ink: 'text-ink', 'ink-2': 'text-ink-2', 'ink-3': 'text-ink-3', accent: 'text-accent-ink' } as const

export function Mono({ as: Tag = 'span', tone = 'ink-3', className, children, ...rest }: MonoProps) {
  return <Tag className={cx('mono', TONE[tone], className)} {...rest}>{children}</Tag>
}

/** "A / B / C" kicker line; separators in the accent. */
export function Kicker({ parts, className }: { parts: string[]; className?: string }) {
  const items = parts.filter(Boolean)
  if (!items.length) return null
  return (
    <p className={cx('mono text-ink-2 flex flex-wrap gap-x-3 gap-y-1', className)}>
      {items.map((p, i) => (
        <span key={`${p}-${i}`} className="inline-flex gap-3">
          {i > 0 ? <span aria-hidden="true" className="text-accent-ink">/</span> : null}
          {p}
        </span>
      ))}
    </p>
  )
}
