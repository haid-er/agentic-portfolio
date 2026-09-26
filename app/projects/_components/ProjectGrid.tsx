'use client'
/**
 * Filterable project grid (client island).
 *
 * - Pillar row: toggle buttons with glyph + count (aria-pressed, 44px).
 * - Tag: a native select listing the tags inside the current pillar, and every
 *   tag on a card is also a button that filters on it.
 * - The filter is mirrored in the URL (?projects=ai&projects-tag=RAG) with
 *   replaceState, so a filtered view can be shared; other params are kept.
 * - A polite live region reads "Showing 3 of 14 projects".
 * - `limit` shows the first N cards until "Show all" (unfiltered view only);
 *   focus then moves to the first newly shown card.
 * - After the first interaction, cards re-print (Almanac) or settle (Strata)
 *   with a short stagger. Reduced motion: no animation. Cards are keyed by slug
 *   (never remounted by a filter change) so a focused tag button keeps focus;
 *   the stagger is replayed by restarting the CSS animation instead.
 *
 * Without JavaScript the server HTML shows the unfiltered grid, which is complete.
 */
import Link from 'next/link'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Button, EmptyState, Icon } from '@/components/ui'
import type { Pillar } from '@/lib/content/schema'
import type { GlyphId } from '@/lib/demos/registry'
import { cx } from '@/lib/utils'
import type { PillarOption, ProjectCardData } from '../_lib/model'
import { ProjectCard } from './ProjectCard'

/** Headings for the grouped index (UI furniture; which group comes from content `learning`). */
const GROUPS = [
  { key: 'work', title: 'Work and projects', learning: false },
  { key: 'learning', title: 'Learning builds', learning: true },
] as const

const Q_PILLAR = 'projects'
const Q_TAG = 'projects-tag'

export interface ProjectGridProps {
  projects: ProjectCardData[]
  pillars: PillarOption[]
  /** Cards shown before "Show all" in the unfiltered view (0 = all). */
  limit?: number
  /** Heading level of card titles. */
  headingLevel?: 'h2' | 'h3'
  /** Link shown next to the count, e.g. to the full /projects index. */
  indexHref?: string
  /** Split the list into real work and learning builds, each under its own heading (h2). */
  grouped?: boolean
}

type PillarFilter = Pillar | 'all'

