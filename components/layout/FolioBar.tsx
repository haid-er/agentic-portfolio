'use client'
/**
 * Mobile bottom folio bar (DESIGN.md 6.6, below 1024px): 64px + safe area,
 * up to three primary sections plus Contents. The current item gets a 3px
 * --accent top edge (and aria-current, so colour is never the only signal).
 */
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/utils'
import { openContents } from './events'
import { NavLink } from './NavLink'
import { isCurrent } from './PrimaryNav'
import type { NavSection } from './types'
import { useActiveSection } from './useActiveSection'

const ITEM = cx(
  'relative flex h-[var(--folio-bar)] min-w-0 flex-col items-center justify-center gap-1 px-1 no-underline',
  'mono text-center text-ink-2 hover:text-ink',
)

function Edge({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'absolute inset-x-3 top-0 h-[3px] origin-center bg-accent strata:rounded-b-1',
        'transition-transform duration-[var(--dur-med)] ease-[var(--ease-out)]',
        on ? 'scale-x-100' : 'scale-x-0',
      )}
    />
  )
}

export function FolioBar({ items, spyIds, label, contentsLabel }: {
  items: NavSection[]
  spyIds: string[]
  label: string
  contentsLabel: string
}) {
  const pathname = usePathname() ?? '/'
  const active = useActiveSection(spyIds)
  return (
    <nav
      aria-label={label}
      className={cx(
        'shell-print-hide fixed inset-x-0 bottom-0 z-[var(--z-header)] lg:hidden',
        'border-t border-rule bg-surface pb-[env(safe-area-inset-bottom)]',
        'strata:shadow-[0_-8px_24px_rgb(0_0_0/.35)]',
      )}
    >
      <ul className="m-0 grid list-none p-0" style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}>
        {items.map((s) => {
          const on = isCurrent(s, active, pathname)
          return (
            <li key={s.id} className="min-w-0">
              <NavLink href={s.href} aria-current={on ? (s.href.startsWith('/#') ? 'location' : 'page') : undefined} className={cx(ITEM, on && 'text-ink')}>
                <Edge on={on} />
                <Icon name={s.icon} size={22} className={on ? 'text-accent' : undefined} />
                <span className="block max-w-full truncate tracking-normal">{s.label}</span>
              </NavLink>
            </li>
          )
        })}
        <li className="min-w-0">
          <button type="button" onClick={openContents} aria-haspopup="dialog" className={cx(ITEM, 'w-full')}>
            <Edge on={false} />
            <Icon name="leaders" size={22} />
            <span className="block max-w-full truncate tracking-normal">{contentsLabel}</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
