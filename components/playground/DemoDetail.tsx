/**
 * Server pieces of /playground/[slug]: the specimen label (story + skills),
 * notes (how it works, honest limits, stack), record mentions and the pager.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon, Tag } from '@/components/ui'
import { cx } from '@/lib/utils'
import type { DemoCardModel, RecordMention } from './model'
import { ChipRow, SkillLinkChip, SkillTags } from './SkillChips'
import { SpecimenCard } from './SpecimenCard'
import { catalogueNo } from './slug'

/** Section head used on the demo page: mono kicker + display h2. */
export function DetailHead({ id, kicker, title, className }: { id: string; kicker?: string; title: string; className?: string }) {
  return (
    <div className={cx('grid gap-1', className)}>
      {kicker ? <p aria-hidden="true" className="mono m-0 text-accent-ink nums">{kicker}</p> : null}
      <h2 id={id} className="text-[clamp(1.6rem,4.5vw,2.5rem)]">{title}</h2>
    </div>
  )
}

/** The story plate: which real work this mirrors, and the skills it proves. */
export function SpecimenLabel({ card, proves }: { card: DemoCardModel; proves: DemoCardModel['proves'] }) {
  // Registry skills that are not already content skills (case-insensitive).
  const named = new Set(proves.map((p) => p.name.toLowerCase()))
  const extra = card.skills.filter((s) => !named.has(s.toLowerCase()))
  return (
    <aside
      aria-label="Specimen label"
      className="grid content-start gap-s4 border border-rule bg-surface p-s4 rounded-2 almanac:shadow-plate strata:border-0 strata:border-t-4 strata:border-t-[var(--card-layer)] strata:shadow-plate md:p-s5"
      style={{ ['--card-layer' as string]: `var(--layer-${card.layer})` }}
    >
      {card.mirrors ? (
        <div className="grid gap-s2 border-l-4 border-accent-2 pl-s3">
          <p className="mono m-0 text-ink-3">The real work it mirrors</p>
          <p className="m-0 text-2 leading-snug text-ink">{card.mirrors}</p>
        </div>
      ) : null}
      {proves.length ? (
        <ChipRow label="Skills it proves">
          {proves.map((s) => (
            <li key={s.id} className="max-w-full"><SkillLinkChip id={s.id} name={s.name} demos={s.demos} layer={card.layer} /></li>
          ))}
        </ChipRow>
      ) : null}
      {extra.length ? (
        <div className="grid gap-s2">
          <p className="mono m-0 text-ink-3">{proves.length ? 'Also exercises' : 'Skills it proves'}</p>
          <SkillTags skills={extra} />
        </div>
      ) : null}
    </aside>
  )
}

