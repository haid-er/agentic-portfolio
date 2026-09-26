/**
 * SEO helpers. Owner: seo-theme. All values come from content/site.json.
 *
 * - `buildMetadata({ title, description, path, image, type, noIndex, keywords })`
 *   for app/layout.tsx (no args) and every page's `generateMetadata`.
 * - JSON-LD builders (`personJsonLd`, `scholarlyArticleJsonLd`, `breadcrumbJsonLd`,
 *   `demoJsonLd`) + `jsonLdString` for the <script> tag.
 * - `analyticsEnabled()`: the admin analytics toggle (`<SiteAnalytics />` lives in
 *   `@/lib/seo/SiteAnalytics`, kept out of this barrel so routes never import client code).
 * - `renderOgImage()` lives in `@/lib/seo/og` (segment opengraph-image files).
 */
import type { Metadata } from 'next'
import { getProfile, getSeo, getSite, getSocials } from '@/lib/content'
import { siteUrl } from './url'

export { absoluteUrl, displayHost, siteUrl } from './url'
export {
  breadcrumbJsonLd,
  demoJsonLd,
  doiUrl,
  jsonLdString,
  personJsonLd,
  personNode,
  sameAsUrls,
  scholarlyArticleJsonLd,
  scholarlyArticleNode,
  siteJsonLd,
} from './jsonld'

/** Admin toggle (content/site.json `analytics.enabled`), and only on Vercel, so local and CI builds never load the script. */
export function analyticsEnabled(): boolean {
  return getSite().analytics.enabled && Boolean(process.env.VERCEL)
}

/** Size of every generated share card. */
export const OG_SIZE = { width: 1200, height: 630 } as const

export interface PageMeta {
  /** Page title; the root template ("%s · Name") is applied. Omit on the home page. */
  title?: string
  description?: string
  /** Canonical path, e.g. "/projects/foo". Defaults to "/". */
  path?: string
  /** Share image path or URL. Defaults to admin `seo.ogImage`, then the generated site card (see `segmentImage`). */
  image?: string
  imageAlt?: string
  /**
   * The route has its own `opengraph-image.tsx` (project and demo pages). Leaves the
   * `images` keys out so Next's file convention supplies that card (with its alt and
   * size), and X falls back to it too. Ignored when `image` is set.
   */
  segmentImage?: boolean
  type?: 'website' | 'article' | 'profile'
  /** Keep the page out of search results (admin, drafts). */
  noIndex?: boolean
  /** Extra keywords merged after the site keywords. */
  keywords?: string[]
}

/** "Résumé" -> "Résumé · Malik Haider Ali" using the admin template. */
export function pageTitle(title?: string): string {
  const seo = getSeo()
  if (!title) return seo.title
  const tpl = seo.titleTemplate || '%s'
  return tpl.includes('%s') ? tpl.replace('%s', title) : `${title} · ${tpl}`
}

/** The X handle as "@handle", from seo.twitterHandle or the enabled X social. */
function twitterHandle(): string | undefined {
  const raw = getSeo().twitterHandle || getSocials().find((s) => s.id === 'x')?.handle || ''
  const h = raw.trim().replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//, '').replace(/^@?/, '')
  return h ? `@${h}` : undefined
}

/** Root metadata (app/layout.tsx). Pages pass { title, description, path }. */
export function buildMetadata(page: PageMeta = {}): Metadata {
  const seo = getSeo()
  const profile = getProfile()
  const url = siteUrl()
  const path = page.path ?? '/'
  const description = page.description || seo.description || undefined
  const fullTitle = pageTitle(page.title)
  const image = page.image || seo.ogImage || '/opengraph-image'
  const imageAlt = page.imageAlt || fullTitle
  const images = [{ url: image, width: OG_SIZE.width, height: OG_SIZE.height, alt: imageAlt }]
  // Next only uses a segment's file-based card when this level has no `images` key.
  const imageFields = page.segmentImage && !page.image ? {} : { images }
  const handle = twitterHandle()
  const keywords = Array.from(new Set([...seo.keywords, ...(page.keywords ?? [])])).filter(Boolean)

  return {
    metadataBase: new URL(url),
    title: page.title ? page.title : { default: seo.title, template: seo.titleTemplate || '%s' },
    description,
    applicationName: profile.name,
    authors: [{ name: profile.name, url }],
    creator: profile.name,
    publisher: profile.name,
    keywords: keywords.length ? keywords : undefined,
    category: 'technology',
    alternates: { canonical: path },
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: {
      type: page.type ?? 'website',
      url: path,
      title: fullTitle,
      description,
      siteName: profile.name,
      locale: 'en',
      ...imageFields,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      site: handle,
      creator: handle,
      ...imageFields,
    },
    robots: page.noIndex
      ? { index: false, follow: false, googleBot: { index: false, follow: false } }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
        },
  }
}

/** Metadata for a playground demo page (`/playground/[slug]`). */
export function demoMetadata(d: { slug: string; title: string; summary: string; skills?: string[] }): Metadata {
  return buildMetadata({
    title: d.title,
    description: d.summary,
    path: `/playground/${d.slug}`,
    keywords: d.skills,
    type: 'article',
    segmentImage: true,
  })
}
