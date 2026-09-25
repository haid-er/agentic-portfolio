/** /playground gallery. STUB — owner: playground-hub. */
import type { Metadata } from 'next'
import Link from 'next/link'
import { getDemos } from '@/lib/demos'

export const metadata: Metadata = { title: 'Playground', description: 'Working demos that prove each skill.' }

export default function PlaygroundPage() {
  const demos = getDemos()
  return (
    <div className="wrap py-s8 grid gap-s6">
      <h1 className="text-5">Playground</h1>
      <ul className="grid gap-3 md:grid-cols-2 list-none m-0 p-0">
        {demos.map((d) => (
          <li key={d.slug}>
            <Link href={`/playground/${d.slug}`} className="display text-2">{d.title}</Link>
            <p className="m-0 text-0 text-ink-2">{d.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
