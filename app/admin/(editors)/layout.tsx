/** Editors layout: collection rail (desktop) / chip row (phone) beside the form. Owner: admin-editors. */
import type { ReactNode } from 'react'
import { CollectionNav, type NavItem } from '@/components/admin'
import { COLLECTIONS, type CollectionName } from '@/lib/content'

const GROUPS: Record<CollectionName, string> = {
  site: 'Site', theme: 'Site', resume: 'Site',
  experience: 'Record', skills: 'Record', projects: 'Record', research: 'Record',
  education: 'Credentials', certifications: 'Credentials', achievements: 'Credentials',
  services: 'Offer', testimonials: 'Offer',
  playground: 'Playground & AI', ai: 'Playground & AI',
}

const ORDER: CollectionName[] = [
  'site', 'theme', 'resume',
  'experience', 'skills', 'projects', 'research',
  'education', 'certifications', 'achievements',
  'services', 'testimonials',
  'playground', 'ai',
]

export default function EditorsLayout({ children }: { children: ReactNode }) {
  const items: NavItem[] = ORDER.map((n) => ({ name: n, label: COLLECTIONS[n].label, group: GROUPS[n] }))
  return (
    <div className="grid gap-s5 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-s7 items-start">
      {/* Admin has no folio bar; lift toasts above the sticky save bar on phones instead. */}
      <style>{':root{--folio-bar:120px}'}</style>
      <CollectionNav items={items} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
