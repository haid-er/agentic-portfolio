'use client'
/** Renders children everywhere except /admin (admin has its own chrome). Owner: shell. */
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export function PublicOnly({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '/'
  if (path === '/admin' || path.startsWith('/admin/')) return null
  return <>{children}</>
}
