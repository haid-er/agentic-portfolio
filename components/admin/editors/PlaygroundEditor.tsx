'use client'
/**
 * Playground: per-demo visibility, copy overrides and the homepage feature.
 * Demos render in registry order; a demo with no entry in playground.json is
 * shown, so entries are only created when you change something.
 */
import { useState } from 'react'
import { Eye, EyeOff, Search, Sparkles, Smartphone, Monitor } from 'lucide-react'
import { Badge, Button, controlClasses } from '@/components/ui'
import type { Playground, PlaygroundDemo } from '@/lib/content/schema'
import { DEMOS, type DemoMeta } from '@/lib/demos/registry'
import { cx } from '@/lib/utils'
import { useEditor } from '../EditorContext'
import { DemoSelectField } from '../fields/Demos'
import { Group } from '../fields/Group'
import { TagsField } from '../fields/Tags'
import { TextAreaField, TextField } from '../fields/Text'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function PlaygroundEditor() {
  const ed = useEditor()
  const data = ed.data as Playground
  const [q, setQ] = useState('')
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  const entry = (slug: string) => data.demos.findIndex((d) => d.slug === slug)
  const isOn = (slug: string) => { const i = entry(slug); return i === -1 ? true : data.demos[i]!.enabled }

  /** Create the entry on first change, then patch it. */
  const patch = (slug: string, fields: Partial<PlaygroundDemo>) =>
    ed.set(['demos'], (prev: unknown) => {
      const list = (prev as PlaygroundDemo[]).slice()
      const i = list.findIndex((d) => d.slug === slug)
      if (i === -1) list.push({ slug: slug as PlaygroundDemo['slug'], enabled: true, ...fields })
      else list[i] = { ...list[i]!, ...fields }
      return list
    })

  const setMany = (demos: readonly DemoMeta[], enabled: boolean) =>
    ed.set(['demos'], (prev: unknown) => {
      const list = (prev as PlaygroundDemo[]).slice()
      for (const d of demos) {
        const i = list.findIndex((x) => x.slug === d.slug)
        if (i === -1) list.push({ slug: d.slug, enabled })
        else list[i] = { ...list[i]!, enabled }
      }
      return list
    })

  const needle = q.trim().toLowerCase()
  const shown = DEMOS.filter((d) => isOn(d.slug)).length
  const pillars = [...new Set(DEMOS.map((d) => d.pillar))]
  const featuredHidden = !isOn(data.featured)

  return (
    <>
      <Group title="Gallery" description="The intro above the gallery and the specimen card featured on the homepage.">
        <TextAreaField path={['intro']} label="Intro" rows={4} recommend={{ max: 420 }} />
        <DemoSelectField path={['featured']} label="Featured on the homepage"
          hint={featuredHidden ? 'This demo is hidden, so the homepage falls back to the first visible demo.' : 'The specimen card in the homepage playground section.'} />
      </Group>

      <Group
        title="Demos"
        layer={2}
        description="Hidden demos disappear entirely: no card, no page (404), no disabled state."
        aside={<Badge tone="ok">{shown} of {DEMOS.length} shown</Badge>}
      >
        <div className="relative">
          <Search aria-hidden="true" size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by title, slug or skill" aria-label="Filter demos" className={cx(controlClasses, 'pl-9')} />
        </div>

        {pillars.map((pillar) => {
          const demos = DEMOS.filter((d) => d.pillar === pillar && (!needle || `${d.title} ${d.slug} ${d.skills.join(' ')}`.toLowerCase().includes(needle)))
          if (!demos.length) return null
          const allOn = demos.every((d) => isOn(d.slug))
          return (
            <section key={pillar} aria-labelledby={`pg-${pillar}`} className="grid gap-s2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule pb-1">
                <h3 id={`pg-${pillar}`} className="mono m-0 text-ink-2">{cap(pillar)} <span className="text-ink-3">({demos.filter((d) => isOn(d.slug)).length}/{demos.length})</span></h3>
                <Button size="sm" variant="ghost" onClick={() => setMany(demos, !allOn)}>{allOn ? 'Hide all' : 'Show all'}</Button>
              </div>
              <ul className="m-0 p-0 list-none grid gap-s2">
                {demos.map((d) => {
                  const on = isOn(d.slug)
                  const i = entry(d.slug)
                  const o = i === -1 ? undefined : data.demos[i]
                  const custom = Boolean(o?.title || o?.summary || o?.mirrors || o?.skills?.length || o?.mobileNote || o?.limits?.length)
                  const open = openSlug === d.slug
                  return (
                    <li key={d.slug} className={cx('border rounded-1', on ? 'bg-surface border-rule' : 'bg-bg-2 border-rule-soft', i !== -1 && ed.errorsUnder(['demos', i]) > 0 && 'border-danger')}>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 p-2">
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => patch(d.slug, { enabled: !on })}
                          className={cx('inline-flex items-center gap-2 min-h-tap px-2 mono rounded-1 hover:bg-bg-2', on ? 'text-ok' : 'text-ink-3')}
                        >
                          {on ? <Eye aria-hidden="true" size={16} strokeWidth={1.5} /> : <EyeOff aria-hidden="true" size={16} strokeWidth={1.5} />}
                          {on ? 'Shown' : 'Hidden'}
                          <span className="sr-only">: {d.title}</span>
                        </button>
                        <div className="flex-1 min-w-[12rem]">
                          <p className={cx('m-0 font-semibold', !on && 'text-ink-2')}>{o?.title || d.title}</p>
                          <p className="m-0 font-mono text-00 text-ink-3 [overflow-wrap:anywhere]">/playground/{d.slug}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {data.featured === d.slug ? <Badge tone="accent">Featured</Badge> : null}
                          {d.usesAI ? <Badge><Sparkles aria-hidden="true" size={12} strokeWidth={1.5} />AI</Badge> : null}
                          <span className="inline-flex items-center gap-1 mono text-ink-3 px-1" title={d.mobile.ok ? 'Works on phone' : `Best on desktop: ${d.mobile.reason}`}>
                            {d.mobile.ok ? <Smartphone aria-hidden="true" size={14} strokeWidth={1.5} /> : <Monitor aria-hidden="true" size={14} strokeWidth={1.5} />}
                            <span className="sr-only">{d.mobile.ok ? 'Works on phone' : 'Best on desktop'}</span>
                          </span>
                          {custom ? <Badge>Custom copy</Badge> : null}
                          <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => {
                            if (i === -1) patch(d.slug, {})
                            setOpenSlug(open ? null : d.slug)
                          }}>
                            {open ? 'Close' : 'Copy'}
                          </Button>
                        </div>
                      </div>
                      {open && i !== -1 ? (
                        <div className="grid gap-s3 p-s3 pt-0 border-t border-rule-soft">
                          <p className="m-0 pt-s2 text-00 text-ink-3">Leave a field empty to use the registry copy shown as its placeholder.</p>
                          <TextField path={['demos', i, 'title']} label="Title" placeholder={d.title} optional />
                          <TextAreaField path={['demos', i, 'summary']} label="Summary" placeholder={d.summary} optional rows={2} />
                          <TextAreaField path={['demos', i, 'mirrors']} label="Mirrors (real work)" placeholder={d.mirrors} optional rows={2} />
                          <TagsField path={['demos', i, 'skills']} label="Skill tags" optional hint={`Shown as “Also exercises”. Empty = registry tags: ${d.skills.join(', ')}.`} />
                          <TextField path={['demos', i, 'mobileNote']} label="Best-on-desktop reason" optional placeholder={d.mobile.ok ? 'Works on phone' : d.mobile.reason} hint="Fill in to mark the demo “best on desktop” with this reason. Empty = the registry note." />
                          <TagsField path={['demos', i, 'limits']} label="Honest limits" optional hint="Replaces the demo page’s limits list, one item per entry. Empty = the demo’s own notes." />
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </Group>
    </>
  )
}
