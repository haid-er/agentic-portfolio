'use client'
/**
 * Desktop nav (DESIGN.md 6.6, >=1024px): inline mono links; the section in view
 * gets a 2px --accent underline (scroll-spy). The playground item also marks
 * the /playground pages. Items past the fourth only show from 1280px so the
 * header row never overflows at 1024px; the Ctrl/Cmd+K index lists them all.
 */
import { usePathname } from 'next/navigation'
import { cx } from '@/lib/utils'
import { NavLink } from './NavLink'
import type { NavSection } from './types'
import { useActiveSection } from './useActiveSection'

/** How many links fit beside the name and controls at 1024px. */
const LG_VISIBLE = 4

export function isCurrent(s: NavSection, active: string | null, pathname: string): boolean {
  if (s.id === 'playground' && pathname.startsWith('/playground')) return true
  if (s.id === 'resume' && pathname.startsWith('/resume')) return true
  if (s.id === 'projects' && pathname.startsWith('/projects')) return true
  return active === s.id
}

export function PrimaryNav({ items, spyIds, label }: { items: NavSection[]; spyIds: string[]; label: string }) {
  const pathname = usePathname() ?? '/'
  const active = useActiveSection(spyIds)
  if (!items.length) return null
  return (
    <nav aria-label={label} className="hidden lg:block">
      <ul className="m-0 flex list-none items-center gap-1 p-0">
        {items.map((s, i) => {
          const current = isCurrent(s, active, pathname)
          return (
            <li key={s.id} className={i >= LG_VISIBLE ? 'hidden xl:list-item' : undefined}>
              <NavLink
                href={s.href}
                aria-current={current ? (s.href.startsWith('/#') ? 'location' : 'page') : undefined}
                className={cx(
                  'group relative inline-flex min-h-tap items-center gap-2 px-3 no-underline mono',
                  current ? 'text-ink' : 'text-ink-2 hover:text-ink',
                )}
              >
                <span aria-hidden="true" className="nums text-accent-ink">{s.folio}</span>
                <span>{s.label}</span>
                <span
                  aria-hidden="true"
                  className={cx(
                    'absolute inset-x-3 bottom-[6px] h-[2px] origin-left bg-accent',
                    'transition-transform duration-[var(--dur-med)] ease-[var(--ease-out)]',
                    current ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50',
                  )}
                />
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
