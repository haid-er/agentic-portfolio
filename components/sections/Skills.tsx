/**
 * Skill -> proof (DESIGN.md 6.3): skills set like wood type in a type case, one
 * drawer per pillar.
 *
 * - A skill with one proof is a ProofChip straight to its demo.
 * - A skill with several proofs shows "→ slug +N" and expands on tap into the
 *   full list of demos (native <details>, so it stays a server component).
 * - Only visible playground demos are linked. The first few proven skills per
 *   pillar are shown; the rest sit behind a "more" disclosure to keep the page short.
 * - Skills with no visible proof are never linked or counted as proven: they are
 *   listed in plain text as "no demo yet".
 * - No proficiency bands: docs/context gives none, so none are shown.
 *
 * Everything shown comes from content/skills.json, site.profile.pillars and the
 * demo registry (content order is the editor's order).
 */
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Icon, ProofChip, SectionShell, type Layer } from '@/components/ui'
import { getProfile, getSkills, PILLARS, type Pillar, type Skill } from '@/lib/content'
import { getDemo, PILLAR_GLYPH, type Demo } from '@/lib/demos'
import { cx, folio as pad } from '@/lib/utils'
import type { SectionProps } from './types'

/** Proven skills shown per drawer before the "more" disclosure. */
const VISIBLE = 5

interface ProvenSkill {
  skill: Skill
  proofs: Demo[]
}

interface Drawer {
  pillar: Pillar
  title: string
  layer: Layer
  proven: ProvenSkill[]
  unproven: Skill[]
}

const toLayer = (n: number) => ((n % 6) + 1) as Layer

/** Group enabled skills into pillar drawers: proven (>= 1 visible demo) and not yet demoed. */
function buildDrawers(): Drawer[] {
  const pillarTitles = new Map(getProfile().pillars.map((p) => [p.id, p.title]))
  const all: ProvenSkill[] = getSkills().map((skill) => ({
    skill,
    proofs: skill.demoSlugs.map((s) => getDemo(s)).filter((d): d is Demo => Boolean(d)),
  }))

  return PILLARS.map((pillar) => {
    const inPillar = all.filter((p) => p.skill.pillar === pillar)
    return {
      pillar,
      title: pillarTitles.get(pillar) || pillar,
      proven: inPillar.filter((p) => p.proofs.length > 0),
      unproven: inPillar.filter((p) => p.proofs.length === 0).map((p) => p.skill),
    }
  })
    .filter((d) => d.proven.length > 0)
    .map((d, i) => ({ ...d, layer: toLayer(i) }))
}

/** One row of the expanded proof list. */
function ProofRowLink({ demo }: { demo: Demo }) {
  return (
    <li>
      <Link
        href={`/playground/${demo.slug}`}
        className={cx(
          'group/row grid grid-cols-[auto_1fr_auto] items-center gap-x-3 min-h-tap px-3 py-2 no-underline',
          'text-ink hover:bg-bg-2 rounded-0',
        )}
      >
        <span className="text-ink-3 group-hover/row:text-accent-ink">
          <Icon name={demo.glyph ?? PILLAR_GLYPH[demo.pillar]} size={18} />
        </span>
        <span className="grid min-w-0">
          <span className="font-semibold text-0 leading-snug">{demo.title}</span>
          <span className="font-mono text-00 text-accent-ink break-all">{demo.slug}</span>
        </span>
        <span className="text-ink-3 transition-transform duration-[var(--dur-fast)] group-hover/row:translate-x-[3px] group-hover/row:text-ink">
          <Icon name="arrow" size={16} />
        </span>
      </Link>
    </li>
  )
}

/**
 * A multi-proof chip: looks like ProofChip, but tapping it opens the list of every
 * demo that proves the skill. When open it takes a full row, so it never overflows.
 */