/** How it works, honest limits and stack, as three printed columns. */
export function DemoNotesBlock({ howItWorks, limits, stack }: { howItWorks: string; limits: string[]; stack: string[] }) {
  const cols: { id: string; title: string; body: ReactNode }[] = []
  if (howItWorks) {
    cols.push({ id: 'how-it-works', title: 'How it works', body: <p className="m-0 measure">{howItWorks}</p> })
  }
  if (limits.length) {
    cols.push({
      id: 'limits',
      title: 'Honest limits',
      body: (
        <ul className="m-0 grid list-none gap-s2 p-0">
          {limits.map((l) => (
            <li key={l} className="flex gap-s2 text-0 text-ink-2">
              <Icon name="info" size={16} className="mt-[3px] text-accent-ink" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      ),
    })
  }
  if (stack.length) {
    cols.push({
      id: 'stack',
      title: 'Built with',
      body: <ul className="m-0 flex list-none flex-wrap gap-s2 p-0">{stack.map((s) => <li key={s}><Tag>{s}</Tag></li>)}</ul>,
    })
  }
  if (!cols.length) return null
  return (
    <div
      className={cx(
        'grid gap-s6 lg:gap-s7',
        cols.length === 3 && 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)]',
        cols.length === 2 && 'lg:grid-cols-2',
      )}
    >
      {cols.map((c, i) => (
        <section key={c.id} id={c.id} aria-labelledby={`${c.id}-title`} className="grid content-start gap-s3 scroll-mt-24 almanac:border-t almanac:border-rule almanac:pt-s3">
          <DetailHead id={`${c.id}-title`} kicker={`§ ${i + 1}`} title={c.title} />
          {c.body}
        </section>
      ))}
    </div>
  )
}

/** Every enabled record item (roles, projects, papers…) that names this demo as proof. */
export function RecordMentions({ mentions }: { mentions: RecordMention[] }) {
  if (!mentions.length) return null
  return (
    <section aria-labelledby="record-title" className="grid gap-s4">
      <DetailHead id="record-title" kicker="Cross-reference" title="Where it shows up in the record" />
      <ol className="m-0 grid list-none gap-0 border-t border-rule p-0">
        {mentions.map((m) => {
          const inner = (
            <>
              <span className="grid gap-1 min-w-0">
                {m.kind ? <span className="mono text-ink-3">{m.kind}</span> : null}
                <span className="font-semibold text-ink">{m.title}</span>
                {m.detail ? <span className="text-0 text-ink-2">{m.detail}</span> : null}
              </span>
              {m.href ? <Icon name="arrow" size={18} className="mt-1 shrink-0 text-accent-ink transition-transform group-hover:translate-x-[3px]" /> : null}
            </>
          )
          return (
            <li key={m.key} className="border-b border-rule-soft">
              {m.href ? (
                <Link href={m.href} className="group flex min-h-tap items-start justify-between gap-s4 py-s3 no-underline hover:bg-bg-2 px-s2 -mx-s2">
                  {inner}
                </Link>
              ) : (
                <div className="flex items-start justify-between gap-s4 py-s3">{inner}</div>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** Previous / next specimen, like turning a catalogue page. */
export function DemoPager({ prev, next, total }: { prev?: DemoCardModel; next?: DemoCardModel; total: number }) {
  if (!prev && !next) return null
  return (
    <nav aria-label="More demos" className="grid gap-s3 md:grid-cols-2">
      {prev ? <PagerLink card={prev} dir="prev" total={total} /> : <span />}
      {next ? <PagerLink card={next} dir="next" total={total} /> : null}
    </nav>
  )
}

function PagerLink({ card, dir, total }: { card: DemoCardModel; dir: 'prev' | 'next'; total: number }) {
  return (
    <Link
      href={`/playground/${card.slug}`}
      rel={dir}
      className={cx(
        'group grid gap-1 border border-rule bg-surface p-s4 no-underline rounded-2',
        'transition-shadow duration-[var(--dur-fast)] almanac:hover:shadow-press strata:border-0 strata:shadow-plate',
        dir === 'next' && 'md:text-right',
      )}
    >
      <span className={cx('mono flex items-center gap-2 text-ink-3', dir === 'next' && 'md:justify-end')}>
        {dir === 'prev' ? <Icon name="arrow" size={14} className="rotate-180" /> : null}
        {dir === 'prev' ? 'Previous' : 'Next'} · <span className="nums">{catalogueNo(card.no)} / {total}</span>
        {dir === 'next' ? <Icon name="arrow" size={14} /> : null}
      </span>
      <span className="display text-3 text-ink group-hover:underline decoration-accent-2 decoration-2">{card.title}</span>
      <span className="mono text-ink-3">{card.pillarLabel}</span>
    </Link>
  )
}

/** Up to three neighbours from the same pillar, as compact specimen cards. */
export function RelatedDemos({ cards, pillarLabel }: { cards: DemoCardModel[]; pillarLabel: string }) {
  if (!cards.length) return null
  return (
    <section aria-labelledby="related-title" className="grid gap-s4">
      <DetailHead id="related-title" kicker="Same pillar" title={`More in ${pillarLabel}`} />
      <ul className="m-0 grid list-none gap-s5 p-0 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.slug} className="min-w-0"><SpecimenCard card={c} headingLevel="h3" compact /></li>
        ))}
      </ul>
    </section>
  )
}
