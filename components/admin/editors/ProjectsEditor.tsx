'use client'
import type { Project } from '@/lib/content/schema'
import { formatRange } from '@/lib/utils'
import { Badge } from '@/components/ui'
import { SelectField, ToggleField } from '../fields/Choice'
import { DemoSlugsField } from '../fields/Demos'
import { FieldGrid, Group } from '../fields/Group'
import { ImageField } from '../fields/Image'
import { IdField, ItemMeta } from '../fields/Item'
import { ListField } from '../fields/List'
import { TagsField } from '../fields/Tags'
import { DateField, TextAreaField, TextField } from '../fields/Text'
import { uniqueId } from '../lib/path'
import { HREF_HINT, PILLAR_OPTIONS, meta } from './options'

export function ProjectsEditor() {
  return (
    <Group title="Projects" description="Cards on the homepage and a detail page at /projects/{slug}. Private projects never show their repository link.">
      <ListField<Project>
        path={['items']}
        label="Projects"
        hideLabel
        addLabel="Add project"
        itemTitle={(x) => x.title}
        itemSubtitle={(x) => meta(`/projects/${x.slug}`, x.pillar, x.start ? formatRange(x.start, x.end ?? '') : undefined)}
        itemBadges={(x) => (
          <>
            {x.featured ? <Badge tone="accent">Featured</Badge> : null}
            {x.private ? <Badge>Private</Badge> : null}
          </>
        )}
        search={(x) => `${x.title} ${x.slug} ${x.pillar} ${x.tags.join(' ')} ${x.stack.join(' ')}`}
        newItem={(items) => {
          const id = uniqueId('new', items.map((i) => i.id))
          return { id, slug: id, enabled: true, title: '', summary: '', story: [], pillar: 'fullstack', tags: [], stack: [], links: {}, private: false, featured: false, demoSlugs: [] }
        }}
      >
        {(p, item) => (
          <>
            <ItemMeta path={p} kind="project" />
            <FieldGrid>
              <TextField path={[...p, 'title']} label="Title" />
              <SelectField path={[...p, 'pillar']} label="Pillar" options={PILLAR_OPTIONS} />
              <IdField path={[...p, 'slug']} listPath={['items']} from={item.title} label="URL slug" hint={`Detail page: /projects/${item.slug || '…'}`} />
              <IdField path={[...p, 'id']} listPath={['items']} from={item.title} />
              <TextAreaField path={[...p, 'summary']} label="Summary" className="col-span-full" recommend={{ max: 200 }} rows={2} />
              <TextField path={[...p, 'role']} label="Role" optional />
              <TextField path={[...p, 'outcome']} label="Outcome" optional hint="Only outcomes stated in the sources." />
              <DateField path={[...p, 'start']} label="Start" optional />
              <DateField path={[...p, 'end']} label="End" optional hint="Empty = ongoing" />
              <TextField path={[...p, 'links', 'live']} label="Live URL" hint={HREF_HINT} optional inputMode="url" mono />
              <TextField path={[...p, 'links', 'repo']} label="Repository URL" hint={item.private ? 'Private: this link is never rendered.' : HREF_HINT} optional inputMode="url" mono />
              <ToggleField path={[...p, 'private']} label="Private repository" hint="Hides the repo link everywhere." />
              <ToggleField path={[...p, 'featured']} label="Featured" hint="Larger card, listed first." />
            </FieldGrid>
            <ListField<string>
              path={[...p, 'story']}
              label="Story"
              hint="Paragraphs for the detail page, in reading order."
              collapsible={false}
              addLabel="Add paragraph"
              itemTitle={(s, i) => `Paragraph ${i + 1}`}
              newItem={() => ''}
            >
              {(sp) => <TextAreaField path={sp} label="Paragraph" rows={3} />}
            </ListField>
            <FieldGrid>
              <TagsField path={[...p, 'tags']} label="Tags" />
              <TagsField path={[...p, 'stack']} label="Stack" />
              <div className="col-span-full"><DemoSlugsField path={[...p, 'demoSlugs']} hint="Optional. Demos that mirror this project." /></div>
              <div className="col-span-full"><ImageField path={[...p, 'image']} label="Cover image" /></div>
            </FieldGrid>
          </>
        )}
      </ListField>
    </Group>
  )
}
