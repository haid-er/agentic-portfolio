'use client'
/**
 * /playground gallery: search, pillar + skill filters, "works on phone", and a
 * skill landing banner (?skill=x). State lives in the URL (replaceState) so any
 * filtered view can be shared. Cards are grouped by pillar, in profile order.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, EmptyState, Icon } from '@/components/ui'
import type { DemoCardModel, PillarOption, SkillRef } from './model'
import {
  applyFilters, baseFilter, EMPTY, filtersToQuery, isFiltered, parseFilters, resolveSkill, type FilterState,
} from './filter'
import { GalleryFilters } from './GalleryFilters'
import { SkillBanner } from './SkillBanner'
import { SpecimenCard } from './SpecimenCard'
import { ProvesRow } from './ProvesRow'

export interface GalleryProps {
  cards: DemoCardModel[]
  pillars: PillarOption[]
  skills: SkillRef[]
  /** Current query string (from useSearchParams); '' during prerender. */
  urlQuery?: string
}

export function Gallery({ cards, pillars, skills, urlQuery = '' }: GalleryProps) {
  const pillarIds = useMemo(() => pillars.map((p) => p.id), [pillars])
  const [f, setF] = useState<FilterState>(() => parseFilters(new URLSearchParams(urlQuery), pillarIds))
  const written = useRef(filtersToQuery(f))
  const bannerRef = useRef<HTMLHeadingElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Soft navigations to /playground?skill=… while mounted: adopt the new URL.
  useEffect(() => {
    const incoming = urlQuery ? `?${urlQuery}` : ''
    if (incoming === written.current) return
    const next = parseFilters(new URLSearchParams(urlQuery), pillarIds)
    written.current = filtersToQuery(next)
    setF(next)
  }, [urlQuery, pillarIds])

  /** Set state and mirror it in the URL (replaceState: no history spam). Only viewer actions write. */
  const commit = useCallback((next: FilterState) => {
    setF(next)
    const qs = filtersToQuery(next)
    written.current = qs
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs}`)
  }, [])

  const update = useCallback((patch: Partial<FilterState>) => commit({ ...f, ...patch }), [commit, f])
  const clear = useCallback(() => commit(EMPTY), [commit])

  const resolved = useMemo(() => resolveSkill(f.skill, skills, cards), [f.skill, skills, cards])
  const base = useMemo(() => baseFilter(cards, f, resolved), [cards, f, resolved])
  const shown = useMemo(() => applyFilters(cards, f, resolved), [cards, f, resolved])
  const skillCount = useMemo(() => applyFilters(cards, { ...EMPTY, skill: f.skill }, resolved).length, [cards, f.skill, resolved])
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of base) m[c.pillar] = (m[c.pillar] ?? 0) + 1
    return m
  }, [base])

  const groups = useMemo(
    () => pillars.map((p) => ({ pillar: p, cards: shown.filter((c) => c.pillar === p.id) })).filter((g) => g.cards.length),
    [pillars, shown],
  )

  /** A chip on a card: land on that skill, keep the viewer oriented. */
  const pickSkill = useCallback((id: string) => {
    commit({ ...EMPTY, phone: f.phone, skill: f.skill === id ? '' : id })
    requestAnimationFrame(() => {
      const target = bannerRef.current ?? resultsRef.current
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    })
  }, [commit, f.phone, f.skill])

  const activeSkillId = resolved.kind === 'skill' ? resolved.skill.id : ''
  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills])
  const total = cards.length

  return (
    <div className="grid gap-s6">
      <GalleryFilters
        state={f}
        onChange={update}
        onClear={clear}
        pillars={pillars}
        counts={counts}
        skills={skills}
        resolved={resolved}
        filtered={isFiltered(f)}
      />

      {resolved.kind !== 'none' ? (
        <SkillBanner
          ref={bannerRef}
          resolved={resolved}
          count={skillCount}
          pillarLabel={resolved.kind === 'skill' ? pillars.find((p) => p.id === resolved.skill.pillar)?.label : undefined}
          onClear={() => update({ skill: '' })}
        />
      ) : null}

      <div ref={resultsRef} tabIndex={-1} className="grid gap-s7 scroll-mt-24 outline-none">
        <p className="mono m-0 text-ink-2" role="status" aria-live="polite">
          {shown.length === total ? `${total} demos` : `Showing ${shown.length} of ${total} demos`}
        </p>

        {groups.length ? (
          groups.map(({ pillar, cards: list }, gi) => (
            <section key={pillar.id} aria-labelledby={`group-${pillar.id}`} className="grid gap-s5">
              <header className="grid gap-s2 almanac:border-t-2 almanac:border-rule almanac:pt-s4 md:grid-cols-[auto_1fr] md:items-end md:gap-s5">
                <span aria-hidden="true" className="display text-4 text-accent-ink almanac:font-light strata:text-accent-2 nums">
                  {String(gi + 1).padStart(2, '0')}
                </span>
                <div className="grid gap-s1">
                  <h2 id={`group-${pillar.id}`} className="flex flex-wrap items-center gap-s3 text-[clamp(1.8rem,5vw,2.75rem)]">
                    <Icon name={pillar.glyph} size={28} className="text-accent-ink" />
                    {pillar.label}
                  </h2>
                  <p className="mono m-0 text-ink-3">
                    {list.length} {list.length === 1 ? 'specimen' : 'specimens'}
                  </p>
                </div>
                {pillar.summary && !isFiltered(f) ? (
                  <p className="m-0 measure text-0 text-ink-2 md:col-span-2">{pillar.summary}</p>
                ) : null}
              </header>
              <ul className="m-0 grid list-none gap-s5 p-0 md:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => (
                  <li key={c.slug} className="min-w-0">
                    <SpecimenCard
                      card={c}
                      headingLevel="h3"
                      live={c.poster === 'pulse'}
                      proves={
                        c.proves.length ? (
                          <ProvesRow
                            proves={c.proves}
                            activeId={activeSkillId}
                            layer={c.layer}
                            countFor={(id) => skillById.get(id)?.slugs.length ?? 0}
                            onPick={pickSkill}
                          />
                        ) : null
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <EmptyState
            title={resolved.kind === 'unknown' ? `No demo proves “${resolved.raw}” yet` : 'Nothing matches these filters'}
            action={<Button variant="secondary" size="sm" icon="refresh" onClick={clear}>Show every demo</Button>}
          >
            Try a shorter search, another pillar, or clear the filters.
          </EmptyState>
        )}
      </div>
    </div>
  )
}
