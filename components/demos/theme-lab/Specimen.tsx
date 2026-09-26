'use client'
/**
 * A miniature page printed in the world being edited: a real subtree with
 * `data-theme` and the edited tokens inline, built from the site's own primitives.
 * An optional colour-vision filter (Machado et al. 2009, severity 1) simulates
 * how the palette reads with protanopia, deuteranopia, tritanopia or no colour.
 */
import type { CSSProperties } from 'react'
import { Badge, Button, Tag } from '@/components/ui'
import type { ThemeKey } from '@/lib/theme/keys'
import type { Palette } from './tokens'

export type Vision = 'none' | 'protan' | 'deutan' | 'tritan' | 'achroma'

const MATRICES: Record<Exclude<Vision, 'none'>, string> = {
  protan: '0.152286 1.052583 -0.204868 0 0  0.114503 0.786281 0.099216 0 0  -0.003882 -0.048116 1.051998 0 0  0 0 0 1 0',
  deutan: '0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0',
  tritan: '1.255528 -0.076749 -0.178779 0 0  -0.078411 0.930809 0.147602 0 0  0.004733 0.691367 0.303900 0 0  0 0 0 1 0',
  achroma: '0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0',
}

/** Hidden SVG filter defs, rendered once. */
export function VisionFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <defs>
        {Object.entries(MATRICES).map(([k, m]) => (
          <filter key={k} id={`tl-cvd-${k}`}>
            <feColorMatrix type="matrix" values={m} />
          </filter>
        ))}
      </defs>
    </svg>
  )
}

const BARS = [0.62, 0.9, 0.45, 0.74]

export function Specimen({ world, label, palette, reads, vision }: {
  world: ThemeKey
  label: string
  palette: Palette
  reads: 'light' | 'dark'
  vision: Vision
}) {
  const style = { ...palette, colorScheme: reads, filter: vision === 'none' ? undefined : `url(#tl-cvd-${vision})` } as CSSProperties
  return (
    <div data-theme={world} style={style} className="bg-bg text-ink border border-rule rounded-2 overflow-hidden font-body">
      <div className="flex justify-between gap-2 px-4 py-2 border-b border-rule font-mono text-00 uppercase tracking-[.1em] text-ink-3">
        <span>Edition: {label}</span>
        <span aria-hidden="true">Specimen</span>
      </div>
      <div className="grid gap-4 p-4 bg-bg-2">
        <div className="grid gap-3 p-4 bg-surface rounded-2 border border-rule shadow-plate">
          <p className="m-0 font-mono text-00 uppercase tracking-[.1em] text-accent-ink">02 · Working record</p>
          <p className="display m-0 text-4 text-ink">Proof, printed</p>
          <p className="m-0 text-1 text-ink-2">
            Secondary ink sets the lede, with <em className="text-accent">an accent word</em>, a <a href="#tl-preview" tabIndex={-1} className="text-accent underline decoration-accent-ink underline-offset-2">link</a> and
            meta in the third ink below.
          </p>
          <p className="m-0 font-mono text-00 uppercase tracking-[.1em] text-ink-3">Meta · third ink · tabular 0123</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" tabIndex={-1}>Primary</Button>
            <Button size="sm" variant="secondary" tabIndex={-1}>Secondary</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="ok">OK</Badge>
            <Badge tone="warn">Warn</Badge>
            <Badge tone="danger">Danger</Badge>
            <Badge tone="accent">Accent</Badge>
            <Tag>mono tag</Tag>
          </div>
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 items-end">
          <p className="display m-0 text-5 leading-none text-accent-2" aria-hidden="true">Aa</p>
          <svg viewBox="0 0 120 48" className="w-full h-12" role="img" aria-label="Four data inks as bars">
            {BARS.map((v, i) => (
              <rect key={i} x={i * 30 + 4} y={48 - v * 44} width={22} height={v * 44} fill={`var(--data-${i + 1})`} />
            ))}
            <path d="M0 47.5H120" stroke="var(--rule)" strokeWidth="1" />
          </svg>
        </div>
        <div className="flex items-center gap-3 px-3 min-h-tap bg-surface border border-rule rounded-0">
          <span className="font-mono text-0 text-ink-3">Input placeholder</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2 bg-accent text-on-accent rounded-1">
          <span className="font-mono text-00 uppercase tracking-[.1em]">Text on accent</span>
        </div>
      </div>
    </div>
  )
}
