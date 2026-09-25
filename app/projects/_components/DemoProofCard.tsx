/**
 * A related playground demo on a project page, in a compact specimen-sheet
 * form (DESIGN.md 10): glyph + where it runs, title, what it does, the real
 * work it mirrors (inset with a vermilion/lichen bar), the phone note, and
 * "Open demo". All copy comes from the demo registry (+ admin overrides).
 */
import Link from 'next/link'
import { Card, Icon, buttonClasses } from '@/components/ui'
import { demoGlyph, type Demo } from '@/lib/demos'
import { pillarLayer } from '../_lib/model'

const RUNS_IN: Record<Demo['runsIn'], string> = {
  browser: 'Runs in browser',
  edge: 'Runs at the edge',
  server: 'Runs on the server',
  'browser + ai': 'Browser + AI gateway',
}

export function DemoProofCard({ demo }: { demo: Demo }) {
  return (
    <Card as="article" layer={pillarLayer(demo.pillar)} className="flex h-full flex-col gap-s3">
      <p className="mono text-ink-3 m-0 flex flex-wrap items-center gap-2">
        <Icon name={demoGlyph(demo)} size={16} className="text-accent-ink strata:text-[var(--card-layer)]" />
        <span>{RUNS_IN[demo.runsIn]}</span>
        <span aria-hidden="true">·</span>
        <span className="normal-case tracking-normal">{demo.slug}</span>
      </p>
      <h3 className="text-2">
        <Link href={`/playground/${demo.slug}`} className="no-underline hover:underline decoration-accent-2 decoration-2">
          {demo.title}
        </Link>
      </h3>
      {demo.summary ? <p className="m-0 text-0 text-ink-2">{demo.summary}</p> : null}
      {demo.mirrors ? (
        <p className="m-0 text-0 bg-bg-2 border-l-4 border-accent-2 px-s3 py-s2 rounded-0">
          <span className="mono text-ink-3 block">Mirrors</span>
          {demo.mirrors}
        </p>
      ) : null}
      <div className="mt-auto grid gap-s2 pt-s2">
        <p className="m-0 mono text-ink-3 flex items-center gap-2">
          <Icon name={demo.mobile.ok ? 'check' : 'info'} size={14} />
          {demo.mobile.ok ? 'Works on phone' : `Best on desktop: ${demo.mobile.reason}`}
        </p>
        <Link href={`/playground/${demo.slug}`} className={buttonClasses({ variant: 'primary', size: 'sm', className: 'justify-self-start' })}>
          Open demo
          <Icon name="arrow" size={14} />
          <span className="sr-only">: {demo.title}</span>
        </Link>
      </div>
    </Card>
  )
}
