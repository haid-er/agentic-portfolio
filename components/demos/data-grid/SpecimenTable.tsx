'use client'
import { useEffect, useRef, useState } from 'react'
import { Badge, Icon, Table, TableWrap, Td, Th, Tr, type Tone } from '@/components/ui'
import { cx } from '@/lib/utils'
import type { Item, SampleStatus } from './dataset'

const STATUS_TONE: Record<SampleStatus, Tone> = { queued: 'warn', logged: 'ok', archived: 'neutral' }

const sig = (i: Item) => `${i.moisture}|${i.status}|${i.starred}|${i.version}`
const hhmmss = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function SpecimenTable({ items, pending, dim, onStar, onCycle }: {
  items: Item[]
  pending: ReadonlySet<string>
  /** Placeholder data from the previous page is shown dimmed. */
  dim: boolean
  onStar: (item: Item) => void
  onCycle: (item: Item) => void
}) {
  // Highlight rows whose values changed since the last render of the same row.
  const seen = useRef(new Map<string, string>())
  const [changed, setChanged] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    const next = new Set<string>()
    for (const it of items) {
      const before = seen.current.get(it.id)
      if (before !== undefined && before !== sig(it)) next.add(it.id)
      seen.current.set(it.id, sig(it))
    }
    if (!next.size) return
    setChanged(next)
    const t = setTimeout(() => setChanged(new Set()), 2600)
    return () => clearTimeout(t)
  }, [items])

  return (
    <TableWrap label="Specimens, current page">
      <Table className={cx('min-w-[560px] transition-opacity duration-[var(--dur-fast)]', dim && 'opacity-60')}>
        <thead>
          <Tr>
            <Th className="w-[52px]"><span className="sr-only">Starred</span></Th>
            <Th>Sample</Th>
            <Th>Site</Th>
            <Th className="text-right">Depth cm</Th>
            <Th className="text-right">Moisture %</Th>
            <Th>Status</Th>
            <Th>Updated</Th>
          </Tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const busy = pending.has(it.id)
            const fresh = changed.has(it.id)
            return (
              <Tr key={it.id}>
                <Td className="py-0 px-1">
                  <button
                    type="button"
                    aria-pressed={it.starred}
                    aria-label={`Star ${it.name}`}
                    aria-disabled={busy || undefined}
                    onClick={() => { if (!busy) onStar(it) }}
                    className={cx(
                      'grid place-items-center size-11 rounded-1 border border-transparent hover:border-rule aria-disabled:opacity-60 aria-disabled:cursor-wait',
                      it.starred ? 'text-accent-ink' : 'text-ink-3',
                    )}
                  >
                    <StarGlyph filled={it.starred} />
                  </button>
                </Td>
                <Td className={cx('whitespace-nowrap font-semibold', fresh && 'bg-bg-2')}>
                  {it.name}
                  <span className="block mono text-ink-3 font-normal">{it.id}</span>
                </Td>
                <Td className="whitespace-nowrap">{it.site}</Td>
                <Td className="text-right">{it.depthCm}</Td>
                <Td className={cx('text-right', fresh && 'bg-bg-2')}>
                  {it.moisture.toFixed(1)}
                  {fresh ? <span className="block mono text-accent-ink">changed</span> : null}
                </Td>
                <Td className="py-1">
                  <button
                    type="button"
                    aria-disabled={busy || undefined}
                    onClick={() => { if (!busy) onCycle(it) }}
                    aria-label={`Status ${it.status}. Change status of ${it.name}`}
                    className="min-h-tap inline-flex items-center aria-disabled:opacity-60 aria-disabled:cursor-wait"
                  >
                    <Badge tone={STATUS_TONE[it.status]}>{it.status}</Badge>
                  </button>
                </Td>
                <Td className="whitespace-nowrap">
                  <span className="mono text-ink-2">{hhmmss(it.updatedAt)}</span>
                  <span className="block mono text-ink-3">
                    {busy ? (<><Icon name="refresh" size={12} className="inline motion-safe:animate-[spin-reg_1.4s_linear_infinite]" /> saving</>) : `v${it.version}`}
                  </span>
                </Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
    </TableWrap>
  )
}

function StarGlyph({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </svg>
  )
}
