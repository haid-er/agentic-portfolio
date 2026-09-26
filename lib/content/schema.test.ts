import { describe, expect, it } from 'vitest'
import { COLLECTIONS, getRawCollection } from './index'
import { Projects, Site, SCHEMAS, type CollectionName } from './schema'
import { themeCheck } from '@/components/admin/lib/themeCheck'

describe('content', () => {
  it('every collection in content/ validates', () => {
    for (const name of Object.keys(SCHEMAS) as CollectionName[]) {
      const r = SCHEMAS[name].safeParse(getRawCollection(name))
      expect(r.success, `${name}: ${r.success ? '' : JSON.stringify(r.error.issues.slice(0, 3))}`).toBe(true)
    }
    expect(Object.keys(COLLECTIONS).length).toBe(Object.keys(SCHEMAS).length)
  })

  it('rejects duplicate ids and slugs', () => {
    const projects = structuredClone(getRawCollection('projects')) as { items: { id: string; slug: string }[] }
    projects.items.push({ ...projects.items[0]! })
    const r = Projects.safeParse(projects)
    expect(r.success).toBe(false)
    expect(r.error?.issues.some((i) => /Duplicate (id|slug)/.test(i.message))).toBe(true)

    const site = structuredClone(getRawCollection('site')) as { socials: unknown[] }
    site.socials.push(site.socials[0])
    expect(Site.safeParse(site).success).toBe(false)
  })

  it('rejects malformed hero plate refs', () => {
    const site = structuredClone(getRawCollection('site')) as { hero: { plateLayers?: string[] } }
    site.hero.plateLayers = ['experience:euthyna', 'Nope']
    expect(Site.safeParse(site).success).toBe(false)
  })

  it('shipped theme passes the contrast gate, and a bad retune fails it', () => {
    const theme = structuredClone(getRawCollection('theme')) as { themes: { almanac: { tokens: Record<string, string> } } }
    expect(themeCheck(theme)).toEqual([])
    theme.themes.almanac.tokens['--ink'] = '#F2EADB'
    expect(themeCheck(theme).length).toBeGreaterThan(0)
  })
})
