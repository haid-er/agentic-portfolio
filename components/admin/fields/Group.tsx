/** A titled group of fields (one card per concern), and a responsive field grid. */
import type { ReactNode } from 'react'
import { Card } from '@/components/ui'
import { cx } from '@/lib/utils'

export function Group({ title, description, id, children, aside, layer = 1 }: {
  title: string
  description?: ReactNode
  id?: string
  children: ReactNode
  aside?: ReactNode
  layer?: 1 | 2 | 3 | 4 | 5 | 6
}) {
  return (
    <Card as="section" layer={layer} aria-labelledby={id ? `${id}-title` : undefined} id={id} className="grid gap-s4 scroll-mt-24">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-1 min-w-0">
          <h2 id={id ? `${id}-title` : undefined} className="display m-0 text-2">{title}</h2>
          {description ? <p className="m-0 text-0 text-ink-2 measure">{description}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </Card>
  )
}

/** One column on phones, two from 768px. `wide` children span both. */
export function FieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('grid gap-s4 md:grid-cols-2 [&>.col-span-full]:md:col-span-2', className)}>{children}</div>
}
