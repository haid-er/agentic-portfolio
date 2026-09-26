/**
 * Masthead strip + sticky header row + the shell's client islands
 * (DESIGN.md 5, 6.6). Server component: every label comes from content.
 *
 * - Masthead: location | strapline (>=768px) | "Edition: {world label}".
 * - Header row: register-mark logo + name, primary nav (>=1024px, scroll-spy),
 *   the index button (Ctrl/Cmd+K) and "Reprint in {other}"; on mobile a 44px swatch.
 * - Mobile: bottom folio bar + contents sheet. Everywhere: the command palette.
 */
import Link from 'next/link'
import { Icon, socialIcon } from '@/components/ui/Icon'
import { getProfile, getSite, getSocials } from '@/lib/content'
import { CommandPalette } from './CommandPalette'
import { ContentsSheet, type SheetSocial } from './ContentsSheet'
import { LIVE_REGION_ID } from './events'
import { FolioBar } from './FolioBar'
import { IndexButton } from './IndexButton'
import { getNavModel, themeLabels } from './nav'
import { PrimaryNav } from './PrimaryNav'
import { ShellEffects } from './ShellEffects'
import { ThemeSwitch } from './ThemeSwitch'
import { WorldText } from './WorldText'
import './shell.css'

const UI = {
  primaryNav: 'Primary',
  folioBar: 'Sections',
  contents: 'Contents',
  index: 'Index',
  edition: 'Edition',
}

/** The two-ink register mark: slightly out of register until hovered. */
function Mark() {
  return (
    <span aria-hidden="true" className="relative inline-flex size-[26px] flex-none items-center justify-center">
      <Icon
        name="register"
        size={26}
        className="absolute text-accent-2 translate-x-[1.5px] -translate-y-[1px] transition-transform duration-[var(--dur-med)] ease-[var(--ease-out)] group-hover:translate-x-0 group-hover:translate-y-0"
      />
      <Icon name="register" size={26} className="absolute text-accent" />
    </span>
  )
}

export function Header() {
  const profile = getProfile()
  const { masthead } = getSite()
  const labels = themeLabels()
  const nav = getNavModel()
  const socials: SheetSocial[] = getSocials()
    .filter((s) => s.url)
    .map((s) => ({ id: s.id, label: s.label, url: s.url, icon: socialIcon(s.icon || s.id) }))

  return (
    <>
      <div className="shell-print-hide relative bg-bg">
        <div className="wrap mono flex items-center justify-between gap-3 py-2 text-ink-3">
          <span className="truncate">{masthead.location}</span>
          {masthead.strapline ? <span className="hidden truncate md:inline">{masthead.strapline}</span> : null}
          <span className="whitespace-nowrap">
            {UI.edition}: <span className="text-ink-2"><WorldText almanac={labels.almanac.label} strata={labels.strata.label} /></span>
          </span>
        </div>
      </div>

      <header data-shell-header className="shell-print-hide sticky top-0 z-[var(--z-header)] border-t border-b border-t-rule-soft border-b-rule bg-bg">
        <div className="wrap flex min-h-[64px] items-center justify-between gap-3">
          <Link href="/" className="group flex min-h-tap min-w-0 items-center gap-2.5 no-underline">
            <Mark />
            <span className="display truncate text-2 leading-none">{profile.name}</span>
          </Link>

          <PrimaryNav items={nav.desktop} spyIds={nav.spyIds} label={UI.primaryNav} />

          <div className="flex flex-none items-center gap-2">
            <IndexButton label={UI.index} />
            <div className="hidden lg:block"><ThemeSwitch labels={labels} /></div>
            <div className="lg:hidden"><ThemeSwitch labels={labels} compact /></div>
          </div>
        </div>
        {/* reading depth: fills as the page scrolls (CSS scroll timeline only) */}
        <span aria-hidden="true" className="shell-gauge pointer-events-none absolute inset-x-0 -bottom-px h-[2px] bg-accent" />
      </header>

      <FolioBar items={nav.primary} spyIds={nav.spyIds} label={UI.folioBar} contentsLabel={UI.contents} />
      <ContentsSheet sections={nav.sections} spyIds={nav.spyIds} labels={labels} socials={socials} title={UI.contents} />
      <CommandPalette entries={nav.index} groupLabels={nav.groupLabels} labels={labels} title={UI.index} />
      <ShellEffects />
      <div id={LIVE_REGION_ID} role="status" aria-live="polite" className="sr-only" />
    </>
  )
}
