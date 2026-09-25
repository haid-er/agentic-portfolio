/**
 * robots.txt. Owner: seo-theme.
 * Production is open to every crawler except the admin and API routes.
 * Vercel preview deployments are closed entirely, so drafts never compete
 * with the canonical site in search results.
 */
import type { MetadataRoute } from 'next'
import { displayHost, siteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV === 'preview') {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/admin/', '/api/'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: displayHost(),
  }
}
