/** /resume print-optimised page. STUB — owner: resume-contact. */
import type { Metadata } from 'next'
import { getProfile, getResume } from '@/lib/content'

export const metadata: Metadata = { title: 'Résumé' }

export default function ResumePage() {
  const p = getProfile()
  const r = getResume()
  return (
    <article className="wrap py-s8 grid gap-s5">
      <h1 className="text-5">{p.name}</h1>
      {r.summary ? <p className="measure">{r.summary}</p> : null}
    </article>
  )
}
