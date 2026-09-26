'use client'
/** Education, certifications and achievements: short records with optional proof demos. */
import type { Achievement, Certification, EducationItem } from '@/lib/content/schema'
import { Badge } from '@/components/ui'
import { formatPartialDate, formatRange } from '@/lib/utils'
import { SelectField, ToggleField } from '../fields/Choice'
import { DemoSlugsField } from '../fields/Demos'
import { FieldGrid, Group } from '../fields/Group'
import { IdField, ItemMeta } from '../fields/Item'
import { ListField } from '../fields/List'
import { DateField, TextAreaField, TextField } from '../fields/Text'
import { uniqueId } from '../lib/path'
import { ACHIEVEMENT_KINDS, HREF_HINT, meta } from './options'

export function EducationEditor() {
  return (
    <Group title="Education" description="Degrees and schooling. The grade stays hidden unless you fill it in.">
      <ListField<EducationItem>
        path={['items']}
        label="Education"
        hideLabel
        addLabel="Add education"
        itemTitle={(e) => [e.degree, e.institution].filter(Boolean).join(' · ')}
        itemSubtitle={(e) => meta(formatRange(e.start, e.end), e.grade)}
        newItem={(items) => ({ id: uniqueId('new', items.map((i) => i.id)), enabled: true, institution: '', degree: '', start: '', end: '', notes: [] })}
      >
        {(p, item) => (
          <>
            <ItemMeta path={p} kind="entry" />
            <FieldGrid>
              <TextField path={[...p, 'institution']} label="Institution" />
              <TextField path={[...p, 'degree']} label="Degree" />
              <IdField path={[...p, 'id']} listPath={['items']} from={item.institution} />
              <TextField path={[...p, 'field']} label="Field" optional />
              <TextField path={[...p, 'location']} label="Location" optional />
              <TextField path={[...p, 'grade']} label="Grade" optional hint="Leave empty unless verified." />
              <DateField path={[...p, 'start']} label="Start" />
              <DateField path={[...p, 'end']} label="End" present />
            </FieldGrid>
            <ListField<string>
              path={[...p, 'notes']}
              label="Notes"
              collapsible={false}
              addLabel="Add note"
              itemTitle={(s, i) => `Note ${i + 1}`}
              newItem={() => ''}
            >
              {(np) => <TextField path={np} label="Note" />}
            </ListField>
            <DemoSlugsField path={[...p, 'demoSlugs']} optional hint="Optional." />
          </>
        )}
      </ListField>
    </Group>
  )
}

export function CertificationsEditor() {
  return (
    <Group title="Certifications" description="Each certificate can link to its verify page.">
      <ListField<Certification>
        path={['items']}
        label="Certifications"
        hideLabel
        addLabel="Add certification"
        itemTitle={(c) => c.name}
        itemSubtitle={(c) => meta(c.issuer, formatPartialDate(c.date))}
        search={(c) => `${c.name} ${c.issuer}`}
        newItem={(items) => ({ id: uniqueId('new', items.map((i) => i.id)), enabled: true, name: '', issuer: '', date: '' })}
      >
        {(p, item) => (
          <>
            <ItemMeta path={p} kind="certificate" />
            <FieldGrid>
              <TextField path={[...p, 'name']} label="Name" className="col-span-full" />
              <TextField path={[...p, 'issuer']} label="Issuer" />
              <DateField path={[...p, 'date']} label="Date" />
              <TextField path={[...p, 'url']} label="Verify URL" hint={HREF_HINT} optional inputMode="url" mono />
              <TextField path={[...p, 'credentialId']} label="Credential ID" optional mono />
              <IdField path={[...p, 'id']} listPath={['items']} from={item.name} />
            </FieldGrid>
            <DemoSlugsField path={[...p, 'demoSlugs']} optional hint="Optional." />
          </>
        )}
      </ListField>
    </Group>
  )
}

export function AchievementsEditor() {
  return (
    <Group title="Achievements" description="Awards, competitions and talks. One can print as the circular stamp.">
      <ListField<Achievement>
        path={['items']}
        label="Achievements"
        hideLabel
        addLabel="Add achievement"
        itemTitle={(a) => a.title}
        itemSubtitle={(a) => meta(a.kind, formatPartialDate(a.date))}
        itemBadges={(a) => (a.stamp ? <Badge tone="accent">Stamp</Badge> : null)}
        newItem={(items) => ({ id: uniqueId('new', items.map((i) => i.id)), enabled: true, title: '', kind: 'award' })}
      >
        {(p, item) => (
          <>
            <ItemMeta path={p} kind="achievement" />
            <FieldGrid>
              <TextField path={[...p, 'title']} label="Title" className="col-span-full" />
              <SelectField path={[...p, 'kind']} label="Kind" options={ACHIEVEMENT_KINDS} />
              <DateField path={[...p, 'date']} label="Date" optional />
              <TextAreaField path={[...p, 'detail']} label="Detail" optional rows={2} className="col-span-full" />
              <TextField path={[...p, 'url']} label="URL" hint={HREF_HINT} optional inputMode="url" mono />
              <IdField path={[...p, 'id']} listPath={['items']} from={item.title} />
              <ToggleField path={[...p, 'stamp']} label="Print as the circular stamp" removeWhenOff className="col-span-full" />
            </FieldGrid>
            <DemoSlugsField path={[...p, 'demoSlugs']} optional hint="Optional." />
          </>
        )}
      </ListField>
    </Group>
  )
}
