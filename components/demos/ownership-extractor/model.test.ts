import { describe, expect, it } from 'vitest'
import { consolidate, type Group } from './model'

const split = (subToTarget: 'unstated' | 'none'): Group => ({
  parentId: 'parent',
  entities: [
    { id: 'parent', name: 'Parent', emissions: null },
    { id: 'sub', name: 'Sub', emissions: null },
    { id: 'target', name: 'Target', emissions: null },
  ],
  links: [
    { id: 'a', owner: 'parent', owned: 'sub', equityPct: 100, control: 'unstated' },
    { id: 'b', owner: 'parent', owned: 'target', equityPct: 30, control: 'unstated' },
    { id: 'c', owner: 'sub', owned: 'target', equityPct: 30, control: subToTarget },
  ],
})

describe('ownership consolidate()', () => {
  it('adds a split holding up to control (30% direct + 30% via a wholly owned sub)', () => {
    const r = consolidate(split('unstated')).byId.target!
    expect(r.equity).toBeCloseTo(0.6, 10)
    expect(r.financial).toBe(1)
    expect(r.operational).toBe(1)
  })
  it('gives no control when one of the two links is marked none', () => {
    const r = consolidate(split('none')).byId.target!
    expect(r.financial).toBe(0)
    expect(r.operational).toBe(0)
  })
})
