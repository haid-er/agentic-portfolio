/**
 * Demo layout helpers so all 36 demos feel like one publication.
 *  <DemoPanel title="Queue" meta="3 consumers" actions={<Button…/>}>…</DemoPanel>
 *  <DemoGrid> splits stage/controls at >= 900px and stacks on phones.
 */
import type { ReactNode } from 'react'
import { cx } from '@/lib/utils'

export function DemoPanel({ title, meta, actions, children, className, bodyClassName }: {
  title: string
  meta?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cx('bg-surface border border-rule rounded-2 min-w-0 strata:border-rule-soft', className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-rule strata:border-rule-soft">
        <h3 className="mono !font-mono !normal-case text-ink-2 tracking-[.1em]">{title}</h3>
        {meta ? <span className="mono text-ink-3">{meta}</span> : null}
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      <div className={cx('p-4 min-w-0', bodyClassName)}>{children}</div>
    </section>
  )
}

export function DemoGrid({ children, className, aside }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cx('grid gap-4 mid:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start', className)}>
      <div className="grid gap-4 min-w-0">{children}</div>
      {aside ? <div className="grid gap-4 min-w-0">{aside}</div> : null}
    </div>
  )
}

/** Toolbar row of controls that wraps on phones. */
export function DemoToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex flex-wrap items-end gap-3', className)}>{children}</div>
}
