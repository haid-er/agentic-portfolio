/**
 * Google Fonts for generated share cards (Almanac's three families). Owner: seo-theme.
 *
 * Satori needs TTF/OTF data, so each face is fetched from the Google Fonts CSS
 * API as a static instance, subset to the card's own text. A slow or offline
 * build never fails: missing faces fall back to the bundled sans.
 */

type Weight = 400 | 500 | 600
export interface OgFont {
  name: string
  data: ArrayBuffer
  weight: Weight
  style: 'normal' | 'italic'
}

/** Satori family names used by lib/seo/og.tsx. */
export const OG_FONTS = {
  display: 'Fraunces',
  body: 'Newsreader',
  mono: 'DM Mono',
} as const

const FACES: { name: string; query: string; weight: Weight; style: 'normal' | 'italic' }[] = [
  { name: OG_FONTS.display, query: 'Fraunces:opsz,wght@144,600', weight: 600, style: 'normal' },
  { name: OG_FONTS.body, query: 'Newsreader:ital,opsz,wght@1,72,400', weight: 400, style: 'italic' },
  { name: OG_FONTS.body, query: 'Newsreader:opsz,wght@72,400', weight: 400, style: 'normal' },
  { name: OG_FONTS.mono, query: 'DM+Mono:wght@500', weight: 500, style: 'normal' },
]

const TIMEOUT_MS = 6000

async function fetchFace(query: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${query}&text=${encodeURIComponent(text)}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    ).then((r) => (r.ok ? r.text() : ''))
    const src = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:opentype|truetype)'\)/)?.[1]
    if (!src) return null
    const res = await fetch(src, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

/** Every face that loaded, subset to `text` (plus digits and punctuation). */
export async function loadOgFonts(text: string): Promise<OgFont[]> {
  const glyphs = Array.from(new Set(`${text}${text.toUpperCase()}0123456789·→—–-/.,:()&%'"+ `)).join('')
  const faces = await Promise.all(
    FACES.map(async (f) => {
      const data = await fetchFace(f.query, glyphs)
      return data ? { name: f.name, data, weight: f.weight, style: f.style } : null
    }),
  )
  return faces.filter((f): f is OgFont => f !== null)
}
