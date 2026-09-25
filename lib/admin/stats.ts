/**
 * One-line facts per collection for the dashboard cards (counts only, read
 * from the content itself; nothing is estimated). Owner: admin-core. Server only.
 */
import 'server-only'
import { getRawCollection } from '@/lib/content'
import type { CollectionName } from '@/lib/content/schema'

export interface CollectionStats {
  /** e.g. "14 items · 11 shown". */
  line: string
  /** Items marked verified: false (badge). */
  unverified: number
  /** Items hidden from the site. */
  hidden: number
}

type Listish = { items: Array<{ enabled: boolean; verified?: boolean }> }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function collectionStats(name: CollectionName): CollectionStats {
  const raw = getRawCollection(name) as unknown
  const none = { unverified: 0, hidden: 0 }

  if (raw && typeof raw === 'object' && Array.isArray((raw as Listish).items)) {
    const items = (raw as Listish).items
    const shown = items.filter((i) => i.enabled).length
    return {
      line: items.length ? `${plural(items.length, 'item')} · ${shown} shown` : 'No items yet',
      unverified: items.filter((i) => i.verified === false).length,
      hidden: items.length - shown,
    }
  }

  switch (name) {
    case 'site': {
      const s = getRawCollection('site')
      const shown = s.sections.filter((x) => x.enabled).length
      return { line: `${shown} of ${plural(s.sections.length, 'section')} shown · ${plural(s.socials.length, 'social link')}`, ...none, hidden: s.sections.length - shown }
    }
    case 'theme': {
      const t = getRawCollection('theme')
      const tokens = Object.keys(t.themes.almanac.tokens).length + Object.keys(t.themes.strata.tokens).length
      return { line: `${t.themes.almanac.label} · ${t.themes.strata.label} · ${plural(tokens, 'token')} set`, ...none }
    }
    case 'resume': {
      const r = getRawCollection('resume')
      return { line: `${r.enabled ? 'Shown' : 'Hidden'} · ${r.pdfUrl ? 'PDF attached' : 'no PDF'}`, ...none, hidden: r.enabled ? 0 : 1 }
    }
    case 'playground': {
      const p = getRawCollection('playground')
      const shown = p.demos.filter((d) => d.enabled).length
      return { line: `${shown} of ${plural(p.demos.length, 'demo')} shown · featured ${p.featured}`, ...none, hidden: p.demos.length - shown }
    }
    case 'ai': {
      const a = getRawCollection('ai')
      const on = (Object.keys(a.providers) as Array<keyof typeof a.providers>).filter((k) => a.providers[k].enabled)
      return { line: `${on.length ? on.join(' → ') : 'No providers'} · max ${a.maxTokens} tokens`, ...none }
    }
    default:
      return { line: '', ...none }
  }
}
