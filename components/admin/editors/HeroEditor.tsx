'use client'
/** site.hero + site.about: the first screen and the about text. */
import type { Cta } from '@/lib/content/schema'
import { SegmentedField, ToggleField } from '../fields/Choice'
import { FieldGrid, Group } from '../fields/Group'
import { ListField } from '../fields/List'
import { MarkdownField } from '../fields/Markdown'
import { TagsField } from '../fields/Tags'
import { TextAreaField, TextField } from '../fields/Text'
import { CTA_VARIANTS, HREF_HINT } from './options'

export function HeroEditor() {
  return (
    <>
      <Group id="hero" title="Hero" description="The first screen: kicker, role line, lede with the drop cap, calls to action and the core-sample plate.">
        <TagsField path={['hero', 'kicker']} label="Kicker" hint="Short fragments, printed as “A / B / C” in mono." />
        <MarkdownField path={['hero', 'role']} label="Role line" display />
        <TextAreaField path={['hero', 'lede']} label="Lede" rows={5} hint="Gets the three-line drop cap." recommend={{ min: 140, max: 520 }} />
        <ListField<Cta>
          path={['hero', 'ctas']}
          label="Calls to action"
          hint="Keep one primary. The first button gets focus order priority."
          collapsible={false}
          addLabel="Add button"
          max={4}
          itemTitle={(c) => c.label || 'New button'}
          newItem={() => ({ label: '', href: '', variant: 'secondary' })}
        >
          {(cp) => (
            <div className="grid gap-s3 md:grid-cols-[1fr_1fr_auto] items-start">
              <TextField path={[...cp, 'label']} label="Label" />
              <TextField path={[...cp, 'href']} label="Link" hint={HREF_HINT} mono />
              <SegmentedField path={[...cp, 'variant']} label="Style" options={CTA_VARIANTS} />
            </div>
          )}
        </ListField>
        <FieldGrid>
          <TextField path={['hero', 'plateTitle']} label="Plate title" />
          <TextField path={['hero', 'plateNote']} label="Plate note" />
        </FieldGrid>
        <ListField<string>
          path={['hero', 'plateLayers']}
          label="Core-sample layers"
          hint="Ordered collection:id refs, e.g. experience:acme, project:my-app, education:bs-cs, research:my-paper. The plate sorts them by date. Empty = every enabled role, education and research item plus featured projects."
          collapsible={false}
          addLabel="Add layer"
          max={12}
          itemTitle={(s, i) => s || `Layer ${i + 1}`}
          newItem={() => ''}
        >
          {(lp) => <TextField path={lp} label="Ref (collection:id)" mono />}
        </ListField>
        <ToggleField path={['hero', 'showGridReading']} label="Show the live UK grid-carbon reading" hint="Fetched from carbonintensity.org.uk; shows “Feed unavailable. Nothing is estimated.” on failure." />
      </Group>

      <Group id="about" title="About" layer={2} description="Paragraphs in reading order.">
        <ListField<string>
          path={['about', 'body']}
          label="Paragraphs"
          hideLabel
          collapsible={false}
          addLabel="Add paragraph"
          itemTitle={(s, i) => `Paragraph ${i + 1}`}
          newItem={() => ''}
        >
          {(bp) => <TextAreaField path={bp} label="Paragraph" rows={4} />}
        </ListField>
      </Group>
    </>
  )
}
