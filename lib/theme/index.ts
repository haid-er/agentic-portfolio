/**
 * Theme helpers (server safe). Owner: seo-theme.
 * Worlds are keyed `almanac` | `strata` (stable); labels come from content/theme.json.
 *
 * - `themeOverridesCss(theme)`: admin token overrides -> CSS variables (root layout <style>).
 * - `noFlashScript(theme)`: inline <head> script that picks the world before paint.
 * - `themeColors(theme)`: browser chrome colours for the viewport export.
 * - `rootViewport(theme)`: the root layout's whole `viewport` (uses themeColors).
 * - `themeLabels(theme)`: display names + swap labels (the UI never shows keys).
 */
import type { Viewport } from 'next'
import type { Theme } from '@/lib/content/schema'
import { THEME_KEYS, type ThemeKey } from './keys'
import { worldTokens } from './tokens'

export { THEME_KEYS, isThemeKey } from './keys'
export type { ThemeKey } from './keys'

export { DEFAULT_COLORS, isLiteralColor, worldTokens } from './tokens'
export type { ColorToken, WorldColors } from './tokens'

export const THEME_STORAGE_KEY = 'ghp-theme'
export const THEME_EVENT = 'ghp:themechange'

export const otherTheme = (k: ThemeKey): ThemeKey => (k === 'almanac' ? 'strata' : 'almanac')

/* ------------------------------------------------------------------ */
/* token overrides -> CSS                                              */
/* ------------------------------------------------------------------ */

/**
 * A token value is emitted only if it cannot escape its declaration:
 * no `;{}` (structure), no `<>` (closing the <style> element), no comments
 * (which would swallow the following declarations) and no control characters.
 */
const UNSAFE_VALUE = /[;{}<>]|\/\*|\*\/|[\u0000-\u001f\u007f]/
const TOKEN_NAME = /^--[a-z0-9-]+$/

export function isSafeTokenValue(value: string): boolean {
  return value.trim() !== '' && value.length <= 2000 && !UNSAFE_VALUE.test(value)
}

/** Quote a string for a CSS `content`-style custom property. */
function cssString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ').replace(/</g, '\\3C ')}"`
}

/**
 * Selectors carry specificity (0,2,0) so the overrides beat the (0,1,0) defaults
 * in globals.css no matter where the browser puts the <style> element.
 * `:root:not([data-theme="strata"])` keeps Almanac overrides off a Strata <html>,
 * and the doubled attribute selector scopes each world to any subtree too
 * (theme-lab previews, specimen cards).
 */
const SELECTORS: Record<ThemeKey, string> = {
  almanac: ':root:not([data-theme="strata"]),[data-theme="almanac"][data-theme]',
  strata: '[data-theme="strata"][data-theme]',
}

/** CSS injected after globals.css: admin token overrides per world. */
export function themeOverridesCss(theme: Theme): string {
  return THEME_KEYS.map((key) => {
    const def = theme.themes[key]
    const decls = Object.entries(def.tokens)
      .filter(([name, value]) => TOKEN_NAME.test(name) && isSafeTokenValue(value))
      .map(([name, value]) => `${name}:${value.trim()};`)
    decls.push(`color-scheme:${def.reads};`)
    if (def.swapLabel) decls.push(`--swap-label:${cssString(def.swapLabel)};`)
    return `${SELECTORS[key]}{${decls.join('')}}`
  }).join('\n')
}

/* ------------------------------------------------------------------ */
/* no-flash script                                                     */
/* ------------------------------------------------------------------ */

/** JSON that is safe inside an inline <script>. */
const inlineJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

/**
 * Inline <head> script that runs before paint (DESIGN.md 3):
 * `?theme=` -> localStorage -> admin default -> prefers-color-scheme.
 * It sets `data-theme`, `color-scheme` and the browser chrome colour.
 * A stored key that no longer exists is ignored.
 */
export function noFlashScript(theme: Theme): string {
  const cfg = inlineJson({
    k: THEME_KEYS,
    d: theme.default,
    s: THEME_STORAGE_KEY,
    r: { almanac: theme.themes.almanac.reads, strata: theme.themes.strata.reads },
    c: { almanac: worldTokens(theme, 'almanac')['--bg'], strata: worldTokens(theme, 'strata')['--bg'] },
  })
  return `(function(){try{var C=${cfg},K=C.k,d=document.documentElement,t=null,ok=function(v){return K.indexOf(v)>-1};
try{var q=new URLSearchParams(location.search).get('theme');if(ok(q))t=q}catch(e){}
if(!t){try{var s=localStorage.getItem(C.s);if(ok(s))t=s}catch(e){}}
if(!t&&ok(C.d))t=C.d;
if(!t){var dark=K.filter(function(k){return C.r[k]==='dark'})[0]||'strata',light=K.filter(function(k){return C.r[k]==='light'})[0]||'almanac';
t=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches?dark:light}
d.setAttribute('data-theme',t);window.__ghpTheme=t;d.style.colorScheme=C.r[t];
var m=document.querySelector('meta[name="color-scheme"]');if(m)m.setAttribute('content',C.r[t]);
document.querySelectorAll('meta[name="theme-color"]').forEach(function(n){n.setAttribute('content',C.c[t])});
}catch(e){}})();`
}

/* ------------------------------------------------------------------ */
/* labels + chrome colours                                             */
/* ------------------------------------------------------------------ */

export interface WorldLabel {
  label: string
  swapLabel: string
  reads: 'light' | 'dark'
}

/** Display names per world (the UI always shows `label`, never the key). */
export function themeLabels(theme: Theme): Record<ThemeKey, WorldLabel> {
  const pick = (k: ThemeKey): WorldLabel => {
    const t = theme.themes[k]
    return { label: t.label, swapLabel: t.swapLabel, reads: t.reads }
  }
  return { almanac: pick('almanac'), strata: pick('strata') }
}

/**
 * `viewport.themeColor` for the root layout: each world's paper colour,
 * matched to the OS preference by what the world reads as.
 * The no-flash script and `setTheme()` then repaint it to the chosen world.
 */
export function themeColors(theme: Theme): { media: string; color: string }[] {
  return THEME_KEYS.map((k) => ({
    media: `(prefers-color-scheme: ${theme.themes[k].reads})`,
    color: worldTokens(theme, k)['--bg'],
  }))
}

/**
 * The root layout's viewport: app/layout.tsx does
 * `export function generateViewport() { return rootViewport(getTheme()) }`
 * so the first-paint chrome colour follows the admin's worlds.
 */
export function rootViewport(theme: Theme): Viewport {
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    colorScheme: 'light dark',
    themeColor: themeColors(theme),
  }
}
