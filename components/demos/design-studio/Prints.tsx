'use client'
/** Recent pulls (this session) and the kept drawer (this browser), as tappable thumbnails. */
import { useMemo } from 'react'
import { DemoPanel, EmptyState, Icon } from '@/components/ui'
import { approxMeasure, makePoster, STYLES, type PosterParams } from './engine'
import { posterSvg, type Fonts, type Inks } from './render'

function Thumb({ p, inks, fonts, onClick, label }: { p: PosterParams; inks: Inks; fonts: Fonts; onClick: () => void; label: string }) {
  const svg = useMemo(() => posterSvg(makePoster(p, approxMeasure), inks, fonts), [p, inks, fonts])
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="block w-full min-h-tap border border-rule bg-surface p-1 rounded-0 hover:-translate-y-[2px] transition-transform duration-[var(--dur-fast)] [&_svg]:block [&_svg]:w-full [&_svg]:h-auto"
    >
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
      <span className="mt-1 block mono text-ink-3 text-left">{String(p.seed).padStart(4, '0')}</span>
    </button>
  )
}

const describe = (p: PosterParams) =>
  `Restore print No. ${String(p.seed).padStart(4, '0')}, ${STYLES.find((s) => s.value === p.style)?.label ?? p.style}`

export function Prints({ history, kept, inks, fonts, onRestore, onRemoveKept }: {
  history: PosterParams[]
  kept: PosterParams[]
  inks: Inks | null
  fonts: Fonts | null
  onRestore: (p: PosterParams) => void
  onRemoveKept: (i: number) => void
}) {
  if (!inks || !fonts) return null
  return (
    <div className="grid gap-4">
      <DemoPanel title="Recent pulls" meta={history.length ? `${history.length} this session` : undefined}>
        {history.length ? (
          <ul className="m-0 p-0 list-none grid grid-cols-4 xs:grid-cols-6 md:grid-cols-8 gap-2">
            {history.map((p) => (
              <li key={JSON.stringify(p)}><Thumb p={p} inks={inks} fonts={fonts} onClick={() => onRestore(p)} label={describe(p)} /></li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-0 text-ink-2">Every print you pull lands here, so a good one is never lost.</p>
        )}
      </DemoPanel>

      <DemoPanel title="Drawer" meta={kept.length ? `${kept.length} kept` : undefined}>
        {kept.length ? (
          <ul className="m-0 p-0 list-none grid grid-cols-3 xs:grid-cols-4 md:grid-cols-6 gap-3">
            {kept.map((p, i) => (
              <li key={JSON.stringify(p)} className="grid gap-1">
                <Thumb p={p} inks={inks} fonts={fonts} onClick={() => onRestore(p)} label={describe(p)} />
                <button
                  type="button"
                  onClick={() => onRemoveKept(i)}
                  className="min-h-tap inline-flex items-center justify-center gap-1 mono text-ink-3 hover:text-danger"
                  aria-label={`Remove print No. ${String(p.seed).padStart(4, '0')} from the drawer`}
                >
                  <Icon name="close" size={14} /> Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="The drawer is empty">Press Keep on a print you like. Kept prints stay in this browser only.</EmptyState>
        )}
      </DemoPanel>
    </div>
  )
}
