'use client'
/** Sorting tab: four algorithms on the same seeded input, with a narrated step log and counters. */
import { useEffect, useMemo, useState } from 'react'
import { Button, DemoPanel, DemoToolbar, Segmented, Table, TableWrap, Td, Th } from '@/components/ui'
import { cx } from '@/lib/utils'
import { Controls, Counter, type Speed } from './Controls'
import { Range } from './Range'
import { SortStage } from './SortStage'
import { INPUT_SHAPES, SORT_ALGOS, frameAt, makeInput, runSort, type InputShape, type SortAlgo, type SortFrame } from './sorting'
import { usePlayback } from './usePlayback'

const ALGO_OPTIONS = (Object.keys(SORT_ALGOS) as SortAlgo[]).map((a) => ({ value: a, label: SORT_ALGOS[a].label }))
const SHAPE_OPTIONS = (Object.keys(INPUT_SHAPES) as InputShape[]).map((s) => ({ value: s, label: INPUT_SHAPES[s] }))
const RATES: Record<Speed, number> = { slow: 6, normal: 30, fast: 140 }

function narrate(f: SortFrame): string {
  const op = f.last
  if (!op) return 'Ready. Press Play or Step.'
  const v = f.values
  switch (op.t) {
    case 'cmp': return `Compare a[${op.i}] and a[${op.j}]`
    case 'swap': return `Swap a[${op.i}] ↔ a[${op.j}] (now ${v[op.i]}, ${v[op.j]})`
    case 'set': return `Write ${op.v} into a[${op.i}]`
    case 'done': return `a[${op.i}] = ${v[op.i]} is in its final place`
    case 'pivot': return `Pivot: a[${op.i}] = ${v[op.i]}`
  }
}

export function Sorting({ active, compact }: { active: boolean; compact: boolean }) {
  const [algo, setAlgo] = useState<SortAlgo>('quick')
  const [shape, setShape] = useState<InputShape>('random')
  const [n, setN] = useState(compact ? 16 : 32)
  const [seed, setSeed] = useState(417)
  const [speed, setSpeed] = useState<Speed>('normal')

  const input = useMemo(() => makeInput(shape, n, seed), [shape, n, seed])
  const trace = useMemo(() => runSort(algo, input), [algo, input])
  const all = useMemo(() => (Object.keys(SORT_ALGOS) as SortAlgo[]).map((a) => runSort(a, input)), [input])
  const pb = usePlayback(trace.ops.length, RATES[speed], active)
  const { reset } = pb
  useEffect(() => { reset() }, [trace, reset])

  const frame = useMemo(() => frameAt(trace, pb.step), [trace, pb.step])
  const max = Math.max(...input)
  const info = SORT_ALGOS[algo]
  const maxCmp = Math.max(1, ...all.map((t) => t.cmps[t.ops.length]))
  const done = pb.step >= pb.total

  return (
    <div className="grid gap-4 min-w-0">
      <DemoPanel title="Array" meta={<span className="nums">n = {n} · seed {seed}</span>}>
        <div className="grid gap-4 min-w-0">
          <DemoToolbar>
            <Segmented<SortAlgo> label="Algorithm" options={ALGO_OPTIONS} value={algo} onChange={setAlgo} />
          </DemoToolbar>
          <p className="m-0 text-0 text-ink-2 measure">{info.blurb}</p>
          <SortStage frame={frame} max={max} label={`${info.name}, ${n} bars, step ${pb.step} of ${pb.total}${done ? ', sorted' : ''}`} />
          <p className="m-0 font-mono text-0 text-ink min-h-[1.5em]" aria-live={pb.playing ? 'off' : 'polite'}>
            <span className="text-ink-3">{String(pb.step).padStart(4, '0')} </span>{done && pb.total > 0 ? 'Sorted.' : narrate(frame)}
          </p>
          <ul aria-label="Legend" className="m-0 p-0 list-none flex flex-wrap gap-x-4 gap-y-1 font-mono text-00 text-ink-3">
            <li className="flex items-center gap-1"><span aria-hidden="true" className="inline-block size-3 bg-data-2" />▼ compared</li>
            <li className="flex items-center gap-1"><span aria-hidden="true" className="inline-block size-3 bg-data-3 border-t-2 border-ink" />written / swapped</li>
            <li className="flex items-center gap-1"><span aria-hidden="true" className="inline-block size-3 bg-data-1" />final place</li>
            {algo === 'quick' ? <li className="flex items-center gap-1"><span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed border-accent-2" />pivot value</li> : null}
          </ul>
          <DemoToolbar>
            <Segmented<InputShape> label="Input" options={SHAPE_OPTIONS} value={shape} onChange={setShape} />
          </DemoToolbar>
          <DemoToolbar>
            <Range label="Size" value={n} min={8} max={64} onChange={setN} format={(v) => `${v} items`} />
            <Button variant="secondary" size="sm" icon="refresh" onClick={() => setSeed((s) => s + 1)}>Reshuffle</Button>
          </DemoToolbar>
        </div>
      </DemoPanel>

      <DemoPanel title="Run" meta={`${info.avg} average · ${info.space} space`}>
        <div className="grid gap-4 min-w-0">
          <Controls pb={pb} speed={speed} onSpeed={setSpeed} label="operation" />
          <div className="flex flex-wrap gap-4">
            <Counter label="Comparisons" value={trace.cmps[pb.step]} />
            <Counter label="Writes" value={trace.writes[pb.step]} note="a swap counts 2" />
            <Counter label="Operations" value={pb.step} />
          </div>
        </div>
      </DemoPanel>

      <DemoPanel title="Same input, four algorithms" meta="computed instantly">
        <TableWrap label="Comparison of the four sorting algorithms on this input">
          <Table>
            <thead>
              <tr>
                <Th>Algorithm</Th><Th className="text-right">Comparisons</Th><Th className="text-right">Writes</Th>
                <Th>Best / avg / worst</Th><Th>Stable</Th>
              </tr>
            </thead>
            <tbody>
              {all.map((t) => {
                const a = SORT_ALGOS[t.algo]
                const c = t.cmps[t.ops.length]
                return (
                  <tr key={t.algo} className={cx(t.algo === algo && 'bg-bg-2')}>
                    <Td>
                      <button type="button" className="underline decoration-accent-ink underline-offset-4 min-h-tap text-left" onClick={() => setAlgo(t.algo)}>{a.label}</button>
                    </Td>
                    <Td className="text-right">
                      <span className="nums">{c}</span>
                      <span aria-hidden="true" className="block h-1 mt-1 bg-data-1 ml-auto" style={{ width: `${Math.max(4, (c / maxCmp) * 100)}%` }} />
                    </Td>
                    <Td className="text-right nums">{t.writes[t.ops.length]}</Td>
                    <Td className="whitespace-nowrap font-mono text-00">{a.best} / {a.avg} / {a.worst}</Td>
                    <Td>{a.stable ? 'yes' : 'no'}</Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </TableWrap>
        <p className="m-0 mt-3 text-0 text-ink-2 measure">
          Try “Nearly sorted”: insertion sort wins outright, while this quicksort (last element as pivot) degrades towards n². Merge sort barely notices.
        </p>
      </DemoPanel>
    </div>
  )
}
