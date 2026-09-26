'use client'
/**
 * Contents sheet (DESIGN.md 6.6, below 1024px): a bottom sheet, 88vh max.
 * Almanac: a contents page with dot leaders and folio numbers.
 * Strata: a borehole log, each row with a 6px bar in its layer ink.
 * The theme control, the index search and the socials sit at the bottom.
 */
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '@/components/ui/Icon'
import { cx } from '@/lib/utils'
import { OPEN_CONTENTS, onShellEvent, openIndex } from './events'
import { NavLink } from './NavLink'
import { isCurrent } from './PrimaryNav'
import { ShellDialog } from './ShellDialog'
import { ThemeSwitch } from './ThemeSwitch'
import type { NavSection, ThemeLabels } from './types'
import { useActiveSection } from './useActiveSection'

export interface SheetSocial { id: string; label: string; url: string; icon: IconName }

const LAYER_BG = ['', 'bg-layer-1', 'bg-layer-2', 'bg-layer-3', 'bg-layer-4', 'bg-layer-5', 'bg-layer-6'] as const

export function ContentsSheet({ sections, spyIds, labels, socials, title }: {
  sections: NavSection[]
  spyIds: string[]
  labels: ThemeLabels
  socials: SheetSocial[]
  title: string
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname() ?? '/'
  const active = useActiveSection(spyIds)
  const closeRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const focusClose = useCallback(() => closeRef.current, [])

  useEffect(() => onShellEvent(OPEN_CONTENTS, () => setOpen(true)), [])
  // A route change (a row was followed) closes the sheet.
  useEffect(() => { setOpen(false) }, [pathname])
  // The sheet is mobile-only: growing past 1024px closes it (it would be an invisible modal).
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => { if (mq.matches) setOpen(false) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <ShellDialog
      open={open}
      onClose={close}
      labelledBy="contents-sheet-title"
      initialFocus={focusClose}
      className="shell-sheet mt-auto w-full lg:hidden"
      panelClassName={cx(
        'flex max-h-[88dvh] flex-col border-t border-rule bg-surface',
        'strata:rounded-t-2 almanac:border-t-2',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <div className="wrap flex items-center justify-between gap-3 border-b border-rule-soft py-2">
        <h2 id="contents-sheet-title" className="display text-3">{title}</h2>
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          aria-label="Close contents"
          className="inline-flex size-tap items-center justify-center rounded-pill border border-rule text-ink hover:bg-bg-2"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      <nav aria-label={title} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ol className="wrap m-0 list-none py-2">
          {sections.map((s) => {
            const current = isCurrent(s, active, pathname)
            return (
              <li key={s.id}>
                <NavLink
                  href={`/#${s.id}`}
                  onNavigate={close}
                  aria-current={current ? 'location' : undefined}
                  className={cx(
                    'relative flex min-h-[52px] items-center gap-3 no-underline',
                    'almanac:border-b almanac:border-rule-soft',
                    'strata:my-1 strata:rounded-1 strata:bg-bg-2 strata:pl-4 strata:pr-3',
                    current ? 'text-ink' : 'text-ink-2 hover:text-ink',
                  )}
                >
                  <span aria-hidden="true" className={cx('absolute inset-y-0 left-0 hidden w-[6px] rounded-l-1 strata:block', LAYER_BG[s.layer])} />
                  <Icon name={s.icon} size={18} className={current ? 'text-accent' : 'text-ink-3'} />
                  <span className={cx('text-1', current && 'font-semibold')}>{s.label}</span>
                  <span aria-hidden="true" className="shell-leaders" />
                  <span className="mono nums text-accent-ink">
                    <span className="sr-only">section </span>{s.folio}
                  </span>
                </NavLink>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="wrap grid gap-2 border-t border-rule-soft py-3">
        <div className="grid grid-cols-2 gap-2">
          <ThemeSwitch labels={labels} block />
          <button
            type="button"
            onClick={() => { close(); window.setTimeout(openIndex, 30) }}
            className="inline-flex min-h-tap items-center justify-center gap-2 rounded-pill border border-rule px-3 mono text-ink hover:bg-bg-2"
          >
            <Icon name="search" size={16} />
            Search the index
          </button>
        </div>
        {socials.length ? (
          // One compact row of icons, so the section list keeps most of the sheet.
          <ul className="m-0 flex list-none flex-wrap justify-center gap-1 p-0">
            {socials.map((s) => {
              const external = /^https?:\/\//.test(s.url)
              return (
                <li key={s.id}>
                  <a
                    href={s.url}
                    {...(external ? { target: '_blank', rel: 'me noopener noreferrer' } : {})}
                    aria-label={`${s.label}${external ? ' (opens in a new tab)' : ''}`}
                    title={s.label}
                    className="inline-flex size-tap items-center justify-center rounded-pill border border-rule text-ink-2 no-underline hover:bg-bg-2 hover:text-ink"
                  >
                    <Icon name={s.icon} size={18} />
                  </a>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </ShellDialog>
  )
}
