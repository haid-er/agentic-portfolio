/**
 * Testimonials (CONTRACTS.md 3): what people who worked with Malik said.
 * The whole section is hidden when no testimonial is enabled.
 *
 * The carousel is server-rendered and needs no JavaScript:
 * - Each slide is preceded by a native radio (`name` shared), so the radios are
 *   the slide picker. Keyboard support is the browser's own: Tab reaches the
 *   picker, arrow keys move between slides (wrapping), and each radio is named
 *   "Testimonial 2 of 5: Author" and described by its quote, so a screen
 *   reader announces the quote as the slide changes.
 * - `input:checked + figure` shows the current slide. Every slide sits in the
 *   same grid cell, so the stage keeps the height of the longest quote and the
 *   page never jumps. Hidden slides use `visibility`, so they leave the
 *   accessibility tree and the tab order.
 * - It never advances on its own: the reader sets the pace, so there is
 *   nothing to pause (WCAG 2.2.2) and no infinite motion beyond the one ambient
 *   accent per world (DESIGN.md 8, 12). The only motion is a short fade and a
 *   3px settle on change, removed under prefers-reduced-motion.
 * - Previous / next arrows are labels for pointer users; they mirror the
 *   radios, so they are hidden from assistive tech to avoid duplicate controls.
 *
 * Everything shown comes from content/testimonials.json.
 */
import { Fragment } from 'react'
import { Icon, SectionShell } from '@/components/ui'
import { getTestimonials, type Testimonial } from '@/lib/content'
import { cx, folio as pad } from '@/lib/utils'
import type { SectionProps } from './types'

const isExternal = (href: string) => /^https?:\/\//i.test(href)

/** Two-ink quotation mark: the second ink sits slightly out of register. */
function QuoteMark() {
  return (
    <span aria-hidden="true" className="relative block h-[.62em] w-[.9em] text-[clamp(4.5rem,14vw,7rem)] leading-none select-none">
      <span className="display absolute left-[.05em] top-[.04em] text-accent-2 almanac:mix-blend-multiply strata:opacity-80">
        &ldquo;
      </span>
      <span className="display absolute left-0 top-0 text-accent">&ldquo;</span>
    </span>
  )
}

