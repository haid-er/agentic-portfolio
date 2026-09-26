/**
 * Root layout: fonts, theme (no-flash script + admin token overrides), JSON-LD,
 * site chrome (hidden on /admin), toasts, analytics.
 */
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Footer, Header, PublicOnly, SkipLink } from '@/components/layout'
import { ThemeKeeper } from '@/components/layout/ThemeKeeper'
import { ToastProvider } from '@/components/ui/Toast'
import { getTheme } from '@/lib/content'
import { buildMetadata, jsonLdString, personJsonLd } from '@/lib/seo'
import { SiteAnalytics } from '@/lib/seo/SiteAnalytics'
import { noFlashScript, rootViewport, themeOverridesCss } from '@/lib/theme'
import { fontVariables } from './fonts'
import './globals.css'

export const metadata: Metadata = buildMetadata()

export function generateViewport(): Viewport {
  return rootViewport(getTheme())
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const theme = getTheme()
  return (
    <html lang="en" data-theme="almanac" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Runs before paint: picks the world (DESIGN.md 3). */}
        <script dangerouslySetInnerHTML={{ __html: noFlashScript(theme) }} />
        <style id="theme-overrides" dangerouslySetInnerHTML={{ __html: themeOverridesCss(theme) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(personJsonLd()) }} />
      </head>
      <body>
        <ThemeKeeper />
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
        <SiteAnalytics />
      </body>
    </html>
  )
}
