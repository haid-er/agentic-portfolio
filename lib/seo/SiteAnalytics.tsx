/**
 * Analytics toggle (server component). Owner: seo-theme.
 * Renders Vercel Web Analytics (with the privacy filters in analytics-client)
 * only when admin enabled it in content/site.json and the build runs on Vercel.
 *
 *   import { SiteAnalytics } from '@/lib/seo/SiteAnalytics'
 *   <SiteAnalytics />   // end of <body> in app/layout.tsx
 */
import { AnalyticsClient } from './analytics-client'
import { analyticsEnabled } from './index'

export { analyticsEnabled }

export function SiteAnalytics() {
  return analyticsEnabled() ? <AnalyticsClient /> : null
}
