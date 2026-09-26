/**
 * Share cards for inner pages (projects, demos). Owner: seo-theme.
 * Segment files stay tiny:
 *
 *   // app/projects/[slug]/opengraph-image.tsx
 *   import { OG_IMAGE_SIZE } from '@/lib/seo/og'
 *   import { projectOgAlt, projectOgImage, projectOgParams } from '@/lib/seo/og-pages'
 *   export const size = OG_IMAGE_SIZE
 *   export const contentType = 'image/png'
 *   export const alt = projectOgAlt()
 *   export const generateStaticParams = projectOgParams
 *   export default projectOgImage
 *
 *   // app/playground/[slug]/opengraph-image.tsx: same with demoOg*.
 *
 * Every word comes from content: the section label (projects / playground) and
 * the pillar title form the kicker, the skills section label titles the chips.
 */
import { getProfile, getProject, getProjects, getSection, type Pillar, type SectionId } from '@/lib/content'
import { getDemo, getDemos } from '@/lib/demos'
import { renderOgImage } from './og'
import { pageOgCard, siteOgCard } from './og-data'

type SlugParams = { params: { slug: string } | Promise<{ slug: string }> }

const sectionLabel = (id: SectionId) => {
  const s = getSection(id)
  return s?.navLabel || s?.title || ''
}
const pillarTitle = (p: Pillar) => getProfile().pillars.find((x) => x.id === p)?.title ?? ''
const kicker = (...parts: string[]) => parts.filter(Boolean)
const unique = (xs: string[]) => Array.from(new Set(xs.filter(Boolean)))

/** Alt text for a page card: the site name, since the page title varies per slug. */
export const projectOgAlt = () => `${sectionLabel('projects') || getProfile().name}: ${getProfile().name}`
export const demoOgAlt = () => `${sectionLabel('playground') || getProfile().name}: ${getProfile().name}`

export const projectOgParams = () => getProjects().map((p) => ({ slug: p.slug }))
export const demoOgParams = () => getDemos().map((d) => ({ slug: d.slug }))

/** Default export of app/projects/[slug]/opengraph-image.tsx. Unknown slug -> the site card. */
export async function projectOgImage({ params }: SlugParams) {
  const p = getProject((await params).slug)
  if (!p) return renderOgImage(siteOgCard())
  return renderOgImage(
    pageOgCard({
      kicker: kicker(sectionLabel('projects'), pillarTitle(p.pillar)),
      title: p.title,
      summary: p.summary,
      chips: unique(p.stack).slice(0, 7),
      chipsTitle: sectionLabel('skills'),
      path: `/projects/${p.slug}`,
    }),
  )
}

/** Default export of app/playground/[slug]/opengraph-image.tsx. Unknown slug -> the site card. */
export async function demoOgImage({ params }: SlugParams) {
  const d = getDemo((await params).slug)
  if (!d) return renderOgImage(siteOgCard())
  return renderOgImage(
    pageOgCard({
      kicker: kicker(sectionLabel('playground'), pillarTitle(d.pillar)),
      title: d.title,
      summary: d.summary,
      chips: unique([...d.skills, ...d.provenBy]).slice(0, 7),
      chipsTitle: sectionLabel('skills'),
      path: `/playground/${d.slug}`,
    }),
  )
}
