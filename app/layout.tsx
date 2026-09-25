/**
 * Root layout: fonts, theme (no-flash script + admin token overrides), JSON-LD,
 * site chrome (hidden on /admin), toasts, analytics.
 */
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { Footer, Header, PublicOnly, SkipLink } from '@/components/layout'
import { ToastProvider } from '@/components/ui/Toast'
import { getSite, getTheme } from '@/lib/content'
import { buildMetadata, jsonLdString, personJsonLd } from '@/lib/seo'
import { noFlashScript, themeOverridesCss } from '@/lib/theme'
import { fontVariables } from './fonts'
import './globals.css'

export const metadata: Metadata = buildMetadata()

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F2EADB' },
    { media: '(prefers-color-scheme: dark)', color: '#16110D' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const theme = getTheme()
  const site = getSite()
  return (
    <html lang="en" data-theme="almanac" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Runs before paint: picks the world (DESIGN.md 3). */}
        <script dangerouslySetInnerHTML={{ __html: noFlashScript(theme) }} />
        <style id="theme-overrides" dangerouslySetInnerHTML={{ __html: themeOverridesCss(theme) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(personJsonLd()) }} />
      </head>
      <body>
        <ToastProvider>
          <PublicOnly>
            <SkipLink />
            <Header />
          </PublicOnly>
          <main id="main" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <PublicOnly>
            <Footer />
          </PublicOnly>
        </ToastProvider>
        {site.analytics.enabled && process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  )
}
