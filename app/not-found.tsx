/** 404. STUB — owner: shell. */
import { ButtonLink } from '@/components/ui'

export default function NotFound() {
  return (
    <div className="wrap py-s9 grid gap-s5">
      <p className="mono text-ink-3 m-0">404 · Page not found</p>
      <h1 className="text-5">No layer here.</h1>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/">Back to the front page</ButtonLink>
        <ButtonLink href="/playground" variant="secondary">Open the playground</ButtonLink>
      </div>
    </div>
  )
}
