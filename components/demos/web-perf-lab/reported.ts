/**
 * The reported production before/after for this demo. Resolved on the server (the page
 * passes `getExperience()` in) so the client chunk never imports lib/content.
 * Type-only imports below are erased at build time.
 */
import type { ExperienceItem } from '@/lib/content/schema'

export interface ReportedMetric {
  from: string
  to: string
  label: string
  org?: string
  product?: string
}

/** First experience item that carries a metric and cites this demo as proof. */
export function reportedMetric(experience: readonly ExperienceItem[]): ReportedMetric | null {
  for (const e of experience) {
    if (e.metric && e.highlights.some((h) => h.proofDemo === 'web-perf-lab')) {
      return { ...e.metric, org: e.org, product: e.product }
    }
  }
  return null
}
