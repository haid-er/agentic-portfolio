'use client'
/**
 * Proof-demo pickers (every claim ends in a "Proof: demo-slug" link).
 * - DemoSlugsField: ordered multi-pick; the first slug is the primary proof chip.
 * - DemoSelectField: one slug (highlight proof, featured demo, pipeline demo).
 */
import { useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, X } from 'lucide-react'
import { Icon, controlClasses } from '@/components/ui'
import { DEMOS, type DemoMeta } from '@/lib/demos/registry'
import { cx } from '@/lib/utils'
import { useField } from '../EditorContext'
import type { Path } from '../lib/path'
import { SelectField, type Option } from './Choice'
import { FieldFrame } from './Frame'

const BY_SLUG = new Map(DEMOS.map((d) => [d.slug as string, d]))
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const DEMO_OPTIONS: Option[] = DEMOS.map((d) => ({ value: d.slug, label: `${d.title} (${d.slug})`, group: cap(d.pillar) }))

export function demoTitle(slug: string | undefined): string {
  return (slug && BY_SLUG.get(slug)?.title) || slug || ''
}

export function DemoSelectField({ path, label, hint, optional, options = DEMO_OPTIONS }: {
  path: Path
  label: string
  hint?: ReactNode
  optional?: boolean
  options?: Option[]
}) {
  return <SelectField path={path} label={label} hint={hint} options={options} empty={optional ? 'No proof demo' : undefined} />
}

export function DemoSlugsField({ path, label = 'Proof demos', hint, optional }: {
  path: Path
  label?: string
  hint?: ReactNode
  /** Empty list removes the key (optional arrays). */
  optional?: boolean
}) {
  const f = useField<string[] | undefined>(path)
  const selected = f.value ?? []
  const [q, setQ] = useState('')
  const commit = (next: string[]) => f.set(optional && next.length === 0 ? undefined : next)
  const toggle = (slug: string) => commit(selected.includes(slug) ? selected.filter((s) => s !== slug) : [...selected, slug])

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const hit = (d: DemoMeta) => !needle || `${d.title} ${d.slug} ${d.skills.join(' ')} ${d.pillar}`.toLowerCase().includes(needle)
    const map = new Map<string, DemoMeta[]>()
    for (const d of DEMOS) if (hit(d)) map.set(d.pillar, [...(map.get(d.pillar) ?? []), d])
    return [...map.entries()]
  }, [q])

  return (
    <FieldFrame as="fieldset" label={label} error={f.error} changed={f.changed}
      hint={hint ?? 'The first one is the primary proof chip; the rest show as “+n”.'}
      aside={`${selected.length} picked`}
    >
      {({ describedBy }) => (
        <div className="grid gap-2" data-path={f.key} tabIndex={-1} aria-describedby={describedBy}>
          {selected.length ? (
            <ol className="m-0 p-0 list-none flex flex-wrap gap-2">
              {selected.map((slug, i) => (
                <li key={slug} className="inline-flex items-stretch max-w-full bg-bg-2 border border-rule rounded-1 text-0">
                  <span className="flex flex-col justify-center px-2 py-1 min-w-0">
                    <span className="font-semibold [overflow-wrap:anywhere]">{demoTitle(slug)}</span>
                    <span className="font-mono text-00 text-accent-ink">→ {slug}{i === 0 ? ' · primary' : ''}</span>
                  </span>
                  {i > 0 ? (
                    <button type="button" aria-label={`Move ${slug} earlier`} onClick={() => commit(swap(selected, i, i - 1))}
                      className="grid place-items-center w-[36px] border-l border-rule-soft text-ink-3 hover:text-ink">
                      <ArrowLeft aria-hidden="true" size={14} strokeWidth={1.5} />
                    </button>
                  ) : null}
                  <button type="button" aria-label={`Remove ${slug}`} onClick={() => toggle(slug)}
                    className="grid place-items-center w-[40px] border-l border-rule-soft text-ink-3 hover:text-danger">
                    <X aria-hidden="true" size={15} strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-0 text-0 text-ink-3">No proof demo picked.</p>
          )}
          <details className="group border border-rule rounded-1 bg-surface">
            <summary className="min-h-tap px-3 flex items-center gap-2 cursor-pointer mono text-ink-2 list-none [&::-webkit-details-marker]:hidden">
              <Icon name="plus" size={16} className="group-open:rotate-45 motion-safe:transition-transform" />
              Pick proof demos
            </summary>
            <div className="grid gap-2 p-3 pt-0">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, slug or skill" aria-label="Search demos" className={controlClasses} />
              <div className="grid gap-3 max-h-[22rem] overflow-y-auto overscroll-contain pr-1">
                {groups.length === 0 ? <p className="m-0 text-0 text-ink-3">No demo matches “{q}”.</p> : null}
                {groups.map(([pillar, demos]) => (
                  <fieldset key={pillar} className="m-0 p-0 border-0 grid gap-1">
                    <legend className="mono text-ink-3 mb-1">{cap(pillar)}</legend>
                    {demos.map((d) => {
                      const on = selected.includes(d.slug)
                      return (
                        <label key={d.slug} className={cx('flex items-start gap-3 min-h-tap px-2 py-2 rounded-1 cursor-pointer hover:bg-bg-2', on && 'bg-bg-2')}>
                          <input type="checkbox" checked={on} onChange={() => toggle(d.slug)} className="mt-1 size-5 flex-none accent-[var(--accent)]" />
                          <span className="grid min-w-0">
                            <span className="text-0 font-semibold">{d.title}</span>
                            <span className="font-mono text-00 text-ink-3 [overflow-wrap:anywhere]">{d.slug}</span>
                          </span>
                        </label>
                      )
                    })}
                  </fieldset>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}
    </FieldFrame>
  )
}

function swap<T>(xs: T[], a: number, b: number): T[] {
  const c = xs.slice()
  ;[c[a], c[b]] = [c[b] as T, c[a] as T]
  return c
}
