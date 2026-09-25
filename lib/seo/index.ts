/**
 * SEO helpers. Owner: seo-theme. All values come from content/site.json.
 */
import type { Metadata } from 'next'
import { getProfile, getSeo, getSocials } from '@/lib/content'

export function siteUrl(): string {
  return (getSeo().siteUrl || 'http://localhost:3000').replace(/\/$/, '')
}

/** Root metadata (app/layout.tsx). Pages pass { title, description, path }. */
export function buildMetadata(page: { title?: string; description?: string; path?: string } = {}): Metadata {
  const seo = getSeo()
  const url = siteUrl()
  return {
    metadataBase: new URL(url),
    title: page.title ? page.title : { default: seo.title, template: seo.titleTemplate || '%s' },
    description: page.description ?? seo.description,
    keywords: seo.keywords,
    alternates: { canonical: page.path ?? '/' },
    openGraph: {
      type: 'website',
      url: page.path ?? '/',
      title: page.title ?? seo.title,
      description: page.description ?? seo.description,
      siteName: getProfile().name,
    },
    twitter: { card: 'summary_large_image', creator: seo.twitterHandle || undefined },
  }
}

/** Person JSON-LD with sameAs (BRIEF 2: disambiguation). */
export function personJsonLd() {
  const p = getProfile()
  const seo = getSeo()
  const sameAs = Array.from(new Set([...seo.sameAs, ...getSocials().map((s) => s.url)])).filter((u) => /^https?:/.test(u))
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.name,
    jobTitle: p.headline || undefined,
    url: siteUrl(),
    email: p.email ? `mailto:${p.email}` : undefined,
    address: p.location ? { '@type': 'PostalAddress', addressLocality: p.location } : undefined,
    sameAs,
  }
}

/** Safe JSON for <script type="application/ld+json">. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
