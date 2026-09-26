'use client'
/** Pathfinding tab: edit a grid, run A*, Dijkstra or BFS, and compare what each one explored. */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Badge, Button, DemoPanel, DemoToolbar, Segmented, Table, TableWrap, Td, Th } from '@/components/ui'
import { cx } from '@/lib/utils'
import { Controls, Counter, type Speed } from './Controls'
import { PathStage } from './PathStage'
import {
  EMPTY, MUD, MUD_COST, PATH_ALGOS, WALL, gridSizeFor, mazeGrid, presetGrid, runPath, scatterGrid, emptyGrid, xy,
  type Grid, type PathAlgo,
} from './pathfinding'
import { usePlayback } from './usePlayback'

const ALGO_OPTIONS = (Object.keys(PATH_ALGOS) as PathAlgo[]).map((a) => ({ value: a, label: PATH_ALGOS[a].label }))
type Brush = 'wall' | 'mud'
const BRUSH_OPTIONS = [{ value: 'wall', label: 'Wall' }, { value: 'mud', label: `Mud ×${MUD_COST}` }] as const
const RATES: Record<Speed, number> = { slow: 12, normal: 45, fast: 180 }
const KIND_NAME = ['empty', 'wall', 'mud'] as const

type Drag = { mode: 'start' | 'end' } | { mode: 'paint'; value: number } | null

