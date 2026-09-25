/** Admin chrome (site header/footer are hidden on /admin). STUB — owner: admin-core. */
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } }

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="wrap py-s6">{children}</div>
}
