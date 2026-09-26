/**
 * Preload only the active world's fonts (DESIGN.md 4; perf review: Strata CLS).
 *
 * next/font can only preload unconditionally, which made every visitor fetch the
 * four Almanac files and left Strata's fonts to swap in after first paint (the
 * hero reflowed: CLS ~0.2). Instead, at build time we read the Latin-subset file
 * of each world's display and body faces from the generated font CSS, and a tiny
 * inline script (run right after the no-flash world pick) adds <link rel=preload>
 * for the chosen world only.
 *
 * If the CSS cannot be read (next dev, or a runtime-rendered route on a host
 * without the build output) the list is empty and fonts simply load on demand.
 */
import 'server-only'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ThemeKey } from '@/lib/theme/keys'

/** Families to preload per world: display + body (mono is small print and may swap). */
const PRELOAD: Record<ThemeKey, readonly string[]> = {
  almanac: ['Fraunces', 'Newsreader'],
  strata: ['Bricolage Grotesque', 'Hanken Grotesk'],
}

let cache: Record<ThemeKey, string[]> | null = null

const norm = (s: string) => s.replace(/^['"]|['"]$/g, '').replace(/_/g, ' ').replace(/\s+[0-9a-f]{6,}$/i, '').trim().toLowerCase()

export function worldFontUrls(): Record<ThemeKey, string[]> {
  if (cache) return cache
  const out: Record<ThemeKey, string[]> = { almanac: [], strata: [] }
  try {
    const dir = join(process.cwd(), '.next', 'static', 'css')
    const css = readdirSync(dir)
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(join(dir, f), 'utf8'))
      .join('\n')
    for (const [, body = ''] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      // The basic Latin subset only (unicode-range starts at U+0000-00FF).
      if (!/unicode-range:\s*u\+0000-00ff|unicode-range:\s*u\+00\?\?/i.test(body)) continue
      const family = norm(/font-family:\s*([^;]+)/i.exec(body)?.[1] ?? '')
      const url = /src:\s*url\(([^)]+)\)/i.exec(body)?.[1]?.replace(/^['"]|['"]$/g, '')
      if (!family || !url || !url.startsWith('/_next/static/media/')) continue
      for (const world of Object.keys(PRELOAD) as ThemeKey[]) {
        if (PRELOAD[world].some((f) => f.toLowerCase() === family) && !out[world].includes(url)) out[world].push(url)
      }
    }
  } catch {
    /* no build output: no preloads */
  }
  cache = out
  return out
}

/** Inline script: preload the fonts of the world the no-flash script picked. */
export function fontPreloadScript(): string {
  const urls = worldFontUrls()
  if (!urls.almanac.length && !urls.strata.length) return ''
  const json = JSON.stringify(urls).replace(/</g, '\\u003c')
  return `(function(){try{var U=${json},w=document.documentElement.getAttribute('data-theme'),h=document.head;(U[w]||[]).forEach(function(u){var l=document.createElement('link');l.rel='preload';l.as='font';l.type='font/woff2';l.crossOrigin='anonymous';l.href=u;h.appendChild(l)})}catch(e){}})();`
}
