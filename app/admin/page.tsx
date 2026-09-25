/** Admin dashboard: collections list. STUB — owner: admin-core. */
import Link from 'next/link'
import { COLLECTIONS } from '@/lib/content'

export const dynamic = 'force-dynamic'

export default function AdminHome() {
  return (
    <div className="grid gap-s5">
      <h1 className="text-4">Admin</h1>
      <ul className="grid gap-2 list-none m-0 p-0">
        {Object.values(COLLECTIONS).map((c) => (
          <li key={c.name}><Link href={`/admin/${c.name}`}>{c.label}</Link> <span className="text-0 text-ink-2">{c.description}</span></li>
        ))}
      </ul>
    </div>
  )
}
