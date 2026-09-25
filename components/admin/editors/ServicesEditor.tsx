'use client'
import { useEffect, useState, type ComponentType } from 'react'
import type { Service, Testimonial } from '@/lib/content/schema'
import { useField } from '../EditorContext'
import { DemoSlugsField } from '../fields/Demos'
import { FieldGrid, Group } from '../fields/Group'
import { IdField, ItemMeta } from '../fields/Item'
import { ListField } from '../fields/List'
import { TextAreaField, TextField } from '../fields/Text'
import { uniqueId, type Path } from '../lib/path'
import { HREF_HINT, meta } from './options'

export function ServicesEditor() {
  return (
    <Group title="Services" description="What he can be hired for. Each card carries a Lucide glyph and the demos that prove it.">
      <ListField<Service>
        path={['items']}
        label="Services"
        hideLabel
        addLabel="Add service"
        itemTitle={(s) => s.title}
        itemSubtitle={(s) => meta(s.icon, s.demoSlugs[0] && `→ ${s.demoSlugs[0]}`)}
        newItem={(items) => ({ id: uniqueId('new', items.map((i) => i.id)), enabled: true, title: '', summary: '', icon: '', demoSlugs: [] })}
      >
        {(p, item) => (
          <>
            <ItemMeta path={p} kind="service" />
            <FieldGrid>
              <TextField path={[...p, 'title']} label="Title" />
              <IdField path={[...p, 'id']} listPath={['items']} from={item.title} />
              <TextAreaField path={[...p, 'summary']} label="Summary" className="col-span-full" rows={2} recommend={{ max: 220 }} />
              <IconField path={[...p, 'icon']} />
            </FieldGrid>
            <DemoSlugsField path={[...p, 'demoSlugs']} hint="Optional. The first one is the card’s proof link." />
          </>
        )}
      </ListField>
    </Group>
  )
}

type IconMap = Record<string, ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>>
let iconCache: Promise<IconMap> | null = null
/** Lucide's full icon map, loaded only when this editor opens (admin-only chunk). */
const loadIcons = () => (iconCache ??= import('lucide-react').then((m) => m.icons as unknown as IconMap))

const toPascal = (name: string) =>
  name.trim().split(/[-_\s]+/).filter(Boolean).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('')

function IconField({ path }: { path: Path }) {
  const f = useField<string>(path)
  const [icons, setIcons] = useState<IconMap | null>(null)
  useEffect(() => { void loadIcons().then(setIcons) }, [])
  const key = toPascal(f.value ?? '')
  const Glyph = icons && key ? icons[key] : undefined
  const names = icons ? Object.keys(icons) : []
  return (
    <div className="flex items-end gap-3">
      <TextField path={path} label="Icon (Lucide name)" list="lucide-icon-names" mono className="flex-1"
        hint={Glyph ? 'Preview on the right.' : f.value ? 'Unknown name: the card falls back to its default glyph.' : 'e.g. Workflow, Database, Leaf'} />
      <div className="grid place-items-center flex-none size-[56px] mb-[22px] border border-rule rounded-1 bg-bg-2 text-accent" aria-hidden="true">
        {Glyph ? <Glyph size={28} strokeWidth={1.5} /> : <span className="mono text-ink-3">?</span>}
      </div>
      {names.length ? <datalist id="lucide-icon-names">{names.map((n) => <option key={n} value={n} />)}</datalist> : null}
    </div>
  )
}

export function TestimonialsEditor() {
  return (
    <Group title="Testimonials" description="Real quotes only, with permission. The section hides when none are shown.">
      <ListField<Testimonial>
        path={['items']}
        label="Testimonials"
        hideLabel
        addLabel="Add testimonial"
        emptyText="No testimonials yet: the section stays hidden on the site."
        itemTitle={(t) => t.author ? `${t.author}${t.org ? `, ${t.org}` : ''}` : 'New testimonial'}
        itemSubtitle={(t) => (t.quote ? `“${t.quote.slice(0, 70)}${t.quote.length > 70 ? '…' : ''}”` : undefined)}
        newItem={(items) => ({ id: uniqueId('new', items.map((i) => i.id)), enabled: true, quote: '', author: '' })}
      >
        {(p, item) => (
          <>
            <ItemMeta path={p} kind="testimonial" />
            <TextAreaField path={[...p, 'quote']} label="Quote" rows={4} recommend={{ max: 400 }} />
            <FieldGrid>
              <TextField path={[...p, 'author']} label="Author" />
              <IdField path={[...p, 'id']} listPath={['items']} from={item.author} />
              <TextField path={[...p, 'role']} label="Role" optional />
              <TextField path={[...p, 'org']} label="Organisation" optional />
              <TextField path={[...p, 'url']} label="Link" hint={HREF_HINT} optional inputMode="url" mono className="col-span-full" />
            </FieldGrid>
          </>
        )}
      </ListField>
    </Group>
  )
}
