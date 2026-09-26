/**
 * Colophon footer (DESIGN.md 11): an engineering-drawing title block set as a
 * print colophon. Four cells joined by 1px rules (two columns on mobile):
 * Project, Edition (current world label), Contact (email + socials), Note (motto).
 * Last line: "Set in {this world's fonts}. {colophon}". Server component.
 */
import type { ReactNode } from 'react'
import { WORLD_FONTS } from '@/app/fonts'
import { Icon, socialIcon } from '@/components/ui/Icon'
import { getProfile, getSite, getSocials, getTheme } from '@/lib/content'
import { cx } from '@/lib/utils'
import { themeLabels } from './nav'
import { WorldText } from './WorldText'

const UI = { project: 'Project', edition: 'Edition', contact: 'Contact', note: 'Note', setIn: 'Set in', top: 'Back to top' }

/** "A, B & C" */
const listJoin = (xs: readonly string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} & ${xs[xs.length - 1]}` : xs.join(''))

function Cell({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-2 bg-bg p-s4 md:p-s5', className)}>
      <p className="mono m-0 flex items-center gap-2 text-ink-3">
        <span aria-hidden="true" className="inline-block size-[6px] bg-accent-2 strata:rounded-pill" />
        {label}
      </p>
      <div className="min-w-0 text-0 text-ink">{children}</div>
    </div>
  )
}

export function Footer() {
  const profile = getProfile()
  const { masthead } = getSite()
  const labels = themeLabels()
  const { themes } = getTheme()
  const reads = (w: 'almanac' | 'strata') => `${themes[w].reads === 'dark' ? 'Dark' : 'Light'} edition of two`
  const email = profile.email
  const socials = getSocials().filter((s) => s.url && s.url !== `mailto:${email}`)

  return (
    <footer
      className={cx(
        'shell-print-hide relative mt-s8',
        'pb-[calc(var(--folio-bar)+env(safe-area-inset-bottom))] lg:pb-0',
      )}
    >
      <div className="wrap py-s6">
        <div className="grid grid-cols-2 gap-px border border-rule bg-rule lg:grid-cols-4 strata:overflow-hidden strata:rounded-2">
          <Cell label={UI.project}>
            <p className="display m-0 text-2 leading-tight">{profile.name}</p>
            <p className="m-0 mt-1 text-ink-2">portfolio</p>
          </Cell>

          <Cell label={UI.edition}>
            <p className="display m-0 text-2 leading-tight">
              <WorldText almanac={labels.almanac.label} strata={labels.strata.label} />
            </p>
            <p className="m-0 mt-1 text-ink-2">
              {/* The swap label only makes sense mid-transition; here, say which way the world reads. */}
              <WorldText almanac={reads('almanac')} strata={reads('strata')} />
            </p>
          </Cell>

          <Cell label={UI.contact} className="col-span-2 lg:col-span-1">
            <ul className="m-0 grid list-none gap-0 p-0">
              {email ? (
                <li>
                  <a href={`mailto:${email}`} className="inline-flex min-h-tap max-w-full items-center gap-2 [overflow-wrap:anywhere] decoration-accent-ink">
                    <Icon name="mail" size={16} className="text-ink-3" />
                    <span className="min-w-0">{email}</span>
                  </a>
                </li>
              ) : null}
              {socials.map((s) => {
                const external = /^https?:\/\//.test(s.url)
                return (
                  <li key={s.id}>
                    <a
                      href={s.url}
                      {...(external ? { target: '_blank', rel: 'me noopener noreferrer' } : {})}
                      className="inline-flex min-h-tap max-w-full items-center gap-2 [overflow-wrap:anywhere] decoration-accent-ink"
                    >
                      <Icon name={socialIcon(s.icon || s.id)} size={16} className="text-ink-3" />
                      <span className="min-w-0">
                        {s.label}
                        {s.handle ? <span className="mono ml-2 text-ink-3 normal-case tracking-normal">{s.handle}</span> : null}
                      </span>
                      {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
                    </a>
                  </li>
                )
              })}
            </ul>
          </Cell>

          {profile.motto ? (
            <Cell label={UI.note} className="col-span-2 lg:col-span-1">
              <blockquote className="m-0 text-1 leading-snug text-ink-2 almanac:italic">“{profile.motto}”</blockquote>
            </Cell>
          ) : null}
        </div>

        <div className="mono mt-s4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-ink-3">
          <p className="m-0">
            {UI.setIn}{' '}
            <WorldText almanac={listJoin(WORLD_FONTS.almanac)} strata={listJoin(WORLD_FONTS.strata)} />.
            {masthead.colophon ? ` ${masthead.colophon}` : ''}
          </p>
          <a href="#main" className="inline-flex min-h-tap items-center gap-2 no-underline hover:text-ink">
            {UI.top}
            <Icon name="arrow" size={14} className="-rotate-90" />
          </a>
        </div>
      </div>
    </footer>
  )
}
