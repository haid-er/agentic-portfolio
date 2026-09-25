/** Loading / empty / error states shared by sections and demos. */
import type { ReactNode } from 'react'
import { cx } from '@/lib/utils'
import { Icon } from './Icon'

/** Register-mark spinner. Respects reduced motion via globals.css. */
export function Loading({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cx('flex items-center gap-3 text-ink-2', className)}>
      <Icon name="register" size={22} className="text-accent-2 motion-safe:animate-[spin-reg_2.4s_linear_infinite]" />
      <span className="mono">{label}…</span>
    </div>
  )
}

/** Flat-line glyph empty state (DESIGN.md 7). */
export function EmptyState({ title, children, action, className }: { title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-start gap-2 p-s5 border border-dashed border-rule rounded-1 bg-surface', className)}>
      <Icon name="flat" size={28} className="text-ink-3" />
      <p className="m-0 font-semibold">{title}</p>
      {children ? <div className="text-0 text-ink-2">{children}</div> : null}
      {action}
    </div>
  )
}

/** Honest failure state: says what failed and that nothing is estimated. */
export function ErrorState({ title = 'Something failed', children, action, className }: { title?: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cx('flex flex-col items-start gap-2 p-s5 border border-danger rounded-1 bg-surface', className)}>
      <p className="m-0 flex items-center gap-2 font-semibold text-danger">
        <Icon name="alert" size={18} />
        {title}
      </p>
      {children ? <div className="text-0 text-ink-2">{children}</div> : null}
      {action}
    </div>
  )
}
