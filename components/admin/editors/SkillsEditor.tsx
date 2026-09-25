'use client'
import type { Skill } from '@/lib/content/schema'
import { SegmentedField, SelectField } from '../fields/Choice'
import { DemoSlugsField } from '../fields/Demos'
import { FieldGrid, Group } from '../fields/Group'
import { IdField, ItemMeta } from '../fields/Item'
import { ListField } from '../fields/List'
import { TagsField } from '../fields/Tags'
import { TextField } from '../fields/Text'
import { uniqueId } from '../lib/path'
import { LEVEL_OPTIONS, PILLAR_OPTIONS, meta } from './options'

export function SkillsEditor() {
  return (
    <Group title="Skill → proof chips" description="Every skill maps to at least one working demo. Levels are self-assessed bands, never percentages.">
      <ListField<Skill>
        path={['items']}
        label="Skills"
        hideLabel
        addLabel="Add skill"
        itemTitle={(s) => s.name}
        itemSubtitle={(s) => meta(s.pillar, s.level, s.demoSlugs[0] && `→ ${s.demoSlugs[0]}${s.demoSlugs.length > 1 ? ` +${s.demoSlugs.length - 1}` : ''}`)}
        search={(s) => `${s.name} ${s.pillar} ${s.level} ${s.demoSlugs.join(' ')} ${(s.keywords ?? []).join(' ')}`}
        newItem={(items) => ({ id: uniqueId('new', items.map((i) => i.id)), enabled: true, name: '', pillar: 'fullstack', level: 'working', demoSlugs: [] })}
      >
        {(p, item) => (
          <>
            <ItemMeta path={p} kind="skill" />
            <FieldGrid>
              <TextField path={[...p, 'name']} label="Skill name" />
              <IdField path={[...p, 'id']} listPath={['items']} from={item.name} />
              <SelectField path={[...p, 'pillar']} label="Pillar" options={PILLAR_OPTIONS} />
              <SegmentedField path={[...p, 'level']} label="Level" options={LEVEL_OPTIONS} />
              <div className="col-span-full"><DemoSlugsField path={[...p, 'demoSlugs']} /></div>
              <TagsField path={[...p, 'keywords']} label="Keywords" hint="Search aliases for the command palette and filters. Optional." optional className="col-span-full" />
            </FieldGrid>
          </>
        )}
      </ListField>
    </Group>
  )
}
