'use client'
/**
 * Vercel Web Analytics with privacy filters. Owner: seo-theme.
 * Mounted by <SiteAnalytics /> only when content/site.json `analytics.enabled`
 * is on and the site runs on Vercel.
 *
 * Nothing is sent for /admin or /api, query strings and hashes are stripped
 * (so `?theme=` QA links never fragment the stats), and a visitor who sends
 * Do Not Track / Global Privacy Control, or who opted out on this device, is
 * never counted.
 */
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next'

export const ANALYTICS_OPT_OUT_KEY = 'ghp-analytics'

const PRIVATE_PATH = /^\/(admin|api)(\/|$)/

function optedOut(): boolean {
  if (typeof window === 'undefined') return true
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (nav.globalPrivacyControl === true || nav.doNotTrack === '1') return true
  try {
    return localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === 'off'
  } catch {
    return false
  }
}

export function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  if (optedOut()) return null
  let url: URL
  try {
    url = new URL(event.url)
  } catch {
    return null
  }
  if (PRIVATE_PATH.test(url.pathname)) return null
  return { ...event, url: `${url.origin}${url.pathname}` }
}

export function AnalyticsClient() {
  return <Analytics beforeSend={beforeSend} />
}

/** Per-device opt-out switch (e.g. for a colophon link). */
export function setAnalyticsOptOut(off: boolean) {
  try {
    if (off) localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'off')
    else localStorage.removeItem(ANALYTICS_OPT_OUT_KEY)
  } catch { /* private mode */ }
}
