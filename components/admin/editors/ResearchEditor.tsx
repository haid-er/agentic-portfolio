'use client'
import type { ResearchItem } from '@/lib/content/schema'
import { ToggleField } from '../fields/Choice'
import { DemoSelectField, DemoSlugsField } from '../fields/Demos'
import { FieldGrid, Group } from '../fields/Group'
import { IdField, ItemMeta } from '../fields/Item'
import { ListField } from '../fields/List'
import { NumberField, TextAreaField, TextField } from '../fields/Text'
import { uniqueId } from '../lib/path'
import { HREF_HINT, meta } from './options'

type Result = ResearchItem['results'][number]

export function ResearchEditor() {
  return (
    <>
      <Group title="Publications" description="Authorship shows as “2nd of 5 authors”. Never list co-author names.">
        <ListField<ResearchItem>
          path={['items']}
          label="Publications"
          hideLabel
          addLabel="Add publication"
          itemTitle={(r) => r.title}
          itemSubtitle={(r) => meta(r.venue, r.year, r.authorPosition && r.authorCount ? `author ${r.authorPosition} of ${r.authorCount}` : undefined)}
          search={(r) => `${r.title} ${r.venue} ${r.year}`}
          newItem={(items) => ({ id: uniqueId('new', items.map((i) => i.id)), enabled: true, title: '', venue: '', year: '', results: [], demoSlugs: [] })}
        >
          {(p, item) => (
            <>
              <ItemMeta path={p} kind="publication" />
              <FieldGrid>
                <TextAreaField path={[...p, 'title']} label="Title" className="col-span-full" rows={2} />
                <IdField path={[...p, 'id']} listPath={['items']} from={item.title} />
                <TextField path={[...p, 'venue']} label="Journal / venue" />
                <TextField path={[...p, 'volume']} label="Volume" optional />
                <TextField path={[...p, 'article']} label="Article / pages" optional />
                <TextField path={[...p, 'year']} label="Year" inputMode="numeric" mono />
                <TextField path={[...p, 'doi']} label="DOI" optional mono placeholder="10.1007/…" />
                <TextField path={[...p, 'url']} label="Paper URL" hint={HREF_HINT} optional inputMode="url" mono />
                <div className="grid grid-cols-2 gap-s3">
                  <NumberField path={[...p, 'authorPosition']} label="Author position" optional min={1} />
                  <NumberField path={[...p, 'authorCount']} label="Author count" optional min={1} />
                </div>
                <TextAreaField path={[...p, 'abstract']} label="Abstract" optional rows={4} className="col-span-full" />
              </FieldGrid>
              <ListField<Result>
                path={[...p, 'results']}
                label="Reported results"
                hint="Values exactly as reported in the paper. They render as accuracy meters."
                collapsible={false}
                addLabel="Add result"
                itemTitle={(r) => r.label ? `${r.label}: ${Number.isFinite(r.value) ? r.value : '…'}${r.unit}` : 'New result'}
                newItem={() => ({ label: '', value: 0, unit: '%' })}
              >
                {(rp) => (
                  <div className="grid gap-s3 grid-cols-2 md:grid-cols-[1fr_10rem_6rem_1fr]">
                    <TextField path={[...rp, 'label']} label="Label" className="col-span-2 md:col-span-1" />
                    <NumberField path={[...rp, 'value']} label="Value" step={0.01} />
                    <TextField path={[...rp, 'unit']} label="Unit" mono />
                    <TextField path={[...rp, 'note']} label="Note" optional className="col-span-2 md:col-span-1" />
                  </div>
                )}
              </ListField>
              <TextField path={[...p, 'resultsCaption']} label="Results caption" optional placeholder="average accuracy as reported in the paper" />
              <TextAreaField path={[...p, 'bibtex']} label="BibTeX" optional mono rows={5} />
              <DemoSlugsField path={[...p, 'demoSlugs']} hint="Optional. Demos related to this paper." />
            </>
          )}
        </ListField>
      </Group>

      <Group title="Neighbouring pipeline" description="Shown next to the paper as related work, never as the paper’s own pipeline." layer={2}>
        <ToggleField path={['pipeline', 'enabled']} label="Show the pipeline block" />
        <FieldGrid>
          <TextField path={['pipeline', 'title']} label="Title" />
          <DemoSelectField path={['pipeline', 'demoSlug']} label="Proof demo" optional />
          <TextAreaField path={['pipeline', 'note']} label="Note" className="col-span-full" rows={2} />
        </FieldGrid>
        <ListField<string>
          path={['pipeline', 'steps']}
          label="Steps"
          collapsible={false}
          addLabel="Add step"
          itemTitle={(s, i) => `Step ${i + 1}`}
          newItem={() => ''}
        >
          {(sp) => <TextField path={sp} label="Step" />}
        </ListField>
      </Group>
    </>
  )
}
