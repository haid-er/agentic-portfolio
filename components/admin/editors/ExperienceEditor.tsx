'use client'
import type { ExperienceItem, Highlight } from '@/lib/content/schema'
import { formatRange } from '@/lib/utils'
import { useField } from '../EditorContext'
import { SelectField } from '../fields/Choice'
import { DemoSelectField } from '../fields/Demos'
import { FieldGrid, Group } from '../fields/Group'
import { IdField, ItemMeta } from '../fields/Item'
import { ListField } from '../fields/List'
import { TagsField } from '../fields/Tags'
import { DateField, TextAreaField, TextField } from '../fields/Text'
import { uniqueId, type Path } from '../lib/path'
import { HREF_HINT, MODE_OPTIONS, meta } from './options'

export function ExperienceEditor() {
  return (
    <Group title="Working record" description="Newest first. Each role ends in a Proof row built from its highlights.">
      <ListField<ExperienceItem>
        path={['items']}
        label="Roles"
        hideLabel
        addLabel="Add role"
        itemTitle={(r) => [r.role, r.org].filter(Boolean).join(' · ')}
        itemSubtitle={(r) => meta(formatRange(r.start, r.end), r.mode || undefined)}
        search={(r) => `${r.role} ${r.org} ${r.product ?? ''} ${r.stack.join(' ')}`}
        newItem={(items) => ({ id: uniqueId('new', items.map((i) => i.id)), enabled: true, role: '', org: '', start: '', end: '', highlights: [], stack: [] })}
      >
        {(p, item) => (
          <>
            <ItemMeta path={p} kind="role" />
            <FieldGrid>
              <TextField path={[...p, 'role']} label="Role" />
              <TextField path={[...p, 'org']} label="Organisation" />
              <IdField path={[...p, 'id']} listPath={['items']} from={item.org} />
              <TextField path={[...p, 'orgUrl']} label="Organisation URL" hint={HREF_HINT} optional inputMode="url" mono />
              <TextField path={[...p, 'product']} label="Product / client" optional />
              <TextField path={[...p, 'location']} label="Location" optional />
              <SelectField path={[...p, 'mode']} label="Work mode" options={MODE_OPTIONS} empty="Not stated" />
              <div className="hidden md:block" />
              <DateField path={[...p, 'start']} label="Start" />
              <DateField path={[...p, 'end']} label="End" present />
              <TextAreaField path={[...p, 'summary']} label="Summary" optional className="col-span-full" recommend={{ max: 320 }} />
            </FieldGrid>
            <ListField<Highlight>
              path={[...p, 'highlights']}
              label="Highlights"
              hint="2–4 bullets. Each can link the demo that proves it."
              collapsible={false}
              addLabel="Add highlight"
              itemTitle={(h, i) => h.proofDemo ? `Bullet ${i + 1} → ${h.proofDemo}` : `Bullet ${i + 1}`}
              newItem={() => ({ text: '' })}
            >
              {(hp) => (
                <div className="grid gap-s3 md:grid-cols-[1fr_16rem]">
                  <TextAreaField path={[...hp, 'text']} label="Text" rows={2} />
                  <DemoSelectField path={[...hp, 'proofDemo']} label="Proof demo" optional />
                </div>
              )}
            </ListField>
            <TagsField path={[...p, 'stack']} label="Stack" />
            <MetricField path={[...p, 'metric']} />
          </>
        )}
      </ListField>
    </Group>
  )
}

/** The one allowed metric (DESIGN.md 6.4): only numbers that exist in the sources. */
function MetricField({ path }: { path: Path }) {
  const f = useField<ExperienceItem['metric']>(path)
  const on = f.value !== undefined
  return (
    <fieldset className="m-0 p-s3 border border-rule-soft rounded-1 grid gap-s3">
      <legend className="mono text-ink-2 px-1">Metric</legend>
      <label className="inline-flex items-center gap-3 min-h-tap text-0 cursor-pointer">
        <input type="checkbox" checked={on} onChange={(e) => f.set(e.target.checked ? { from: '', to: '', label: '' } : undefined)} className="size-5 accent-[var(--accent)]" />
        Show a before → after metric for this role
      </label>
      {on ? (
        <>
          <div className="grid gap-s3 grid-cols-2 md:grid-cols-[8rem_8rem_1fr]">
            <TextField path={[...path, 'from']} label="From" placeholder="27s" mono />
            <TextField path={[...path, 'to']} label="To" placeholder="3.5s" mono />
            <TextField path={[...path, 'label']} label="Label" className="col-span-2 md:col-span-1" />
          </div>
          <p className="m-0 text-00 text-warn">Only use a figure that appears in the source documents. Never estimate one.</p>
        </>
      ) : null}
    </fieldset>
  )
}
