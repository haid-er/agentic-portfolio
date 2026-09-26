/**
 * Section shell (DESIGN.md 5): numbered folio + display heading + optional note.
 * Every homepage section renders inside this so rhythm, ids (scroll-spy,
 * contents sheet) and headings stay consistent.
 */
import type { ReactNode } from 'react'
import { cx } from '@/lib/utils'

export interface SectionShellProps {
  /** Anchor id (= SectionId). */
  id: string
  /** Two-digit folio, e.g. "02". Empty hides it. */
  folio?: string
  title: string
  note?: string
  /** Right-hand slot in the head (filters, links). */
  aside?: ReactNode
  /** Visually hide the heading (still in the outline). */
  hideTitle?: boolean
  className?: string
  children: ReactNode
}

export function SectionShell({ id, folio, title, note, aside, hideTitle, className, children }: SectionShellProps) {
  const headingId = `${id}-title`
  return (
    <section id={id} aria-labelledby={headingId} className={cx('py-s8 md:py-s9 scroll-mt-20', className)}>
      <div className="wrap">
        <header
          className={cx(
            'mb-s6 grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-end md:gap-6',
            'almanac:border-t-2 almanac:border-rule almanac:pt-s4',
            hideTitle && 'sr-only',
          )}
        >
          {folio ? (
            <span aria-hidden="true" data-folio="" className="display text-4 text-accent-ink almanac:font-light strata:text-accent-2">
              {folio}
            </span>
          ) : null}
          <h2 id={headingId} className="text-[clamp(2.2rem,6vw,4rem)]">{title}</h2>
          {note || aside ? (
            <div className="flex flex-col gap-3 md:items-end">
              {note ? <p className="text-0 text-ink-2 max-w-[36ch] m-0">{note}</p> : null}
              {aside}
            </div>
          ) : null}
        </header>
        {children}
      </div>
    </section>
  )
}
