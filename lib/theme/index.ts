/**
 * Theme helpers (server safe). Owner: seo-theme.
 * Worlds are keyed `almanac` | `strata` (stable); labels come from content/theme.json.
 */
import { THEME_KEYS, type Theme, type ThemeKey } from '@/lib/content/schema'

export const THEME_STORAGE_KEY = 'ghp-theme'
export const THEME_EVENT = 'ghp:themechange'

export const otherTheme = (k: ThemeKey): ThemeKey => (k === 'almanac' ? 'strata' : 'almanac')

const SAFE_VALUE = /^[^;{}<>]*$/

/** CSS injected after globals.css: admin token overrides per world. */
export function themeOverridesCss(theme: Theme): string {
  return THEME_KEYS.map((key) => {
    const def = theme.themes[key]
    const decls = Object.entries(def.tokens)
      .filter(([, v]) => SAFE_VALUE.test(v))
      .map(([k, v]) => `${k}:${v};`)
      .join('')
    const swap = `--swap-label:${JSON.stringify(def.swapLabel).replace(/</g, "\\3C ")};`
    const sel = key === 'almanac' ? ':root,[data-theme="almanac"]' : '[data-theme="strata"]'
    return `${sel}{${decls}${swap}}`
  }).join('\n')
}

/**
 * Inline <head> script that runs before paint (DESIGN.md 3):
 * ?theme= -> localStorage -> admin default -> prefers-color-scheme.
 */
export function noFlashScript(theme: Theme): string {
  const keys = JSON.stringify(THEME_KEYS)
  const def = JSON.stringify(theme.default)
  const reads = JSON.stringify({ almanac: theme.themes.almanac.reads, strata: theme.themes.strata.reads })
  return `(function(){try{var K=${keys},d=document.documentElement,t=null;
var q=new URLSearchParams(location.search).get('theme');if(K.indexOf(q)>-1)t=q;
if(!t){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');if(K.indexOf(s)>-1)t=s}catch(e){}}
if(!t&&K.indexOf(${def})>-1)t=${def};
if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'strata':'almanac';
d.setAttribute('data-theme',t);d.style.colorScheme=(${reads})[t];
var m=document.querySelector('meta[name="color-scheme"]');if(m)m.setAttribute('content',(${reads})[t]);
}catch(e){}})();`
}
