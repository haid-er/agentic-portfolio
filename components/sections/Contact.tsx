/**
 * Contact: the direct lines (email first, with copy) set as an index page with
 * dot leaders, and a message slip that posts to the admin-set free endpoint
 * (Web3Forms / Formspree) or falls back to the visitor's own mail app.
 * `site.contact.formEnabled` shows the slip; `site.contactFormEndpoint` picks the mode.
 * Only a usable https endpoint posts; otherwise the slip needs an address
 * (profile email, or a `mailto:` endpoint) or it is not shown at all.
 */
import { ContactForm } from '@/app/resume/_client/ContactForm'
import { CopyEmail } from '@/app/resume/_client/CopyEmail'
import { endpointHost, endpointMailto } from '@/app/resume/_client/formEndpoint'
import { Badge, Card, Icon, SectionShell, socialIcon, type IconName } from '@/components/ui'
import { getProfile, getSite, getSocials } from '@/lib/content'
import { cx } from '@/lib/utils'
import type { SectionProps } from './types'

interface Line { id: string; label: string; value: string; href: string; icon: IconName }

const isExternal = (href: string) => /^https?:\/\//.test(href)

function lines(): Line[] {
  const p = getProfile()
  const out: Line[] = []
  if (p.phone) out.push({ id: 'phone', label: 'Phone', value: p.phone, href: `tel:${p.phone.replace(/[^\d+]/g, '')}`, icon: 'phone' })
  for (const s of getSocials()) {
    if (!s.url || s.url.startsWith('mailto:')) continue // email has its own plate
    out.push({ id: s.id, label: s.label, value: s.handle || s.url.replace(/^https?:\/\/(www\.)?/, ''), href: s.url, icon: socialIcon(s.icon || s.id) })
  }
  return out
}

function LineRow({ line, layer }: { line: Line; layer: number }) {
  const ext = isExternal(line.href)
  return (
    <li style={{ ['--line-layer' as string]: `var(--layer-${layer})` }}>
      <a
        href={line.href}
        {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className={cx(
          'group flex items-center gap-s3 min-h-[52px] py-s2 no-underline text-ink',
          'border-b border-rule-soft strata:pl-s3 strata:border-l-[6px] strata:border-l-[var(--line-layer)] strata:rounded-0',
          'hover:text-accent-ink',
        )}
      >
        <Icon name={line.icon} size={20} className="text-ink-2 group-hover:text-accent-ink" />
        <span className="mono text-ink-2 shrink-0">{line.label}</span>
        <span aria-hidden="true" className="flex-1 min-w-4 self-end mb-[0.45em] border-b border-dotted border-ink-3 almanac:block strata:opacity-40" />
        <span className="min-w-0 text-0 font-semibold text-right [overflow-wrap:anywhere]">{line.value}</span>
        <Icon
          name={ext ? 'arrow-up-right' : 'arrow'}
          size={16}
          className="shrink-0 text-ink-3 transition-transform duration-[var(--dur-fast)] group-hover:translate-x-[2px] group-hover:text-accent-ink"
        />
        {ext ? <span className="sr-only">(opens in a new tab)</span> : null}
      </a>
    </li>
  )
}

/** Fallback heading when the admin leaves the section title empty. */
export const DEFAULT_TITLE = 'Contact'

/** The same test as this section's early `return null` (used by the nav and index). */
/** Contact always renders (at minimum the email and links). */
export const shouldRender = (): boolean => true

export default function Contact({ section, folio }: SectionProps) {
  const site = getSite()
  const { contact, contactFormEndpoint } = site
  const p = getProfile()
  const rows = lines()
  const endpoint = endpointHost(contactFormEndpoint) ? contactFormEndpoint : undefined
  const mailTo = endpointMailto(contactFormEndpoint) || p.email
  const showForm = contact.formEnabled && Boolean(endpoint || mailTo)

  return (
    <SectionShell id={section.id} folio={folio} title={section.title || DEFAULT_TITLE} note={section.note}>
      <div className={cx('grid gap-s7', showForm && 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start')}>
        <div className="grid gap-s5 min-w-0 content-start">
          {contact.blurb ? <p className="m-0 text-2 leading-[1.35] measure">{contact.blurb}</p> : null}

          {contact.availability ? (
            <Badge tone="ok" className="justify-self-start whitespace-normal">
              <Icon name="pulse" size={14} />
              {contact.availability}
            </Badge>
          ) : null}

          {p.email ? (
            <div className="grid gap-s2 border-y-2 border-rule py-s4 strata:border-y-0 strata:border-l-4 strata:border-l-accent strata:pl-s4">
              <span className="mono text-ink-3">Email</span>
              <div className="flex flex-wrap items-center gap-x-s3 gap-y-s2">
                <a
                  href={`mailto:${p.email}`}
                  className="display inline-flex items-center min-h-tap text-[clamp(1.35rem,5.2vw,2.25rem)] leading-[1.1] text-ink no-underline [overflow-wrap:anywhere] hover:text-accent-ink hover:underline decoration-1"
                >
                  {p.email}
                </a>
                <CopyEmail email={p.email} />
              </div>
            </div>
          ) : null}

          {rows.length ? (
            <ul
              className={cx('m-0 p-0 list-none grid gap-x-s6', !showForm && 'md:grid-cols-2')}
              aria-label="Other ways to get in touch"
            >
              {rows.map((l, i) => <LineRow key={l.id} line={l} layer={(i % 6) + 1} />)}
            </ul>
          ) : null}

          {p.location ? (
            <p className="m-0 mono text-ink-3 flex items-center gap-2">
              <Icon name="globe" size={16} />
              {p.location}
            </p>
          ) : null}
        </div>

        {showForm ? (
          <Card feature layer={3} className="grid gap-s4 md:p-s6">
            <div className="flex items-center justify-between gap-s3">
              <h3 className="text-3">Write a message</h3>
              <Icon name="register" size={22} className="text-accent-2" />
            </div>
            <ContactForm endpoint={endpoint} to={mailTo} recipient={p.name} />
          </Card>
        ) : null}
      </div>
    </SectionShell>
  )
}
