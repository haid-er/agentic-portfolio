'use client'
/** site.profile: identity, pillars, languages, interests. */
import type { PillarInfo } from '@/lib/content/schema'
import { FieldGrid, Group } from '../fields/Group'
import { ImageField } from '../fields/Image'
import { ListField } from '../fields/List'
import { TagsField } from '../fields/Tags'
import { TextAreaField, TextField } from '../fields/Text'

type Language = { name: string; level: string }
const P = ['profile'] as const

export function ProfileEditor() {
  return (
    <>
      <Group id="identity" title="Identity" description="Name, headline and contact details used across the site, the résumé and the structured data.">
        <FieldGrid>
          <TextField path={[...P, 'name']} label="Full name" autoComplete="name" />
          <TextField path={[...P, 'headline']} label="Headline" />
          <TextField path={[...P, 'tagline']} label="Tagline" className="col-span-full" recommend={{ max: 110 }} />
          <TextAreaField path={[...P, 'shortBio']} label="Short bio" className="col-span-full" rows={4} recommend={{ min: 120, max: 420 }} />
          <TextField path={[...P, 'location']} label="Location" />
          <TextField path={[...P, 'email']} label="Email" type="email" inputMode="email" autoComplete="email" />
          <TextField path={[...P, 'phone']} label="Phone" optional type="tel" inputMode="tel" hint="Optional. Empty hides it everywhere." />
          <TextField path={[...P, 'motto']} label="Motto" hint="Printed in the colophon footer." />
          <div className="col-span-full"><ImageField path={[...P, 'avatar']} label="Portrait" hint="Optional. Square works best; PNG, JPEG, WebP or AVIF, up to 4 MB." /></div>
        </FieldGrid>
      </Group>

      <Group id="pillars" title="Pillars" layer={2} description="The six groups skills, demos and projects are filed under. Ids are fixed; titles and summaries are yours.">
        <ListField<PillarInfo>
          path={[...P, 'pillars']}
          label="Pillars"
          hideLabel
          addable={false}
          removable={false}
          itemTitle={(p) => p.title || p.id}
          itemSubtitle={(p) => p.id}
          newItem={() => ({ id: 'fullstack', title: '', summary: '' })}
        >
          {(pp) => (
            <>
              <TextField path={[...pp, 'title']} label="Title" />
              <TextAreaField path={[...pp, 'summary']} label="Summary" rows={3} recommend={{ max: 240 }} />
            </>
          )}
        </ListField>
      </Group>

      <Group id="languages" title="Languages and interests" layer={3}>
        <ListField<Language>
          path={[...P, 'languages']}
          label="Languages"
          collapsible={false}
          addLabel="Add language"
          itemTitle={(l) => l.name || 'New language'}
          newItem={() => ({ name: '', level: '' })}
        >
          {(lp) => (
            <div className="grid gap-s3 grid-cols-2">
              <TextField path={[...lp, 'name']} label="Language" />
              <TextField path={[...lp, 'level']} label="Level" placeholder="Native" />
            </div>
          )}
        </ListField>
        <TagsField path={[...P, 'interests']} label="Interests" />
      </Group>
    </>
  )
}
