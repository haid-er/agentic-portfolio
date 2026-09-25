'use client'
/**
 * Collection switcher: a rail on wide screens, a scrolling chip row on phones.
 * Links go through the unsaved-changes guard like any other link.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cx } from '@/lib/utils'

export interface NavItem { name: string; label: string; group: string }

export function CollectionNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const groups = [...new Set(items.map((i) => i.group))]
  const isOn = (name: string) => pathname === `/admin/${name}`
  return (
    <nav aria-label="Collections" className="min-w-0">
      {/* phones + tablets */}
      <ul className="lg:hidden m-0 p-0 list-none flex gap-2 overflow-x-auto overscroll-x-contain -mx-[var(--gutter)] px-[var(--gutter)] pb-2 [scrollbar-width:thin]">
        <li className="flex-none"><Link href="/admin" className="inline-flex items-center min-h-tap px-3 font-mono text-00 uppercase tracking-[.08em] text-ink-2 border border-rule-soft rounded-pill">← All</Link></li>
        {items.map((i) => (
          <li key={i.name} className="flex-none">
            <Link
              href={`/admin/${i.name}`}
              aria-current={isOn(i.name) ? 'page' : undefined}
              className={cx(
                'inline-flex items-center min-h-tap px-3 font-mono text-00 uppercase tracking-[.08em] border rounded-pill whitespace-nowrap',
                isOn(i.name) ? 'bg-ink text-bg border-ink' : 'bg-surface text-ink border-rule hover:bg-bg-2',
              )}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>

      {/* desktop rail */}
      <div className="hidden lg:grid gap-s4 sticky top-s4">
        <Link href="/admin" className="mono text-ink-2 hover:text-ink min-h-tap inline-flex items-center">← Dashboard</Link>
        {groups.map((g) => (
          <div key={g} className="grid gap-1">
            <p className="mono m-0 text-ink-3 border-b border-rule-soft pb-1">{g}</p>
            <ul className="m-0 p-0 list-none grid">
              {items.filter((i) => i.group === g).map((i) => (
                <li key={i.name}>
                  <Link
                    href={`/admin/${i.name}`}
                    aria-current={isOn(i.name) ? 'page' : undefined}
                    className={cx(
                      'flex items-center min-h-[40px] pl-3 border-l-2 text-0',
                      isOn(i.name) ? 'border-accent text-ink font-semibold' : 'border-transparent text-ink-2 hover:text-ink hover:border-rule',
                    )}
                  >
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
