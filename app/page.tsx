/**
 * Homepage: renders enabled sections in content order (content/site.json -> sections).
 * Add a section = add its id to SECTION_IDS (schema) + an entry in components/sections/registry.ts.
 */
import { SECTIONS } from '@/components/sections/registry'
import { getSections } from '@/lib/content'
import { folio } from '@/lib/utils'

export default function HomePage() {
  return (
    <>
      {getSections().map((section, i) => {
        const { Component } = SECTIONS[section.id]
        return <Component key={section.id} section={section} folio={folio(i + 1)} />
      })}
    </>
  )
}
