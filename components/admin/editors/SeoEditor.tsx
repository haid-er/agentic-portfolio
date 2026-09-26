'use client'
/** site.seo + site.analytics, with a search-result and a share-card preview. */
import { Globe } from 'lucide-react'
import type { Seo } from '@/lib/content/schema'
import { useEditor } from '../EditorContext'
import { ToggleField } from '../fields/Choice'
import { FieldGrid, Group } from '../fields/Group'
import { ImageField } from '../fields/Image'
import { TagsField } from '../fields/Tags'
import { TextAreaField, TextField } from '../fields/Text'

const S = ['seo'] as const

export function SeoEditor() {
  const ed = useEditor()
  const seo = (ed.data as { seo: Seo }).seo
  let host = ''
  try { host = seo.siteUrl ? new URL(seo.siteUrl).host : '' } catch { host = '' }
  const sample = seo.titleTemplate.includes('%s') ? seo.titleTemplate.replace('%s', 'Playground') : ''

  return (
    <div className="grid gap-s5 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
      <div className="grid gap-s5 min-w-0">
        <Group id="seo" title="Search and sharing" description="Page titles, the meta description, the canonical URL and the Person structured data.">
          <FieldGrid>
            <TextField path={[...S, 'title']} label="Site title" className="col-span-full" recommend={{ max: 60 }} />
            <TextField path={[...S, 'titleTemplate']} label="Title template" mono hint={sample ? `Inner pages: “${sample}”` : 'Use %s for the page name, e.g. “%s · Name”.'} />
            <TextField path={[...S, 'siteUrl']} label="Site URL" inputMode="url" mono hint="Canonical origin, no trailing slash." />
            <TextAreaField path={[...S, 'description']} label="Description" className="col-span-full" rows={3} recommend={{ min: 70, max: 160 }} />
            <TextField path={[...S, 'twitterHandle']} label="X / Twitter handle" optional placeholder="@handle" />
          </FieldGrid>
          <TagsField path={[...S, 'keywords']} label="Keywords" />
          <TagsField path={[...S, 'sameAs']} label="Same-as profiles" hint="Profile URLs that identify the same person (JSON-LD sameAs)." placeholder="https://…" />
          <ImageField path={[...S, 'ogImage']} label="Share image" hint="Optional. Empty = the generated Open Graph card in the current world’s inks (1200×630)." />
        </Group>
        <Group id="analytics" title="Analytics" layer={2}>
          <ToggleField path={['analytics', 'enabled']} label="Vercel Web Analytics" hint="Cookie-free page views. Nothing else is tracked." />
        </Group>
        <Group id="privacy" title="Never render" layer={3} description="Extra words that must never appear in live feeds (the GitHub activity list), matched at the start of a word, any case. Contract-protected terms are always excluded in code.">
          <TagsField path={['privacy', 'excluded']} label="Excluded terms" hint="Private client or project names. A repository whose name or description starts a word with one of these is hidden." />
        </Group>
      </div>

      <aside className="grid gap-s4 lg:sticky lg:top-s4" aria-label="Previews">
        <figure className="m-0 grid gap-1">
          <figcaption className="mono text-ink-3">Search result</figcaption>
          <div className="p-s4 bg-surface border border-rule rounded-1 grid gap-1 font-[system-ui,sans-serif]">
            <span className="flex items-center gap-2 text-00 text-ink-2 min-w-0">
              <span className="grid place-items-center size-6 rounded-pill bg-bg-2 border border-rule-soft"><Globe aria-hidden="true" size={13} strokeWidth={1.5} /></span>
              <span className="truncate">{host || 'your-site.example'}</span>
            </span>
            <span className="text-2 leading-tight text-accent [overflow-wrap:anywhere]">{truncate(seo.title, 60) || 'Site title'}</span>
            <span className="text-0 text-ink-2 leading-snug">{truncate(seo.description, 160) || 'The meta description appears here.'}</span>
          </div>
        </figure>
        <figure className="m-0 grid gap-1">
          <figcaption className="mono text-ink-3">Share card</figcaption>
          <div className="bg-surface border border-rule rounded-1 overflow-hidden">
            <div className="aspect-[1200/630] bg-bg-2 grid place-items-center overflow-hidden">
              {seo.ogImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={seo.ogImage} alt="" className="size-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/opengraph-image" alt="" className="size-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              )}
            </div>
            <div className="p-s3 grid gap-[2px] border-t border-rule">
              <span className="mono text-ink-3">{host || 'your-site.example'}</span>
              <span className="font-semibold text-0 [overflow-wrap:anywhere]">{truncate(seo.title, 70)}</span>
              <span className="text-00 text-ink-2">{truncate(seo.description, 110)}</span>
            </div>
          </div>
        </figure>
      </aside>
    </div>
  )
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s
}
