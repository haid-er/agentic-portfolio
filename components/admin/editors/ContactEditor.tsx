'use client'
/** site.contact, socials, form endpoint and masthead furniture. */
import type { Social } from '@/lib/content/schema'
import { Icon, socialIcon } from '@/components/ui'
import { ToggleField } from '../fields/Choice'
import { FieldGrid, Group } from '../fields/Group'
import { IdField, ItemMeta } from '../fields/Item'
import { ListField } from '../fields/List'
import { TextAreaField, TextField } from '../fields/Text'
import { uniqueId } from '../lib/path'
import { HREF_HINT } from './options'

export function ContactEditor() {
  return (
    <>
      <Group id="contact" title="Contact" description="The closing section. Without a form endpoint, visitors get a mailto link.">
        <TextAreaField path={['contact', 'blurb']} label="Blurb" rows={3} recommend={{ max: 280 }} />
        <TextField path={['contact', 'availability']} label="Availability" optional hint="Optional, e.g. open to remote roles. Empty hides it." />
        <ToggleField path={['contact', 'formEnabled']} label="Show the contact form" hint="Needs the form endpoint below; otherwise the mailto fallback is used." />
        <TextField path={['contactFormEndpoint']} label="Form endpoint" hint="Web3Forms or Formspree URL. Empty = mailto only." inputMode="url" mono />
      </Group>

      <Group id="socials" title="Social links" layer={2} description="Header, contents sheet, footer and the Person structured data.">
        <ListField<Social>
          path={['socials']}
          label="Socials"
          hideLabel
          addLabel="Add link"
          itemTitle={(s) => s.label || 'New link'}
          itemSubtitle={(s) => s.handle || s.url}
          itemBadges={(s) => <Icon name={socialIcon(s.icon || s.id)} size={18} className="text-ink-2 mx-1" />}
          newItem={(items) => ({ id: uniqueId('new', items.map((i) => i.id)), enabled: true, label: '', url: '' })}
        >
          {(p, item) => (
            <>
              <ItemMeta path={p} kind="link" />
              <FieldGrid>
                <TextField path={[...p, 'label']} label="Label" />
                <IdField path={[...p, 'id']} listPath={['socials']} from={item.label} />
                <TextField path={[...p, 'url']} label="URL" hint={HREF_HINT} inputMode="url" mono className="col-span-full" />
                <TextField path={[...p, 'handle']} label="Handle" optional placeholder="in/handle" />
                <TextField path={[...p, 'icon']} label="Icon" optional hint="github, linkedin, x, facebook, instagram, mail, phone; anything else shows a globe." mono />
              </FieldGrid>
            </>
          )}
        </ListField>
      </Group>

      <Group id="masthead" title="Masthead and colophon" layer={3} description="The printed furniture: top strip and footer title block.">
        <FieldGrid>
          <TextField path={['masthead', 'location']} label="Masthead location" />
          <TextField path={['masthead', 'strapline']} label="Strapline" hint="Centre of the top strip (hidden below 768px)." />
          <TextAreaField path={['masthead', 'colophon']} label="Colophon" className="col-span-full" rows={2} />
        </FieldGrid>
      </Group>
    </>
  )
}