export function Pathfinding({ active, width }: { active: boolean; width: number }) {
  const hintId = useId()
  const dims = gridSizeFor(width)
  const [grid, setGrid] = useState<Grid>(() => presetGrid(dims.cols, dims.rows))
  const [algo, setAlgo] = useState<PathAlgo>('astar')
  const [brush, setBrush] = useState<Brush>('wall')
  const [speed, setSpeed] = useState<Speed>('normal')
  const [cursor, setCursor] = useState(grid.start)
  const [seed, setSeed] = useState(417)
  const [announce, setAnnounce] = useState('')
  const drag = useRef<Drag>(null)
  const jumpToEnd = useRef(false)

  // Re-lay the board when the stage crosses a size breakpoint.
  useEffect(() => {
    if (grid.cols === dims.cols && grid.rows === dims.rows) return
    const g = presetGrid(dims.cols, dims.rows)
    setGrid(g)
    setCursor(g.start)
  }, [dims.cols, dims.rows, grid.cols, grid.rows])

  const trace = useMemo(() => runPath(grid, algo), [grid, algo])
  const all = useMemo(() => (Object.keys(PATH_ALGOS) as PathAlgo[]).map((a) => runPath(grid, a)), [grid])
  const pb = usePlayback(trace.order.length, RATES[speed], active)
  const { finish, reset } = pb

  // After an edit: keep showing the finished result if the run had finished, else rewind.
  useEffect(() => {
    if (jumpToEnd.current) finish(); else reset()
    jumpToEnd.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the trace changes
  }, [trace])

  const done = pb.step >= pb.total
  useEffect(() => {
    if (!done || pb.total === 0) return
    const name = PATH_ALGOS[trace.algo].name
    setAnnounce(trace.found
      ? `${name} expanded ${trace.order.length} cells. Path: ${trace.path.length - 1} steps, cost ${trace.cost}.`
      : `${name} expanded ${trace.order.length} cells. No path exists.`)
  }, [done, pb.total, trace])

  const edit = useCallback((fn: (g: Grid) => Grid | null) => {
    setGrid((g) => {
      const next = fn(g)
      if (!next) return g
      jumpToEnd.current = pb.step >= pb.total && pb.total > 0
      return next
    })
  }, [pb.step, pb.total])

  const paint = useCallback((i: number, value: number) => edit((g) => {
    if (i === g.start || i === g.end || g.cells[i] === value) return null
    const cells = g.cells.slice()
    cells[i] = value
    return { ...g, cells }
  }), [edit])

  const move = useCallback((which: 'start' | 'end', i: number) => edit((g) => {
    if (g.cells[i] === WALL || i === g.start || i === g.end) return null
    return { ...g, [which]: i }
  }), [edit])

  const brushValue = brush === 'wall' ? WALL : MUD

  const onCellDown = (i: number) => {
    setCursor(i)
    if (i === grid.start) { drag.current = { mode: 'start' }; return }
    if (i === grid.end) { drag.current = { mode: 'end' }; return }
    const value = grid.cells[i] === brushValue ? EMPTY : brushValue
    drag.current = { mode: 'paint', value }
    paint(i, value)
  }
  const onCellEnter = (i: number) => {
    const d = drag.current
    if (!d) return
    if (d.mode === 'paint') paint(i, d.value); else move(d.mode, i)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const [x, y] = xy(grid, cursor)
    const moves: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
    const m = moves[e.key]
    let next = cursor
    if (m) {
      const nx = Math.min(grid.cols - 1, Math.max(0, x + m[0]))
      const ny = Math.min(grid.rows - 1, Math.max(0, y + m[1]))
      next = ny * grid.cols + nx
      setCursor(next)
    } else if (e.key === ' ' || e.key === 'Enter') {
      paint(cursor, grid.cells[cursor] === brushValue ? EMPTY : brushValue)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      paint(cursor, EMPTY)
    } else if (e.key === 's' || e.key === 'S') {
      move('start', cursor)
    } else if (e.key === 'e' || e.key === 'E') {
      move('end', cursor)
    } else return
    e.preventDefault()
    const [cx2, cy2] = xy(grid, next)
    const what = next === grid.start ? 'start' : next === grid.end ? 'end' : KIND_NAME[grid.cells[next]]
    if (m) setAnnounce(`Row ${cy2 + 1}, column ${cx2 + 1}: ${what}.`)
  }

  const load = (kind: 'preset' | 'maze' | 'scatter' | 'clear') => {
    const s = seed + 1
    setSeed(s)
    const g = kind === 'maze' ? mazeGrid(grid.cols, grid.rows, s)
      : kind === 'scatter' ? scatterGrid(grid.cols, grid.rows, s)
      : kind === 'clear' ? emptyGrid(grid.cols, grid.rows)
      : presetGrid(grid.cols, grid.rows)
    jumpToEnd.current = false
    setGrid(g)
    setCursor(g.start)
    setAnnounce(kind === 'clear' ? 'Board cleared.' : `New ${kind === 'preset' ? 'starter' : kind} board loaded.`)
  }

  const minCost = Math.min(...all.filter((t) => t.found).map((t) => t.cost))
  const expanded = Math.min(pb.step, trace.order.length)

  return (
    <div className="grid gap-4 min-w-0">
      <p className="sr-only" aria-live="polite">{announce}</p>
      <DemoPanel title="Grid" meta={<span className="nums">{grid.cols} × {grid.rows} · seed {seed}</span>}>
        <div className="grid gap-4 min-w-0">
          <DemoToolbar>
            <Segmented<PathAlgo> label="Algorithm" options={ALGO_OPTIONS} value={algo} onChange={(a) => { jumpToEnd.current = pb.step >= pb.total && pb.total > 0; setAlgo(a) }} />
            <Segmented<Brush> label="Brush" options={BRUSH_OPTIONS} value={brush} onChange={setBrush} />
          </DemoToolbar>
          <p className="m-0 text-0 text-ink-2 measure">{PATH_ALGOS[algo].blurb}</p>

          <PathStage
            grid={grid}
            trace={trace}
            step={pb.step}
            cursor={cursor}
            onCellDown={onCellDown}
            onCellEnter={onCellEnter}
            onPointerEnd={() => { drag.current = null }}
            onKeyDown={onKeyDown}
            label={`Pathfinding grid, ${grid.cols} columns by ${grid.rows} rows`}
            describedBy={hintId}
          />
          <p id={hintId} className="m-0 text-00 text-ink-3">
            Drag to paint the brush; drag S or E to move them. Keyboard: arrows move the cursor, Space paints, S and E place start and end, Delete clears.
          </p>

          <ul aria-label="Legend" className="m-0 p-0 list-none flex flex-wrap gap-x-4 gap-y-1 font-mono text-00 text-ink-3">
            <li className="flex items-center gap-1"><span aria-hidden="true" className="inline-block size-3 bg-ink" />wall</li>
            <li className="flex items-center gap-1"><span aria-hidden="true" className="inline-block size-3 bg-data-3/30 border border-data-3" />mud (cost {MUD_COST})</li>
            <li className="flex items-center gap-1"><span aria-hidden="true" className="inline-block size-3 bg-data-1/35" />visited</li>
            <li className="flex items-center gap-1"><span aria-hidden="true" className="inline-block size-3 border-2 border-data-2" />frontier</li>
            <li className="flex items-center gap-1"><span aria-hidden="true" className="inline-block h-1 w-4 bg-accent-2 rounded-pill" />path</li>
          </ul>

          <DemoToolbar>
            <Button variant="secondary" size="sm" onClick={() => load('maze')}>Maze</Button>
            <Button variant="secondary" size="sm" onClick={() => load('scatter')}>Scatter</Button>
            <Button variant="ghost" size="sm" onClick={() => load('preset')}>Starter board</Button>
            <Button variant="ghost" size="sm" onClick={() => load('clear')}>Clear</Button>
          </DemoToolbar>
        </div>
      </DemoPanel>

      <DemoPanel title="Run" meta={PATH_ALGOS[algo].complexity}>
        <div className="grid gap-4 min-w-0">
          <Controls pb={pb} speed={speed} onSpeed={setSpeed} label="expansion" />
          <div className="flex flex-wrap gap-4" aria-live="off">
            <Counter label="Expanded" value={expanded} />
            <Counter label="Frontier" value={trace.frontier[Math.min(pb.step, trace.frontier.length - 1)] ?? 0} />
            <Counter label="Path steps" value={done ? (trace.found ? trace.path.length - 1 : 'none') : '…'} />
            <Counter label="Path cost" value={done ? (trace.found ? trace.cost : '—') : '…'} />
          </div>
        </div>
      </DemoPanel>

      <DemoPanel title="Same board, three algorithms" meta="computed instantly">
        <TableWrap label="Comparison of the three algorithms on this board">
          <Table>
            <thead>
              <tr><Th>Algorithm</Th><Th className="text-right">Expanded</Th><Th className="text-right">Steps</Th><Th className="text-right">Cost</Th><Th>Verdict</Th></tr>
            </thead>
            <tbody>
              {all.map((t) => (
                <tr key={t.algo} className={cx(t.algo === algo && 'bg-bg-2')}>
                  <Td>
                    <button type="button" className="underline decoration-accent-ink underline-offset-4 min-h-tap text-left" onClick={() => { jumpToEnd.current = pb.step >= pb.total && pb.total > 0; setAlgo(t.algo) }}>
                      {PATH_ALGOS[t.algo].label}
                    </button>
                  </Td>
                  <Td className="text-right nums">{t.order.length}</Td>
                  <Td className="text-right nums">{t.found ? t.path.length - 1 : '—'}</Td>
                  <Td className="text-right nums">{t.found ? t.cost : '—'}</Td>
                  <Td>
                    {!t.found ? <Badge tone="danger">no path</Badge>
                      : t.cost === minCost ? <Badge tone="ok">cheapest</Badge>
                      : <Badge tone="warn">+{t.cost - minCost} cost</Badge>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
        <p className="m-0 mt-3 text-0 text-ink-2 measure">
          A* and Dijkstra always agree on cost; A* usually expands far fewer cells. BFS counts steps, not cost, so mud can make its path more expensive.
        </p>
      </DemoPanel>
    </div>
  )
}