function MultiProofChip({ item, group, layer }: { item: ProvenSkill; group: string; layer: Layer }) {
  const { skill, proofs } = item
  const [first] = proofs
  if (!first) return null
  const extra = proofs.length - 1
  return (
    <details name={group} className="group/chip min-w-0 max-w-full">
      <summary
        className={cx(
          'group relative inline-flex items-stretch min-h-tap max-w-full cursor-pointer list-none',
          '[&::-webkit-details-marker]:hidden',
          'border border-rule rounded-1 overflow-hidden bg-surface',
          'strata:shadow-[inset_0_-3px_0_var(--chip-layer)]',
          'group-open/chip:almanac:shadow-press',
        )}
        style={{ '--chip-layer': `var(--layer-${layer})` } as CSSProperties}
      >
        <span className="flex items-center px-3 font-semibold text-0 text-ink">{skill.name}</span>
        <span aria-hidden="true" className="relative w-4 shrink-0 self-center border-t border-rule">
          <span className="absolute -top-[2.5px] left-0 size-1 rounded-full bg-ink opacity-0 transition-none group-hover:opacity-100 group-hover:translate-x-3 group-hover:transition-transform group-hover:duration-[420ms] group-focus-visible:opacity-100 group-focus-visible:translate-x-3 group-focus-visible:transition-transform group-focus-visible:duration-[420ms]" />
        </span>
        <span className="flex items-center gap-2 px-3 bg-bg-2 font-mono text-00 text-accent-ink transition-colors group-hover:text-ink">
          <span aria-hidden="true">→ {first.slug}</span>
          <span aria-hidden="true" className="text-ink-3">+{extra}</span>
          <span className="sr-only">{`${skill.name}: show ${proofs.length} proofs`}</span>
          <span aria-hidden="true" className="text-ink-2 group-open/chip:hidden"><Icon name="plus" size={14} /></span>
          <span aria-hidden="true" className="text-ink-2 hidden group-open/chip:inline-flex"><Icon name="minus" size={14} /></span>
        </span>
      </summary>
      <div
        className={cx(
          'mt-2 max-w-[34rem] bg-surface border border-rule rounded-1',
          'almanac:shadow-press strata:shadow-plate',
          'motion-safe:animate-[fade-in_var(--dur-med)_var(--ease-out)]',
        )}
      >
        <p className="mono text-ink-3 m-0 px-3 pt-3 pb-1">{`${proofs.length} proofs · ${skill.name}`}</p>
        <ul className="list-none m-0 p-1 grid divide-y divide-rule-soft">
          {proofs.map((d) => <ProofRowLink key={d.slug} demo={d} />)}
        </ul>
        <p className="m-0 px-3 pb-3 pt-1">
          <Link href={`/playground?skill=${encodeURIComponent(skill.id)}`} className="mono inline-flex items-center gap-1 min-h-tap text-accent-ink underline underline-offset-4">
            {`All ${skill.name} proofs in the playground`}
            <Icon name="arrow" size={14} />
          </Link>
        </p>
      </div>
    </details>
  )
}

function SkillChip({ item, group, layer }: { item: ProvenSkill; group: string; layer: Layer }) {
  const [first] = item.proofs
  if (!first) return null
  return item.proofs.length > 1 ? (
    <MultiProofChip item={item} group={group} layer={layer} />
  ) : (
    <ProofChip skill={item.skill.name} slug={first.slug} layer={layer} />
  )
}

function ChipList({ items, drawer }: { items: ProvenSkill[]; drawer: Drawer }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-2 list-none m-0 p-0 min-w-0">
      {items.map((item) => (
        <li key={item.skill.id} className="min-w-0 max-w-full has-[details[open]]:basis-full">
          <SkillChip item={item} group={`proofs-${drawer.pillar}`} layer={drawer.layer} />
        </li>
      ))}
    </ul>
  )
}

