'use client'
/**
 * Scroll-spy: the id of the homepage section crossing a thin reading line
 * ~42% down the viewport. Returns null away from the homepage.
 */
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export function useActiveSection(ids: readonly string[]): string | null {
  const pathname = usePathname()
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join(',')

  useEffect(() => {
    if (pathname !== '/' || typeof IntersectionObserver === 'undefined') return
    const els = key.split(',').map((id) => document.getElementById(id)).filter((n): n is HTMLElement => Boolean(n))
    if (!els.length) return
    const crossing = new Set<string>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) crossing.add(e.target.id)
          else crossing.delete(e.target.id)
        }
        const first = els.find((n) => crossing.has(n.id))
        if (first) setActive(first.id)
      },
      { rootMargin: '-42% 0px -56% 0px' },
    )
    els.forEach((n) => io.observe(n))
    return () => { io.disconnect(); setActive(null) }
  }, [pathname, key])

  return pathname === '/' ? active : null
}
