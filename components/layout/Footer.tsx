/** Colophon title block (DESIGN.md 11). STUB — owner: shell. */
import { getProfile, getSite, getSocials } from '@/lib/content'

export function Footer() {
  const profile = getProfile()
  const { masthead } = getSite()
  return (
    <footer className="mt-s8 border-t-2 border-rule">
      <div className="wrap grid gap-4 py-s6 text-0 text-ink-2 md:grid-cols-4">
        <p className="m-0"><span className="mono block text-ink-3">Project</span>{profile.name}, portfolio</p>
        <p className="m-0"><span className="mono block text-ink-3">Contact</span>{profile.email}</p>
        <ul className="m-0 p-0 list-none">
          {getSocials().map((s) => <li key={s.id}><a href={s.url} rel="me noopener noreferrer" target="_blank">{s.label}</a></li>)}
        </ul>
        <p className="m-0 italic">{profile.motto}</p>
        <p className="m-0 md:col-span-4 mono text-ink-3">{masthead.colophon}</p>
      </div>
    </footer>
  )
}