function DrawerRow({ drawer }: { drawer: Drawer }) {
  const headingId = `skills-${drawer.pillar}`
  const shown = drawer.proven.slice(0, VISIBLE)
  const rest = drawer.proven.slice(VISIBLE)
  return (
    <li
      className={cx(
        'grid gap-s4 py-s5 mid:grid-cols-[15rem_1fr] mid:gap-s6',
        'almanac:border-t almanac:border-rule almanac:first:border-t-0 almanac:first:pt-0',
        'strata:bg-surface strata:rounded-2 strata:px-s4 strata:mid:px-s5 strata:shadow-[inset_4px_0_0_var(--drawer-layer)]',
      )}
      style={{ '--drawer-layer': `var(--layer-${drawer.layer})` } as CSSProperties}
    >
      <div className="grid grid-cols-[auto_1fr] gap-x-s3 gap-y-1 content-start mid:sticky mid:top-24 self-start">
        <span aria-hidden="true" className="row-span-2 grid place-items-center size-11 border border-rule rounded-1 text-accent-ink strata:text-[var(--drawer-layer)] strata:rounded-full">
          <Icon name={PILLAR_GLYPH[drawer.pillar]} size={22} />
        </span>
        <h3 id={headingId} className="text-2 leading-tight">{drawer.title}</h3>
        <p className="mono text-ink-3 m-0">
          <span className="nums">{pad(drawer.proven.length)}</span> with a working proof
        </p>
      </div>

      <div className="grid gap-s3 min-w-0">
        <ChipList items={shown} drawer={drawer} />
        {rest.length ? (
          <details className="group/more grid gap-2 min-w-0">
            <summary className="mono inline-flex items-center gap-2 min-h-tap cursor-pointer list-none [&::-webkit-details-marker]:hidden text-accent-ink underline underline-offset-4 justify-self-start">
              <span aria-hidden="true" className="group-open/more:hidden"><Icon name="plus" size={14} /></span>
              <span aria-hidden="true" className="hidden group-open/more:inline-flex"><Icon name="minus" size={14} /></span>
              <span className="group-open/more:hidden">{`${rest.length} more ${drawer.title} skills`}</span>
              <span className="hidden group-open/more:inline">{`Fewer ${drawer.title} skills`}</span>
            </summary>
            <div className="pt-2"><ChipList items={rest} drawer={drawer} /></div>
          </details>
        ) : null}
        {drawer.unproven.length ? (
          <p className="m-0 text-0 text-ink-2 max-w-[60ch]">
            <span className="mono text-ink-3">No demo yet: </span>
            {drawer.unproven.map((s) => s.name).join(', ')}
          </p>
        ) : null}
      </div>
    </li>
  )
}

/** Fallback heading when the admin leaves the section title empty. */
export const DEFAULT_TITLE = 'Skills'

/** The same test as this section's early `return null` (used by the nav and index). */
/** Skills renders only skills with at least one visible proof demo. */
export const shouldRender = (): boolean => buildDrawers().length > 0

export default function Skills({ section, folio }: SectionProps) {
  const drawers = buildDrawers()
  if (!drawers.length) return null

  const skillCount = drawers.reduce((n, d) => n + d.proven.length, 0)
  const demoCount = new Set(drawers.flatMap((d) => d.proven.flatMap((s) => s.proofs.map((p) => p.slug)))).size
  const unprovenCount = drawers.reduce((n, d) => n + d.unproven.length, 0)

  const aside = (
    <div className="grid gap-2 md:justify-items-end">
      <p className="mono text-ink-2 m-0">
        <span className="nums text-ink">{skillCount}</span> skills <span aria-hidden="true">→</span>
        <span className="sr-only"> proven by </span> <span className="nums text-ink">{demoCount}</span> working demos
      </p>
      {unprovenCount ? (
        <p className="mono text-ink-3 m-0"><span className="nums">{unprovenCount}</span> more listed with no demo yet</p>
      ) : null}
    </div>
  )

  return (
    <SectionShell id={section.id} folio={folio} title={section.title || DEFAULT_TITLE} note={section.note} aside={aside}>
      <ul className="list-none m-0 p-0 grid strata:gap-s4">
        {drawers.map((d) => <DrawerRow key={d.pillar} drawer={d} />)}
      </ul>
    </SectionShell>
  )
}
