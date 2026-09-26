'use client'
/**
 * Header "Collections" index: a native <details> menu (works without JS),
 * closed on navigation, Escape and outside clicks. Owner: admin-core.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cx } from '@/lib/utils'

export interface MenuEntry {
  name: string
  label: string
  folio: string
}

export function CollectionsMenu({ entries }: { entries: MenuEntry[] }) {
  const ref = useRef<HTMLDetailsElement>(null)
  const path = usePathname()

  useEffect(() => {
    if (ref.current) ref.current.open = false
  }, [path])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && el.open) {
        el.open = false
        el.querySelector('summary')?.focus()
      }
    }
    const onDown = (e: PointerEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [])

  return (
    <details ref={ref} className="group relative">
      <summary
        className={cx(
          'mono list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none',
          'inline-flex items-center gap-2 min-h-tap px-3 border border-rule rounded-pill bg-surface text-ink hover:bg-bg-2',
        )}
      >
        <Icon name="leaders" size={16} />
        Collections
        <Icon name="arrow" size={14} className="rotate-90 transition-transform duration-[var(--dur-fast)] group-open:-rotate-90" />
      </summary>
      <nav
        aria-label="Collections"
        className="absolute left-0 md:left-auto md:right-0 top-full mt-2 z-[var(--z-sheet)] w-[min(22rem,calc(100vw-2*var(--gutter)))] max-h-[70vh] overflow-y-auto bg-surface border border-rule rounded-1 shadow-press p-s2"
      >
        <ul className="m-0 p-0 list-none grid">
          {entries.map((e) => {
            const href = `/admin/${e.name}`
            const current = path === href
            return (
              <li key={e.name}>
                <Link
                  href={href}
                  aria-current={current ? 'page' : undefined}
                  className={cx(
                    'flex items-baseline gap-s2 min-h-tap px-s3 py-s2 rounded-0 no-underline text-ink hover:bg-bg-2',
                    current && 'bg-bg-2 font-semibold',
                  )}
                >
                  <span className="display text-1 text-accent-ink nums w-7 shrink-0">{e.folio}</span>
                  <span className="min-w-0">{e.label}</span>
                  <span aria-hidden="true" className="flex-1 border-b border-dotted border-rule-soft translate-y-[-4px] hidden xs:block" />
                  <span className="mono text-ink-3 ml-auto">{e.name}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </details>
  )
}