function Attribution({ t }: { t: Testimonial }) {
  const meta = [t.role, t.org].filter((v): v is string => Boolean(v && v.trim()))
  const author = <span className="font-semibold text-ink">{t.author}</span>
  return (
    <figcaption className="flex flex-col gap-1 min-w-0">
      <span className="flex items-center gap-s3 text-1">
        <span aria-hidden="true" className="inline-block w-s6 border-t-2 border-accent shrink-0" />
        {t.url ? (
          <a
            href={t.url}
            {...(isExternal(t.url) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="inline-flex items-center gap-2 min-h-tap no-underline hover:underline decoration-accent-ink"
          >
            {author}
            <Icon name="arrow-up-right" size={14} className="text-accent-ink" />
            {isExternal(t.url) ? <span className="sr-only">(opens in a new tab)</span> : null}
          </a>
        ) : (
          author
        )}
      </span>
      {meta.length ? <span className="mono text-ink-3 pl-[calc(var(--s-6)+var(--s-3))]">{meta.join(' · ')}</span> : null}
    </figcaption>
  )
}

/** A single quote, set as a pull-quote plate (also used when there is only one). */
function QuoteBody({ t, quoteId }: { t: Testimonial; quoteId?: string }) {
  return (
    <>
      <QuoteMark />
      <blockquote cite={t.url && isExternal(t.url) ? t.url : undefined} className="m-0">
        <p
          id={quoteId}
          className="m-0 measure text-2 md:text-3 leading-snug text-ink almanac:italic [overflow-wrap:anywhere]"
        >
          {t.quote}
        </p>
      </blockquote>
      <Attribution t={t} />
    </>
  )
}

const plate = cx(
  'relative bg-surface rounded-2 p-s5 md:p-s7',
  'almanac:border almanac:border-rule almanac:shadow-plate',
  'strata:shadow-plate strata:border-t-4 strata:border-t-layer-2',
)

function Single({ t }: { t: Testimonial }) {
  return (
    <figure className={cx(plate, 'm-0 flex flex-col gap-s5')}>
      <QuoteBody t={t} />
    </figure>
  )
}

/** Pointer-only previous / next (the radios carry keyboard and AT). */
function StepLabel({ htmlFor, dir }: { htmlFor: string; dir: 'prev' | 'next' }) {
  return (
    <label
      htmlFor={htmlFor}
      aria-hidden="true"
      title={dir === 'prev' ? 'Previous' : 'Next'}
      className={cx(
        'inline-grid place-items-center size-11 cursor-pointer border border-rule text-ink',
        'almanac:rounded-0 strata:rounded-pill',
        'transition-[transform,background-color] duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-bg-2',
        'almanac:active:translate-x-[2px] almanac:active:translate-y-[2px] strata:active:scale-[.96]',
        'motion-reduce:transition-none',
      )}
    >
      <Icon name="arrow" size={18} className={dir === 'prev' ? 'rotate-180' : undefined} />
    </label>
  )
}

function Carousel({ items, label }: { items: Testimonial[]; label: string }) {
  const n = items.length
  const radioId = (i: number) => `testimonial-pick-${items[(i + n) % n]!.id}`
  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cx(
        'grid gap-x-1 gap-y-s4',
        // Slides share row 1 (the stage); the radios auto-flow into row 2 onward,
        // one 44px+ column each, wrapping when there are many.
        'grid-cols-[repeat(auto-fill,minmax(var(--tap),1fr))]',
      )}
    >
      {items.map((t, i) => {
        const slideId = `testimonial-${t.id}`
        const quoteId = `${slideId}-quote`
        return (
          <Fragment key={t.id}>
          <input
            type="radio"
            name="testimonial-pick"
            id={radioId(i)}
            defaultChecked={i === 0}
            aria-label={`Testimonial ${i + 1} of ${n}: ${t.author}`}
            aria-describedby={quoteId}
            aria-controls={slideId}
            className={cx(
              'm-0 h-11 w-full cursor-pointer appearance-none bg-clip-content',
              // unchecked: a hairline slug; checked: a thick inked bar (shape, not only colour)
              'px-2 py-[21px] bg-ink-3',
              'checked:py-[18px] checked:px-0 checked:bg-accent',
              'hover:bg-ink checked:hover:bg-accent',
              'transition-[padding,background-color] duration-[var(--dur-fast)] ease-[var(--ease-out)] motion-reduce:transition-none',
              'almanac:rounded-0 strata:rounded-pill',
            )}
          />
          <figure
            id={slideId}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${n}`}
            className={cx(
              plate,
              'col-span-full row-start-1 m-0 flex flex-col gap-s5',
              'invisible opacity-0 translate-y-[3px]',
              '[input:checked+&]:visible [input:checked+&]:opacity-100 [input:checked+&]:translate-y-0',
              'transition-[opacity,transform,visibility] duration-[var(--dur-med)] ease-[var(--ease-out)]',
              'motion-reduce:transition-none motion-reduce:translate-y-0',
            )}
          >
            <QuoteBody t={t} quoteId={quoteId} />
            <div className="mt-auto flex items-center justify-between gap-s4 pt-s4 border-t border-rule-soft">
              <p className="mono m-0 text-ink-3 nums" aria-hidden="true">
                <span className="text-accent-ink">{pad(i + 1)}</span>
                <span className="px-1">/</span>
                {pad(n)}
              </p>
              <div className="flex gap-s2">
                <StepLabel htmlFor={radioId(i - 1)} dir="prev" />
                <StepLabel htmlFor={radioId(i + 1)} dir="next" />
              </div>
            </div>
          </figure>
          </Fragment>
        )
      })}
    </div>
  )
}

export default function Testimonials({ section, folio }: SectionProps) {
  const items = getTestimonials()
  if (!items.length) return null
  const title = section.title || 'Testimonials'
  return (
    <SectionShell
      id={section.id}
      folio={folio}
      title={title}
      note={section.note}
      aside={
        items.length > 1 ? (
          <p className="mono m-0 text-ink-3 hidden md:block" aria-hidden="true">
            ← → to turn
          </p>
        ) : null
      }
    >
      {items.length === 1 ? <Single t={items[0]!} /> : <Carousel items={items} label={title} />}
    </SectionShell>
  )
}
