'use client'
/** Renders a streamed answer: paragraphs, "- " bullets, **bold**, and [n] citation chips. */
import type { ReactNode } from 'react'
import { cx } from '@/lib/utils'
import { parseCitations } from './answer'

function bold(text: string, key: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={`${key}-b${i}`}>{part.slice(2, -2)}</strong>
      : part,
  )
}

export function Rich({ text, max, idPrefix, titles, onCite, onJump }: {
  text: string
  /** Number of sources (citations above this render as text). */
  max: number
  /** Anchor prefix for the source list, e.g. "t3-src". */
  idPrefix: string
  titles: string[]
  onCite?: (n: number | null) => void
  /** Runs before the browser jumps to a source, e.g. to expand a collapsed list. */
  onJump?: () => void
}) {
  const blocks: Array<{ list: boolean; lines: string[] }> = []
  let cur: { list: boolean; lines: string[] } | null = null
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const l = raw.trimEnd()
    if (!l.trim()) { cur = null; continue }
    const isItem = /^\s*([-*•]|\d+\.)\s+/.test(l)
    if (cur && cur.list === isItem) { cur.lines.push(l); continue }
    cur = { list: isItem, lines: [l] }
    blocks.push(cur)
  }

  const renderLine = (line: string, key: string) =>
    parseCitations(line.replace(/^\s*([-*•]|\d+\.)\s+/, ''), max).map((seg, i) =>
      seg.kind === 'text' ? (
        <span key={`${key}-${i}`}>{bold(seg.text, `${key}-${i}`)}</span>
      ) : (
        <a
          key={`${key}-${i}`}
          href={`#${idPrefix}-${seg.n}`}
          onClick={onJump}
          onMouseEnter={() => onCite?.(seg.n)}
          onMouseLeave={() => onCite?.(null)}
          onFocus={() => onCite?.(seg.n)}
          onBlur={() => onCite?.(null)}
          aria-label={`Source ${seg.n}: ${titles[seg.n - 1] ?? ''}`}
          className={cx(
            'mx-[2px] inline-flex min-w-[1.6em] items-center justify-center px-1 align-[.12em]',
            'font-mono text-00 leading-[1.5] no-underline rounded-0 border border-accent text-accent-ink bg-bg-2',
            'hover:bg-accent hover:text-on-accent focus-visible:bg-accent focus-visible:text-on-accent',
          )}
        >
          {seg.n}
        </a>
      ),
    )

  return (
    <div className="grid gap-2">
      {blocks.filter((b) => b.lines.length).map((b, bi) =>
        b.list ? (
          <ul key={bi} className="m-0 grid gap-1 pl-5 list-[square] marker:text-accent-2">
            {b.lines.map((l, li) => <li key={li}>{renderLine(l, `${bi}-${li}`)}</li>)}
          </ul>
        ) : (
          <p key={bi} className="m-0 measure">{b.lines.map((l, li) => <span key={li}>{li ? <br /> : null}{renderLine(l, `${bi}-${li}`)}</span>)}</p>
        ),
      )}
    </div>
  )
}
