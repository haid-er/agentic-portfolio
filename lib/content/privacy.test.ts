import { describe, expect, it } from 'vitest'
import { makeExcluded, siteExcluded } from './privacy'

describe('never-render terms', () => {
  const isExcluded = makeExcluded(['secret-client'])
  it('matches contract terms at the start of a word, any case', () => {
    expect(isExcluded('vlad-app')).toBe(true)
    expect(isExcluded('FallNet2')).toBe(true)
    expect(isExcluded('the LOGICCOVE repo')).toBe(true)
  })
  it('does not match inside a word', () => {
    expect(isExcluded('novladimir')).toBe(false)
    expect(isExcluded('motioniq')).toBe(false)
  })
  it('adds content terms, escaped', () => {
    expect(isExcluded('Secret-Client portal')).toBe(true)
    expect(makeExcluded(['a.b'])('axb')).toBe(false)
  })
  it('reads site.privacy defensively', () => {
    expect(siteExcluded(undefined)).toEqual([])
    expect(siteExcluded({ privacy: { excluded: ['x', '', 3, 'vlad'] } })).toEqual(['x'])
  })
})
