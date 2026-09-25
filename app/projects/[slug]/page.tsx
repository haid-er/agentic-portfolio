/** /projects/[slug] static detail pages. STUB — owner: projects. */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProofRow } from '@/components/ui'
import { getProject, getProjects } from '@/lib/content'

export function generateStaticParams() {
  return getProjects().map((p) => ({ slug: p.slug }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = getProject((await params).slug)
  return p ? { title: p.title, description: p.summary } : {}
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = getProject((await params).slug)
  if (!p) notFound()
  return (
    <article className="wrap py-s8 grid gap-s5">
      <h1 className="text-5">{p.title}</h1>
      <p className="measure">{p.summary}</p>
      <ProofRow slugs={p.demoSlugs} />
    </article>
  )
}
