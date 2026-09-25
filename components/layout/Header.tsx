/** Masthead + header row + nav (DESIGN.md 5, 6.6). STUB — owner: shell. */
import Link from 'next/link'
import { Icon } from '@/components/ui/Icon'
import { getProfile, getSections, getSite, getTheme } from '@/lib/content'
import { ThemeSwitch } from './ThemeSwitch'

export function Header() {
  const profile = getProfile()
  const { masthead } = getSite()
  const theme = getTheme()
  const nav = getSections().filter((s) => s.id !== 'hero' && s.navLabel)
  return (
    <header className="relative z-[var(--z-header)] border-b border-rule bg-bg">
      <div className="wrap mono text-ink-2 flex justify-between gap-3 py-2 border-b border-rule-soft">
        <span>{masthead.location}</span>
        <span className="hidden md:inline">{masthead.strapline}</span>
      </div>
      <div className="wrap flex items-center justify-between gap-4 py-3">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <Icon name="register" size={22} className="text-accent-2" />
          <span className="display text-2">{profile.name}</span>
        </Link>
        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex gap-6 list-none m-0 p-0">
            {nav.map((s) => (
              <li key={s.id}><Link className="mono no-underline" href={`/#${s.id}`}>{s.navLabel}</Link></li>
            ))}
            <li><Link className="mono no-underline" href="/playground">Playground</Link></li>
          </ul>
        </nav>
        <ThemeSwitch labels={theme.themes} />
      </div>
    </header>
  )
}
