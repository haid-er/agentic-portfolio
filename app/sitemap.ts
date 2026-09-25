/** sitemap.xml. STUB — owner: seo-theme. */
import type { MetadataRoute } from 'next'
import { getProjects } from '@/lib/content'
import { getDemos } from '@/lib/demos'
import { siteUrl } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  return [
    { url: `${base}/` },
    { url: `${base}/playground` },
    { url: `${base}/resume` },
    ...getProjects().map((p) => ({ url: `${base}/projects/${p.slug}` })),
    ...getDemos().map((d) => ({ url: `${base}/playground/${d.slug}` })),
  ]
}
