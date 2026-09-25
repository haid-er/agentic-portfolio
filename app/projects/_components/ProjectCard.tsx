/**
 * One project card (DESIGN.md 6.7 card + 12 "every project ends in a Proof link").
 *
 * Mono meta line (pillar glyph, pillar, dates) -> display title linking to the
 * case page -> role -> summary -> outcome (the one metric treatment when the
 * content reads "from → to") -> stack line -> tags -> proof + links footer.
 *
 * No hooks, so it renders on the server or inside the client grid. Tags become
 * filter buttons when `onTag` is given.
 */
import Link from 'next/link'
import { Badge, Card, Icon, Metric, ProofLink, buttonClasses } from '@/components/ui'
import { cx } from '@/lib/utils'
import type { ProjectCardData } from '../_lib/model'

const STACK_PREVIEW = 5

export interface ProjectCardProps {
  project: ProjectCardData
  /** Heading level inside the page outline (h3 under a section h2 by default). */
  headingLevel?: 'h2' | 'h3'
  /** Makes tags filter buttons. */
  onTag?: (tag: string) => void
  /** The tag currently filtered on (marked pressed). */
  activeTag?: string
  /** Id placed on the title link so the grid can move focus to it. */
  titleId?: string
}

export function ProjectCard({ project: p, headingLevel = 'h3', onTag, activeTag, titleId }: ProjectCardProps) {
  const Heading = headingLevel
  const extraStack = p.stack.length - STACK_PREVIEW
  const [firstProof, ...moreProofs] = p.proofs

  return (
    <Card
      as="article"
      feature={p.featured}
      layer={p.layer}
      className={cx(
        'group/card flex h-full flex-col gap-s4',
        'transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)]',
        'motion-safe:hover:-translate-y-[2px] motion-safe:focus-within:-translate-y-[2px]',
      )}
    >
      <header className="grid gap-2">
        <p className="mono text-ink-3 m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
          <Icon name={p.glyph} size={16} className="text-accent-ink strata:text-[var(--card-layer)]" />
          {p.pillarLabel ? <span>{p.pillarLabel}</span> : null}
          {p.pillarLabel && p.range ? <span aria-hidden="true">·</span> : null}
          {p.range ? <span className="nums">{p.range}</span> : null}
        </p>
        <Heading className="text-3 [overflow-wrap:anywhere]">
          <Link
            id={titleId}
            href={`/projects/${p.slug}`}
            className="no-underline decoration-accent-2 decoration-2 underline-offset-[.14em] hover:underline focus-visible:underline"
          >
            {p.title}
          </Link>
        </Heading>
        {p.role ? <p className="m-0 text-0 text-ink-2 almanac:italic">{p.role}</p> : null}
      </header>

      <p className="m-0 text-1 text-ink measure">{p.summary}</p>

      {p.outcome ? (
        p.outcome.metric ? (
          <Metric from={p.outcome.metric.from} to={p.outcome.metric.to} label={p.outcome.metric.label} />
        ) : (
          <p className="m-0 mono text-accent-ink">{p.outcome.text}</p>
        )
      ) : null}

      {p.stack.length ? (
        <p className="m-0 mono text-ink-2 [overflow-wrap:anywhere]">
          <span className="sr-only">Stack: </span>
          {p.stack.slice(0, STACK_PREVIEW).join(' · ')}
          {extraStack > 0 ? <span className="text-ink-3"> · +{extraStack}</span> : null}
        </p>
      ) : null}

      {p.tags.length ? (
        <ul className="m-0 p-0 list-none flex flex-wrap gap-x-2" aria-label={onTag ? 'Filter by tag' : 'Tags'}>
          {p.tags.map((t) => (
            <li key={t}>
              {onTag ? <TagButton tag={t} pressed={activeTag === t} onTag={onTag} /> : <TagSlug tag={t} />}
            </li>
          ))}
        </ul>
      ) : null}

      <footer className="mt-auto grid gap-s3 pt-s3 border-t border-rule-soft">
        {firstProof ? (
          <div className="flex flex-wrap items-center gap-x-3">
            <ProofLink slug={firstProof} />
            {moreProofs.length ? (
              <span className="mono text-ink-3">+{moreProofs.length} more</span>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/projects/${p.slug}`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
            Case notes
            <Icon name="arrow" size={14} />
            <span className="sr-only">: {p.title}</span>
          </Link>
          {p.live ? (
            <a href={p.live} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
              <Icon name="arrow-up-right" size={14} />
              Live
              <span className="sr-only"> site of {p.title} (opens in a new tab)</span>
            </a>
          ) : null}
          {p.repo ? (
            <a href={p.repo} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
              <Icon name="github" size={14} />
              Repo
              <span className="sr-only"> of {p.title} (opens in a new tab)</span>
            </a>
          ) : null}
          {p.private ? (
            <Badge className="ml-auto">
              <Icon name="lock" size={12} />
              Private code
            </Badge>
          ) : null}
        </div>
      </footer>
    </Card>
  )
}

const slugClasses = 'mono inline-flex items-center px-2 py-1 border rounded-pill transition-colors duration-[var(--dur-fast)]'

function TagSlug({ tag }: { tag: string }) {
  return (
    <span className="inline-flex min-h-tap items-center">
      <span className={cx(slugClasses, 'border-rule-soft text-ink-2')}>{tag}</span>
    </span>
  )
}

/** 44px hit target around a compact printed slug. */
function TagButton({ tag, pressed, onTag }: { tag: string; pressed: boolean; onTag: (t: string) => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onTag(tag)}
      className="group/tag inline-flex min-h-tap items-center bg-transparent border-0 p-0 cursor-pointer"
    >
      <span
        className={cx(
          slugClasses,
          pressed
            ? 'bg-ink text-bg border-ink'
            : 'border-rule text-ink-2 group-hover/tag:text-ink group-hover/tag:bg-bg-2',
        )}
      >
        {pressed ? <Icon name="check" size={12} className="mr-1" /> : null}
        {tag}
      </span>
    </button>
  )
}
