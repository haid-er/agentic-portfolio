'use client'
/** The prompt drawn as its estimated token pieces, alternating inks like a proof sheet. */
import { useMemo } from 'react'
import { cx } from '@/lib/utils'
import { pieces } from './tokens'

const MAX_PIECES = 900

export function TokenView({ text, label }: { text: string; label: string }) {
  const list = useMemo(() => pieces(text), [text])
  const shown = list.slice(0, MAX_PIECES)
  return (
    <figure className="m-0 grid gap-1">
      <div
        className="max-h-56 overflow-auto p-3 bg-bg-2 rounded-0 font-mono text-00 leading-[1.9] whitespace-pre-wrap [overflow-wrap:anywhere]"
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        {shown.map((p, i) => (
          <span
            key={i}
            title={`≈${p.tokens} token${p.tokens === 1 ? '' : 's'}`}
            className={cx(
              'rounded-[2px] px-[1px]',
              p.tokens > 1 ? 'bg-[color-mix(in_srgb,var(--data-2)_22%,transparent)]' : i % 2 ? 'bg-[color-mix(in_srgb,var(--data-1)_16%,transparent)]' : 'bg-[color-mix(in_srgb,var(--data-3)_14%,transparent)]',
            )}
          >
            {p.text}
          </span>
        ))}
        {list.length > MAX_PIECES ? <span className="text-ink-3"> … {list.length - MAX_PIECES} more pieces</span> : null}
      </div>
      <figcaption className="mono text-ink-3">Each tint is one pre-token piece · warmer tint = piece likely split into 2+ tokens</figcaption>
    </figure>
  )
}
