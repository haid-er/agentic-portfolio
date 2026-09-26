/**
 * Homepage "playground" section (DESIGN.md 10): the featured demo as a wide
 * specimen sheet (a waveform poster starts on a still frame with Play: on the
 * homepage only the world's ambient accent loops, DESIGN.md 8), then a compact index of
 * pillars linking into the gallery. Server component; the only client island is
 * the trace's play/pause control.
 */
import Link from 'next/link'
import { ButtonLink, Icon, SectionShell } from '@/components/ui'
import type { SectionProps } from '@/components/sections/types'
import { getPlayground } from '@/lib/content'
import { getFeaturedDemo } from '@/lib/demos'
import { getGalleryModel, toCardModel } from './model'
import { ChipRow, SkillLinkChip } from './SkillChips'
import { SpecimenCard } from './SpecimenCard'

/** Fallback heading when the admin leaves the section title empty. */
export const DEFAULT_TITLE = 'Playground'

/** The same test as this section's early `return null` (used by the nav and index). */
export const shouldRender = (): boolean => Boolean(getFeaturedDemo())

export default function FeaturedDemo({ section, folio }: SectionProps) {
  const demo = getFeaturedDemo()
  if (!demo) return null
  const { intro } = getPlayground()
  const { cards, pillars } = getGalleryModel()
  const card = cards.find((c) => c.slug === demo.slug) ?? toCardModel(demo, 1)
  const title = section.title || DEFAULT_TITLE

  return (
    <SectionShell
      id={section.id}
      folio={folio}
      title={title}
      note={section.note || intro}
      aside={<ButtonLink href="/playground" variant="secondary" size="sm" arrow>{`All ${cards.length} demos`}</ButtonLink>}
    >
      <div className="grid gap-s6">
        <SpecimenCard
          card={card}
          headingLevel="h3"
          wide
          feature
          live="manual"
          proves={
            card.proves.length ? (
              <ChipRow label="Proves">
                {card.proves.slice(0, 4).map((s) => (
                  <li key={s.id} className="max-w-full"><SkillLinkChip id={s.id} name={s.name} layer={card.layer} /></li>
                ))}
              </ChipRow>
            ) : null
          }
        />

        {pillars.length > 1 ? (
          <nav aria-label="Browse demos by pillar">
            <p className="mono m-0 mb-s2 text-ink-3">Browse by pillar</p>
            <ul className="m-0 grid list-none gap-0 border-t border-rule p-0 xs:grid-cols-2 lg:grid-cols-3">
              {pillars.map((p) => (
                <li key={p.id} className="border-b border-rule-soft">
                  <Link
                    href={`/playground?pillar=${p.id}`}
                    className="group flex min-h-tap items-center gap-s3 py-s3 pr-s3 no-underline hover:bg-bg-2"
                  >
                    <Icon name={p.glyph} size={20} className="text-accent-ink" />
                    <span className="font-semibold text-ink">{p.label}</span>
                    <span aria-hidden="true" className="flex-1 self-end mb-[0.4em] border-b border-dotted border-ink-3" />
                    <span className="mono nums text-ink-3">
                      {p.count}<span className="sr-only"> demos</span>
                    </span>
                    <Icon name="arrow" size={14} className="text-accent-ink transition-transform group-hover:translate-x-[3px]" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </SectionShell>
  )
}
