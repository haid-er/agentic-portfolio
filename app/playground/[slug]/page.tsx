/** /playground/[slug] renders one demo via the registry. STUB — owner: playground-hub. */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDemo, getDemos } from '@/lib/demos'
import { DemoRenderer } from '@/lib/demos/loaders'

export function generateStaticParams() {
  return getDemos().map((d) => ({ slug: d.slug }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = getDemo((await params).slug)
  return d ? { title: d.title, description: d.summary } : {}
}

export default async function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const demo = getDemo((await params).slug)
  if (!demo) notFound()
  return (
    <div className="wrap py-s8 grid gap-s6">
      <header className="grid gap-3">
        <p className="mono text-ink-3 m-0">Playground · {demo.runsIn}</p>
        <h1 className="text-5">{demo.title}</h1>
        <p className="measure m-0">{demo.summary}</p>
      </header>
      <DemoRenderer slug={demo.slug} />
      {demo.notes.howItWorks ? <p className="measure text-0 text-ink-2">{demo.notes.howItWorks}</p> : null}
    </div>
  )
}
