'use client'
/**
 * Route error boundary: a misprinted proof. The heading is doubled in the
 * accent ink and knocked out of register; "Pull the proof again" calls reset().
 * Client component (Next requirement), so the copy here is generic UI text.
 */
import { useEffect, useRef } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

const TITLE = 'This page failed to print.'

function Corner({ className }: { className: string }) {
  return <Icon name="register" size={18} className={`absolute text-ink-3 ${className}`} />
}

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    console.error(error)
    headingRef.current?.focus()
  }, [error])

  return (
    <div className="wrap py-s8 md:py-s9">
      <div className="relative grid gap-s5 border border-rule bg-surface p-s5 md:p-s7 strata:rounded-2 almanac:shadow-plate">
        <Corner className="left-2 top-2" />
        <Corner className="right-2 top-2" />
        <Corner className="bottom-2 left-2" />
        <Corner className="bottom-2 right-2" />

        <p className="mono m-0 flex items-center gap-2 text-accent-ink">
          <Icon name="alert" size={16} />
          Misprint · the press jammed on this page
        </p>

        <h1 ref={headingRef} tabIndex={-1} className="relative text-[clamp(2.4rem,8vw,5rem)] outline-none">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 select-none text-accent-2 opacity-80 translate-x-[3px] translate-y-[2px] strata:[clip-path:inset(62%_0_0_0)] strata:translate-x-0 strata:translate-y-0"
          >
            {TITLE}
          </span>
          <span className="relative">{TITLE}</span>
        </h1>

        <p role="alert" className="measure m-0 text-1 text-ink-2">
          Something went wrong while this page was being set. Pulling the proof again usually fixes it; if not, the front page and the rest of the site still work.
        </p>

        {error.digest ? (
          <p className="mono m-0 text-ink-3">
            Plate ref <span className="nums text-ink-2 normal-case tracking-normal">{error.digest}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button onClick={reset} icon="refresh">Pull the proof again</Button>
          <ButtonLink href="/" variant="secondary">Back to the front page</ButtonLink>
        </div>
      </div>
    </div>
  )
}
