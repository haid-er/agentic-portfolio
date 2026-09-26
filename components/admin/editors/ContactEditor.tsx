'use client'
/** site.contact, socials, form endpoint and masthead furniture. */
import type { Social } from '@/lib/content/schema'
import { endpointHost, endpointMailto, WEB3FORMS_HOST } from '@/app/resume/_client/formEndpoint'
import { useField } from '../EditorContext'
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
        <TextField
          path={['contactFormEndpoint']}
          label="Form endpoint"
          hint="Free form service URL. Web3Forms: https://api.web3forms.com/submit?access_key=YOUR_KEY (the key is public by design) · Formspree: https://formspree.io/f/FORM_ID · a mailto: address also works. Empty = the visitor's mail app, addressed to your profile email."
          inputMode="url"
          mono
        />
        <EndpointCheck />
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

/** Inline warning when the endpoint would be ignored by the site (same rule as the form). */
function EndpointCheck() {
  const f = useField<string | undefined>(['contactFormEndpoint'])
  const v = (f.value ?? '').trim()
  if (!v || endpointHost(v) || endpointMailto(v)) return null
  let msg = 'The site ignores this value and falls back to the mail app: use an https:// URL or a mailto: address.'
  try {
    const u = new URL(v)
    if (u.hostname.replace(/^www\./, '') === WEB3FORMS_HOST && u.protocol === 'https:') msg = 'Web3Forms needs ?access_key=YOUR_KEY in the URL; without it every submission fails, so the site uses the mail app instead.'
  } catch { /* not a URL */ }
  return <p role="status" className="m-0 text-0 text-warn">{msg}</p>
}
