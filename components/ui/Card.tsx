/**
 * Card (DESIGN.md 6.7): --surface fill, --r-2.
 * Almanac: 1px rule border; `feature` adds the hard vermilion offset shadow.
 * Strata: no border, soft shadow, 4px top edge in --layer-{n}.
 */
import type { ElementType, HTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/utils'

export type Layer = 1 | 2 | 3 | 4 | 5 | 6

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  feature?: boolean
  /** Strata top-edge colour (1-6). Default 1. */
  layer?: Layer
  /** Inner padding (default true). */
  padded?: boolean
  children?: ReactNode
}

export function Card({ as: Tag = 'div', feature, layer = 1, padded = true, className, style, children, ...rest }: CardProps) {
  return (
    <Tag
      className={cx(
        'relative bg-surface text-ink rounded-2 min-w-0',
        'almanac:border almanac:border-rule',
        feature && 'almanac:shadow-plate',
        'strata:shadow-plate strata:border-t-4 strata:border-t-[var(--card-layer)]',
        padded && 'p-s5',
        className,
      )}
      style={{ ['--card-layer' as string]: `var(--layer-${layer})`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