export function ProjectGrid({ projects, pillars, limit = 0, headingLevel = 'h3', indexHref, grouped = false }: ProjectGridProps) {
  const uid = useId()
  const [pillar, setPillar] = useState<PillarFilter>('all')
  const [tag, setTag] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [run, setRun] = useState(0)
  const focusSlug = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  /* read a shared filter once, after hydration (the server always renders "all") */
  useEffect(() => {
    let params: URLSearchParams
    try { params = new URLSearchParams(window.location.search) } catch { return }
    const p = params.get(Q_PILLAR)
    const t = params.get(Q_TAG)
    const validPillar = pillars.some((o) => o.id === p) ? (p as Pillar) : null
    const validTag = t && projects.some((x) => x.tags.includes(t)) ? t : null
    if (!validPillar && !validTag) return
    // one-time sync from the URL after hydration
    if (validPillar) setPillar(validPillar)
    if (validTag) setTag(validTag)
  }, [pillars, projects])

  const writeUrl = useCallback((p: PillarFilter, t: string) => {
    try {
      const url = new URL(window.location.href)
      if (p === 'all') url.searchParams.delete(Q_PILLAR)
      else url.searchParams.set(Q_PILLAR, p)
      if (t) url.searchParams.set(Q_TAG, t)
      else url.searchParams.delete(Q_TAG)
      window.history.replaceState(window.history.state, '', url)
    } catch {
      /* URL sync is a convenience only */
    }
  }, [])

  const byPillar = useMemo(
    () => (pillar === 'all' ? projects : projects.filter((p) => p.pillar === pillar)),
    [projects, pillar],
  )

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of byPillar) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [byPillar])

  const matches = useMemo(() => (tag ? byPillar.filter((p) => p.tags.includes(tag)) : byPillar), [byPillar, tag])

  const filtered = pillar !== 'all' || tag !== ''
  const capped = !filtered && !expanded && limit > 0 && matches.length > limit
  const shown = capped ? matches.slice(0, limit) : matches

  const choosePillar = (next: PillarFilter) => {
    const keepTag = next === 'all' || projects.some((p) => p.pillar === next && p.tags.includes(tag)) ? tag : ''
    setPillar(next)
    setTag(keepTag)
    setRun((n) => n + 1)
    writeUrl(next, keepTag)
  }

  const chooseTag = (next: string) => {
    const value = next === tag ? '' : next
    setTag(value)
    setRun((n) => n + 1)
    writeUrl(pillar, value)
  }

  const clear = () => {
    setPillar('all')
    setTag('')
    setRun((n) => n + 1)
    writeUrl('all', '')
  }

  const showAll = () => {
    focusSlug.current = matches[limit]?.slug ?? null
    setExpanded(true)
  }

  /* move focus to the first card revealed by "Show all" */
  useEffect(() => {
    if (!expanded || !focusSlug.current) return
    document.getElementById(`${uid}-${focusSlug.current}`)?.focus()
    focusSlug.current = null
  }, [expanded, uid])

  /* replay the stagger on every filter change without remounting the cards */
  useLayoutEffect(() => {
    if (run === 0 || !listRef.current) return
    const items = Array.from(listRef.current.querySelectorAll<HTMLElement>('[data-card]'))
    for (const li of items) li.style.animationName = 'none'
    void listRef.current.offsetWidth // one reflow so the animations restart
    for (const li of items) li.style.animationName = ''
  }, [run])

  const activePillarLabel = pillars.find((p) => p.id === pillar)?.label
  const status = [
    `Showing ${shown.length} of ${projects.length} projects`,
    activePillarLabel ? `in ${activePillarLabel}` : '',
    tag ? `tagged ${tag}` : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="grid gap-s5">
      {/* ---------------- filter bar ---------------- */}
      <div className="grid gap-s4 mid:grid-cols-[1fr_auto] mid:items-end">
        {pillars.length > 1 ? (
          // One swipeable row on phones (no stacked chip rows); wraps from 900px.
          <div role="group" aria-label="Filter projects by pillar" className="scroll-x flex gap-2 pb-1 -mb-1 mid:flex-wrap mid:overflow-visible mid:[mask-image:none] [&>*]:shrink-0">
            <PillarButton label="All" count={projects.length} pressed={pillar === 'all'} onClick={() => choosePillar('all')} />
            {pillars.map((o) => (
              <PillarButton
                key={o.id}
                label={o.label}
                count={o.count}
                glyph={o.glyph}
                pressed={pillar === o.id}
                onClick={() => choosePillar(pillar === o.id ? 'all' : o.id)}
              />
            ))}
          </div>
        ) : <span />}

        {tagOptions.length > 1 ? (
          <div className="flex flex-col gap-1 min-w-0 mid:w-64">
            <label htmlFor={`${uid}-tag`} className="mono text-ink-2">Tag</label>
            <div className="relative">
              <select
                id={`${uid}-tag`}
                value={tag}
                onChange={(e) => chooseTag(e.target.value)}
                className={cx(
                  'w-full min-h-tap appearance-none pl-3 pr-9 bg-surface text-ink border border-rule rounded-1',
                  'font-mono text-0 cursor-pointer',
                )}
              >
                <option value="">Any tag</option>
                {tagOptions.map(([t, n]) => (
                  <option key={t} value={t}>{t} ({n})</option>
                ))}
              </select>
              <Icon name="arrow" size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-ink-2" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-rule-soft py-2">
        <p aria-live="polite" className="m-0 mono text-ink-2 nums">{status}</p>
        {filtered ? (
          <button
            type="button"
            onClick={clear}
            className="mono min-h-tap inline-flex items-center gap-1 text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink bg-transparent border-0 p-0 cursor-pointer"
          >
            <Icon name="close" size={12} />
            Clear filters
          </button>
        ) : null}
        {indexHref ? (
          <Link href={indexHref} className="mono min-h-tap inline-flex items-center gap-2 ml-auto text-ink-2 no-underline hover:text-ink">
            Full index
            <Icon name="arrow" size={14} />
          </Link>
        ) : null}
      </div>

      {/* ---------------- grid ---------------- */}
      {shown.length ? (
        <div ref={listRef} className="grid gap-s7">
          {(grouped ? GROUPS.map((g) => ({ ...g, items: shown.filter((p) => p.learning === g.learning) })) : [{ key: 'all', title: '', learning: false, items: shown }])
            .filter((g) => g.items.length)
            .map((g) => (
              <section key={g.key} aria-labelledby={g.title ? `${uid}-${g.key}` : undefined} className="grid gap-s4">
                {g.title ? (
                  <h2 id={`${uid}-${g.key}`} className="mono text-ink-2 font-normal m-0 flex items-baseline gap-3 [font-variation-settings:normal] [font-stretch:100%]">
                    {g.title}
                    <span className="nums text-ink-3">{g.items.length}</span>
                  </h2>
                ) : null}
                <ul className="m-0 p-0 list-none grid gap-s5 md:grid-cols-2 xl:grid-cols-3">
                  {g.items.map((p, i) => (
                    <li
                      key={p.slug}
                      data-card=""
                      className={cx(
                        'min-w-0',
                        run > 0 && 'motion-safe:almanac:animate-[print-in_var(--dur-med)_var(--ease-out)_both] motion-safe:strata:animate-[settle_var(--dur-med)_var(--ease-out)_both]',
                      )}
                      style={run > 0 ? ({ animationDelay: `${Math.min(i, 8) * 60}ms` } as CSSProperties) : undefined}
                    >
                      <ProjectCard
                        project={p}
                        headingLevel={grouped ? 'h3' : headingLevel}
                        onTag={chooseTag}
                        activeTag={tag}
                        titleId={`${uid}-${p.slug}`}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      ) : (
        <EmptyState
          title="No project matches this filter."
          action={<Button variant="secondary" size="sm" onClick={clear}>Clear filters</Button>}
        />
      )}

      {capped ? (
        <div className="flex justify-center">
          <Button variant="secondary" icon="plus" onClick={showAll}>
            Show all {matches.length} projects
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function PillarButton({ label, count, glyph, pressed, onClick }: {
  label: string
  count: number
  glyph?: GlyphId
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-tap items-center gap-2 px-3 border rounded-pill cursor-pointer',
        'font-mono text-00 uppercase tracking-[.08em]',
        'transition-[transform,background-color,color] duration-[var(--dur-fast)] ease-[var(--ease-out)]',
        'almanac:active:translate-x-[2px] almanac:active:translate-y-[2px] strata:active:scale-[.98]',
        pressed
          ? 'bg-ink text-bg border-ink almanac:text-on-accent almanac:shadow-[3px_3px_0_var(--accent-2)]'
          : 'bg-surface text-ink border-rule hover:bg-bg-2',
      )}
    >
      {glyph ? <Icon name={glyph} size={14} /> : null}
      <span>{label}</span>
      <span className={cx('nums', pressed ? 'opacity-80' : 'text-ink-3')}>{count}</span>
    </button>
  )
}
