/**
 * Services (CONTRACTS.md 3): what Malik can be hired to build, one card each.
 *
 * - Each card carries a Lucide glyph named in content (`icon`, PascalCase or
 *   kebab-case). Lucide is only the base (DESIGN.md 7): it is drawn at 1.5px
 *   with the world's line cap, in currentColor. The icon map is resolved here,
 *   on the server, so no icon code ships to the browser. Unknown names fall
 *   back to the in-house core glyph instead of breaking the card.
 * - Every card ends in "Proof:" links. Only visible playground demos are
 *   linked; hidden or unknown slugs are dropped (a claim never links a 404).
 * - The first card is the feature plate (hard offset shadow in Almanac) and
 *   spans two columns from 768px, so five services set as 2+1 / 3 rows.
 *
 * Everything shown comes from content/services.json and the demo registry.
 */
import { icons, type LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Card, Icon, ProofRow, SectionShell, type Layer } from '@/components/ui'
import { getServices, type Service } from '@/lib/content'
import { getDemo } from '@/lib/demos'
import { cx, folio as pad } from '@/lib/utils'
import type { SectionProps } from './types'

const toLayer = (n: number) => ((n % 6) + 1) as Layer

/** "cloud-upload" / "cloudUpload" / "CloudUpload" -> "CloudUpload". */
function toPascal(name: string): string {
  return name
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function lucideFor(name: string): LucideIcon | undefined {
  if (!name) return undefined
  const key = toPascal(name)
  return Object.prototype.hasOwnProperty.call(icons, key) ? icons[key as keyof typeof icons] : undefined
}

/** The service glyph on its inked plate. Decorative: the title names the card. */
function ServiceGlyph({ name, feature }: { name: string; feature: boolean }) {
  const Glyph = lucideFor(name)
  const size = feature ? 30 : 26
  return (
    <span
      aria-hidden="true"
      className={cx(
        'relative inline-grid place-items-center shrink-0 bg-bg-2 text-accent',
        feature ? 'size-16' : 'size-14',
        'almanac:border almanac:border-rule almanac:rounded-0',
        'strata:rounded-pill strata:shadow-[inset_0_0_0_1px_var(--rule)]',
        // press-plate lift on card hover (<= 3px travel, DESIGN.md 8)
        'transition-[transform,box-shadow] duration-[var(--dur-fast)] ease-[var(--ease-out)]',
        'almanac:group-hover:shadow-press almanac:group-hover:-translate-x-0.5 almanac:group-hover:-translate-y-0.5',
        'strata:group-hover:shadow-[inset_0_0_0_1px_var(--card-layer)]',
        'motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0',
      )}
    >
      {Glyph ? (
        <Glyph
          size={size}
          strokeWidth={1.5}
          absoluteStrokeWidth
          style={{ strokeLinecap: 'var(--icon-cap)' as CSSProperties['strokeLinecap'] }}
          focusable="false"
        />
      ) : (
        <Icon name="core" size={size} />
      )}
    </span>
  )
}

function ServiceCard({ service, index, total, feature }: { service: Service; index: number; total: number; feature: boolean }) {
  const proofs = service.demoSlugs.filter((slug) => Boolean(getDemo(slug)))
  return (
    <Card
      as="li"
      feature={feature}
      layer={toLayer(index)}
      className={cx(
        'group flex flex-col gap-s4',
        'transition-transform duration-[var(--dur-med)] ease-[var(--ease-out)] hover:-translate-y-0.5',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        feature && 'md:col-span-2 md:p-s6',
      )}
    >
      <div className="flex items-start justify-between gap-s4">
        <ServiceGlyph name={service.icon} feature={feature} />
        <p className="mono m-0 text-ink-3 nums" aria-hidden="true">
          <span className="text-accent-ink">{pad(index + 1)}</span>
          <span className="px-1">/</span>
          {pad(total)}
        </p>
      </div>

      <div className={cx('flex flex-col gap-s3', feature && 'md:grid md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-s6 md:items-end')}>
        <h3 className={cx('display m-0 break-words', feature ? 'text-3 md:text-4' : 'text-3')}>
          {service.title}
        </h3>
        {service.summary ? (
          <p className={cx('m-0 text-ink-2 measure', feature ? 'text-1 md:text-2 md:leading-snug' : 'text-1')}>
            {service.summary}
          </p>
        ) : null}
      </div>

      {proofs.length ? (
        <div className="mt-auto pt-s3 border-t border-rule-soft">
          <ProofRow slugs={proofs} />
        </div>
      ) : null}
    </Card>
  )
}

export default function Services({ section, folio }: SectionProps) {
  const items = getServices()
  if (!items.length) return null
  return (
    <SectionShell id={section.id} folio={folio} title={section.title || 'Services'} note={section.note}>
      <ul role="list" className="m-0 p-0 list-none grid gap-s5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((service, i) => (
          <ServiceCard
            key={service.id}
            service={service}
            index={i}
            total={items.length}
            feature={i === 0 && items.length > 1}
          />
        ))}
      </ul>
    </SectionShell>
  )
}
