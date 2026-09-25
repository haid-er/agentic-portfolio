'use client'
/**
 * site.sections: homepage order and visibility. Drag, arrow keys or the
 * up/down buttons reorder; the eye hides. Folio numbers follow the visible
 * order exactly as the homepage prints them.
 */
import { Badge } from '@/components/ui'
import { SECTION_IDS, type Section } from '@/lib/content/schema'
import { folio } from '@/lib/utils'
import { useEditor } from '../EditorContext'
import { Group } from '../fields/Group'
import { ListField } from '../fields/List'
import { TextField } from '../fields/Text'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function SectionsEditor() {
  const ed = useEditor()
  const sections = ((ed.data as { sections?: Section[] }).sections ?? [])
  const visible = sections.filter((s) => s.enabled)
  const missing = SECTION_IDS.filter((id) => !sections.some((s) => s.id === id))
  const folioOf = (id: string) => {
    const i = visible.findIndex((s) => s.id === id)
    return i === -1 ? null : folio(i + 1)
  }

  return (
    <div className="grid gap-s5 lg:grid-cols-[minmax(0,1fr)_16rem] items-start">
      <Group id="sections" title="Homepage sections" description="Order here is render order. Hidden sections vanish from the page, the navigation and the contents sheet.">
        <ListField<Section>
          path={['sections']}
          label="Sections"
          hideLabel
          removable={false}
          addable={missing.length > 0}
          addLabel={missing.length ? `Add missing: ${missing[0]}` : 'Add'}
          itemTitle={(s) => s.title || cap(s.id)}
          itemSubtitle={(s) => `#${s.id}${s.navLabel ? ` · nav “${s.navLabel}”` : ''}`}
          itemBadges={(s) => {
            const f = folioOf(s.id)
            return f ? <Badge tone="accent">Folio {f}</Badge> : null
          }}
          newItem={() => ({ id: missing[0]!, enabled: false, title: '' })}
        >
          {(p, item) => (
            <div className="grid gap-s4 md:grid-cols-2">
              <TextField path={[...p, 'title']} label="Heading" hint={item.id === 'hero' ? 'The hero prints the name instead; usually empty.' : 'Empty = the section’s default heading.'} className="md:col-span-2" />
              <TextField path={[...p, 'navLabel']} label="Nav label" optional hint="Short label for the header and contents sheet. Empty = heading." />
              <TextField path={[...p, 'note']} label="Note" optional hint="One line under the heading." />
            </div>
          )}
        </ListField>
      </Group>

      <aside aria-labelledby="page-map-h" className="lg:sticky lg:top-s4 grid gap-2 p-s4 bg-bg-2 border border-rule rounded-1">
        <h2 id="page-map-h" className="mono m-0 text-ink-2">Page map</h2>
        <p className="m-0 text-00 text-ink-3">{visible.length} of {sections.length} sections print.</p>
        <ol className="m-0 p-0 list-none grid">
          {sections.map((s) => {
            const f = folioOf(s.id)
            return (
              <li key={s.id} className="flex items-baseline gap-2 py-1 border-b border-dotted border-rule-soft last:border-0 text-0">
                <span className="display text-1 w-7 text-accent-ink nums">{f ?? '—'}</span>
                <span className={f ? 'text-ink' : 'text-ink-3 line-through'}>{s.navLabel || s.title || cap(s.id)}</span>
                {!f ? <span className="sr-only">(hidden)</span> : null}
              </li>
            )
          })}
        </ol>
      </aside>
    </div>
  )
}
