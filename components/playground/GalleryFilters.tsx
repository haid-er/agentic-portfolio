'use client'
/**
 * Gallery controls: search ("/" focuses it), pillar radio chips with live counts,
 * a skill select grouped by pillar, and "works on phone only". All native
 * controls (radios get arrow keys for free), 44px targets, visible labels.
 */
import { useEffect, useId, useRef } from 'react'
import { Button, Icon, Select, Toggle, controlClasses } from '@/components/ui'
import { cx } from '@/lib/utils'
import type { FilterState, ResolvedSkill } from './filter'
import type { PillarOption, SkillRef } from './model'

export function GalleryFilters({ state, onChange, onClear, pillars, counts, skills, resolved, filtered }: {
  state: FilterState
  onChange: (patch: Partial<FilterState>) => void
  onClear: () => void
  pillars: PillarOption[]
  counts: Record<string, number>
  skills: SkillRef[]
  resolved: ResolvedSkill
  filtered: boolean
}) {
  const searchId = useId()
  const hintId = `${searchId}-hint`
  const search = useRef<HTMLInputElement>(null)

  // "/" jumps to search unless the viewer is already typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      search.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const allCount = Object.values(counts).reduce((a, b) => a + b, 0)
  const selectValue = resolved.kind === 'skill' ? resolved.skill.id : resolved.kind === 'tag' ? `tag:${resolved.key}` : ''

  return (
    <form
      role="search"
      aria-label="Filter demos"
      onSubmit={(e) => e.preventDefault()}
      className="grid gap-s4 border border-rule bg-surface p-s4 rounded-2 strata:border-0 strata:shadow-plate md:p-s5"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={searchId} className="mono text-ink-2">Search demos</label>
        <div className="relative">
          <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            ref={search}
            id={searchId}
            type="search"
            value={state.q}
            onChange={(e) => onChange({ q: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Escape' && state.q) { e.preventDefault(); onChange({ q: '' }) } }}
            placeholder="queue, RAG, Stripe, sensor…"
            autoComplete="off"
            spellCheck={false}
            maxLength={80}
            aria-describedby={hintId}
            className={cx(controlClasses, 'pl-10 pr-12')}
          />
          <kbd aria-hidden="true" className="mono pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 border border-rule-soft px-1.5 text-ink-3 md:inline-block">/</kbd>
        </div>
        <p id={hintId} className="m-0 text-00 text-ink-3">Matches titles, the work each demo mirrors, skills and stack.</p>
      </div>

      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mono mb-1 p-0 text-ink-2">Pillar</legend>
        <div className="flex flex-wrap gap-s2">
          <PillarRadio name={`${searchId}-pillar`} value="all" label="All" count={allCount} checked={state.pillar === 'all'} onSelect={() => onChange({ pillar: 'all' })} />
          {pillars.map((p) => (
            <PillarRadio
              key={p.id}
              name={`${searchId}-pillar`}
              value={p.id}
              label={p.label}
              glyph={p.glyph}
              count={counts[p.id] ?? 0}
              checked={state.pillar === p.id}
              onSelect={() => onChange({ pillar: p.id })}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-s4 md:grid-cols-[minmax(0,22rem)_1fr_auto] md:items-end">
        <Select
          label="Skill"
          value={selectValue}
          onChange={(e) => onChange({ skill: e.target.value.startsWith('tag:') ? state.skill : e.target.value })}
        >
          <option value="">Any skill</option>
          {resolved.kind === 'tag' ? <option value={`tag:${resolved.key}`}>{resolved.label}</option> : null}
          {pillars.map((p) => {
            const group = skills.filter((s) => s.pillar === p.id)
            if (!group.length) return null
            return (
              <optgroup key={p.id} label={p.label}>
                {group.map((s) => (
                  <option key={s.id} value={s.id}>{`${s.name} (${s.slugs.length})`}</option>
                ))}
              </optgroup>
            )
          })}
        </Select>
        <Toggle label="Works on phone only" checked={state.phone} onChange={(v) => onChange({ phone: v })} />
        {filtered ? (
          <Button variant="ghost" size="sm" icon="close" onClick={onClear} className="justify-self-start">
            Clear filters
          </Button>
        ) : null}
      </div>
    </form>
  )
}

function PillarRadio({ name, value, label, glyph, count, checked, onSelect }: {
  name: string
  value: string
  label: string
  glyph?: PillarOption['glyph']
  count: number
  checked: boolean
  onSelect: () => void
}) {
  const empty = count === 0 && !checked
  return (
    <label
      className={cx(
        'relative inline-flex min-h-tap cursor-pointer select-none items-center gap-2 border px-3 rounded-pill',
        'transition-colors duration-[var(--dur-fast)]',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
        checked ? 'border-ink bg-ink text-bg' : 'border-rule bg-surface text-ink hover:bg-bg-2',
        empty && 'opacity-60',
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="sr-only" />
      {glyph ? <Icon name={glyph} size={16} /> : null}
      <span className="text-0 font-semibold">{label}</span>
      <span className={cx('mono nums', checked ? 'text-bg' : 'text-ink-3')}>
        <span className="sr-only">, </span>{count}<span className="sr-only"> demos</span>
      </span>
    </label>
  )
}
