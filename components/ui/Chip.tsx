/**
 * Skill -> proof chip (DESIGN.md 6.3): skill (body 600) joined by a hairline to
 * "→ demo-slug" (mono, --accent-ink) on a --bg-2 block. On hover/focus a 4px
 * ink dot travels along the hairline once.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cx } from '@/lib/utils'
import type { Layer } from './Card'

export interface ProofChipProps {
  skill: string
  /** First proof demo slug; the chip links to /playground/{slug}. */
  slug: string
  /** Number of additional proofs ("+2"). The owner renders the expansion. */
  extra?: number
  layer?: Layer
  className?: string
}

export function ProofChip({ skill, slug, extra = 0, layer = 1, className }: ProofChipProps) {
  return (
    <Link
      href={`/playground/${slug}`}
      aria-label={`${skill}. Proof: ${slug}${extra ? `, plus ${extra} more` : ''}`}
      className={cx(
        'group relative inline-flex items-stretch min-h-tap max-w-full no-underline',
        'border border-rule rounded-1 overflow-hidden bg-surface',
        'strata:shadow-[inset_0_-3px_0_var(--chip-layer)]',
        className,
      )}
      style={{ ['--chip-layer' as string]: `var(--layer-${layer})` }}
    >
      <span className="flex items-center px-3 font-semibold text-0 text-ink">{skill}</span>
      <span aria-hidden="true" className="relative w-4 self-center border-t border-rule">
        <span className="absolute -top-[2.5px] left-0 size-1 rounded-full bg-ink opacity-0 transition-none group-hover:opacity-100 group-hover:translate-x-3 group-hover:transition-transform group-hover:duration-[420ms] group-focus-visible:opacity-100 group-focus-visible:translate-x-3 group-focus-visible:transition-transform group-focus-visible:duration-[420ms]" />
      </span>
      <span className="flex items-center gap-1 px-3 bg-bg-2 font-mono text-00 text-accent-ink transition-colors group-hover:text-ink">
        → {slug}{extra ? <span className="text-ink-3"> +{extra}</span> : null}
      </span>
    </Link>
  )
}

/** Plain mono tag (stack lists, filters). Not a link. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx('mono inline-flex items-center px-2 py-1 border border-rule-soft rounded-pill text-ink-2', className)}>
      {children}
    </span>
  )
}
