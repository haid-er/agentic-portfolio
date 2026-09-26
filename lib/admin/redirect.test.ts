import { describe, expect, it } from 'vitest'
import { safeNext } from './redirect'

describe('safeNext', () => {
  it('keeps admin paths and plain deep-link queries', () => {
    expect(safeNext('/admin/site')).toBe('/admin/site')
    expect(safeNext('/admin/site?tab=seo')).toBe('/admin/site?tab=seo')
  })
  it('refuses anything that could leave /admin', () => {
    for (const v of ['//evil.example', 'https://evil.example', '/adminx', '/admin/../x?', '/admin?next=<script>', '/admin/login', null, 42]) {
      const out = safeNext(v)
      expect(out === '/admin' || out.startsWith('/admin/') || out.startsWith('/admin?')).toBe(true)
      expect(out).not.toContain('evil')
      expect(out).not.toContain('<')
    }
    expect(safeNext('/admin/login?next=/x')).toBe('/admin')
    expect(safeNext('/admin/../x')).toBe('/admin')
  })
})
