/** Poster settings: defaults, sanitising (URL / storage input is untrusted) and share links. */
import { z } from 'zod'
import { STYLES, type PosterParams } from './engine'

export const DEFAULTS: PosterParams = {
  seed: 417,
  style: 'swiss',
  format: 'a-series',
  cols: 6,
  headline: 'Signal over noise',
  subline: 'A seeded print from the poster press',
  grid: false,
  misregister: true,
  inks: 'world',
}

export const MAX_HEADLINE = 48
export const MAX_SUBLINE = 64

const Params = z.object({
  seed: z.coerce.number().int().min(1).max(9999).catch(DEFAULTS.seed),
  style: z.enum(STYLES.map((s) => s.value) as [PosterParams['style'], ...PosterParams['style'][]]).catch(DEFAULTS.style),
  format: z.enum(['a-series', 'square']).catch(DEFAULTS.format),
  cols: z.coerce.number().int().min(3).max(12).catch(DEFAULTS.cols),
  headline: z.string().max(MAX_HEADLINE).catch(DEFAULTS.headline),
  subline: z.string().max(MAX_SUBLINE).catch(DEFAULTS.subline),
  grid: z.boolean().catch(DEFAULTS.grid),
  misregister: z.boolean().catch(DEFAULTS.misregister),
  inks: z.enum(['world', 'other', 'single']).catch(DEFAULTS.inks),
})

export function sanitize(raw: unknown): PosterParams {
  const r = Params.safeParse({ ...DEFAULTS, ...(typeof raw === 'object' && raw ? raw : {}) })
  return r.success ? r.data : DEFAULTS
}

/** Read `?seed=417&style=swiss&…` from the current URL, or null when absent. */
export function fromUrl(): PosterParams | null {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search)
  if (!q.has('seed')) return null
  const raw: Record<string, unknown> = {}
  for (const k of ['seed', 'style', 'format', 'cols', 'headline', 'subline', 'inks']) {
    const v = q.get(k)
    if (v !== null) raw[k] = v
  }
  if (q.has('grid')) raw.grid = q.get('grid') === '1'
  if (q.has('mis')) raw.misregister = q.get('mis') === '1'
  return sanitize(raw)
}

export function shareUrl(p: PosterParams): string {
  const q = new URLSearchParams({
    seed: String(p.seed), style: p.style, format: p.format, cols: String(p.cols),
    headline: p.headline, subline: p.subline, inks: p.inks, grid: p.grid ? '1' : '0', mis: p.misregister ? '1' : '0',
  })
  return `${window.location.origin}${window.location.pathname}?${q.toString()}`
}

export const fileName = (p: PosterParams) => `poster-${String(p.seed).padStart(4, '0')}-${p.style}`

export const sameParams = (a: PosterParams, b: PosterParams) => JSON.stringify(a) === JSON.stringify(b)
