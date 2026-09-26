'use client'
/**
 * site.json is one file but five concerns, so it gets five tabs:
 * profile, hero & about, contact & socials, sections, SEO. All tabs share one
 * form and one Save. The tab lives in `?tab=` so links like
 * /admin/site?tab=sections open straight to it.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '@/lib/utils'
import { useEditor } from '../EditorContext'
import { REVEAL_EVENT } from '../EditorShell'
import { ContactEditor } from './ContactEditor'
import { HeroEditor } from './HeroEditor'
import { ProfileEditor } from './ProfileEditor'
import { SectionsEditor } from './SectionsEditor'
import { SeoEditor } from './SeoEditor'

export const SITE_TABS = [
  { id: 'profile', label: 'Profile', roots: ['profile'], View: ProfileEditor },
  { id: 'hero', label: 'Hero & about', roots: ['hero', 'about'], View: HeroEditor },
  { id: 'contact', label: 'Contact & links', roots: ['contact', 'socials', 'contactFormEndpoint', 'masthead'], View: ContactEditor },
  { id: 'sections', label: 'Sections', roots: ['sections'], View: SectionsEditor },
  { id: 'seo', label: 'SEO', roots: ['seo', 'analytics'], View: SeoEditor },
] as const

export type SiteTab = (typeof SITE_TABS)[number]['id']
export const isSiteTab = (v: unknown): v is SiteTab => SITE_TABS.some((t) => t.id === v)

const tabFor = (key: string) => SITE_TABS.find((t) => (t.roots as readonly string[]).includes(key.split('.')[0] ?? ''))?.id

export function SiteEditor({ initialTab = 'profile' }: { initialTab?: SiteTab }) {
  const ed = useEditor()
  const [tab, setTab] = useState<SiteTab>(initialTab)
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const select = (id: SiteTab, focus = false) => {
    setTab(id)
    const url = new URL(location.href)
    url.searchParams.set('tab', id)
    history.replaceState(history.state, '', url)
    if (focus) refs.current[SITE_TABS.findIndex((t) => t.id === id)]?.focus()
  }

  // A problem in another tab (save attempt or "jump to") switches to it.
  useEffect(() => {
    const onReveal = (e: Event) => {
      const t = tabFor((e as CustomEvent<string>).detail)
      if (t) setTab(t)
    }
    window.addEventListener(REVEAL_EVENT, onReveal)
    return () => window.removeEventListener(REVEAL_EVENT, onReveal)
  }, [])

  const onKey = (e: KeyboardEvent) => {
    const i = SITE_TABS.findIndex((t) => t.id === tab)
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? SITE_TABS.length - 1 : null
    if (n === null) return
    e.preventDefault()
    select(SITE_TABS[(n + SITE_TABS.length) % SITE_TABS.length]!.id, true)
  }

  const current = SITE_TABS.find((t) => t.id === tab) ?? SITE_TABS[0]
  const View = current.View

  return (
    <div className="grid gap-s5 min-w-0">
      <div role="tablist" aria-label="Site sections" onKeyDown={onKey}
        className="flex gap-1 overflow-x-auto overscroll-x-contain -mx-[var(--gutter)] px-[var(--gutter)] md:mx-0 md:px-0 border-b border-rule [scrollbar-width:thin]">
        {SITE_TABS.map((t, i) => {
          const on = t.id === tab
          const problems = t.roots.reduce((n, r) => n + ed.errorsUnder([r]), 0)
          const changed = t.roots.some((r) => JSON.stringify((ed.data as Record<string, unknown>)[r]) !== JSON.stringify((ed.initial as Record<string, unknown>)[r]))
          return (
            <button
              key={t.id}
              ref={(el) => { refs.current[i] = el }}
              role="tab"
              type="button"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => select(t.id)}
              className={cx(
                'relative flex-none inline-flex items-center gap-2 min-h-tap px-s3 font-mono text-00 uppercase tracking-[.08em] whitespace-nowrap',
                'border-b-2 -mb-px motion-safe:transition-colors',
                on ? 'border-accent text-ink' : 'border-transparent text-ink-2 hover:text-ink',
              )}
            >
              {t.label}
              {problems ? <span className="inline-grid place-items-center min-w-5 h-5 px-1 rounded-pill bg-danger text-bg text-[10px] nums" aria-label={`${problems} to fix`}>{problems}</span> : null}
              {changed && !problems ? <span className="inline-block size-[6px] rounded-pill bg-accent-2" aria-label="edited" /> : null}
            </button>
          )
        })}
      </div>
      <div role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`} className="grid gap-s5 min-w-0">
        <View />
      </div>
    </div>
  )
}
