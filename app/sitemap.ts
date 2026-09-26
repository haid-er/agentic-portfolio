/**
 * sitemap.xml. Owner: seo-theme.
 * Home, the playground and every visible demo, the project index and every
 * enabled project, and the résumé when it is published. `lastModified` is the
 * build time: every admin save commits content and redeploys, so a build is
 * exactly when the content last changed.
 */
import type { MetadataRoute } from 'next'
import { getProjects, getResume } from '@/lib/content'
import { getDemos } from '@/lib/demos'
import { absoluteUrl } from '@/lib/seo'

type Entry = MetadataRoute.Sitemap[number]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const page = (path: string, priority: number, changeFrequency: Entry['changeFrequency'] = 'monthly', extra: Partial<Entry> = {}): Entry => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency,
    priority,
    ...extra,
  })

  const projects = getProjects()
  return [
    page('/', 1, 'weekly', { images: [absoluteUrl('/opengraph-image')] }),
    page('/playground', 0.9, 'weekly'),
    ...getDemos().map((d) => page(`/playground/${d.slug}`, 0.7)),
    ...(projects.length ? [page('/projects', 0.8)] : []),
    ...projects.map((p) => page(`/projects/${p.slug}`, 0.7, 'monthly', p.image ? { images: [absoluteUrl(p.image)] } : {})),
    ...(getResume().enabled ? [page('/resume', 0.6)] : []),
  ]
}
