/**
 * Grid pathfinding: BFS, Dijkstra and A* on a 4-connected grid with walls and "mud" (cost 5).
 * Each run is recorded as a trace (expansion order + when each cell entered the frontier),
 * so the UI can play, step and scrub without re-running the search.
 */
import { seeded } from '@/lib/utils'
import { MinHeap } from './heap'

export const EMPTY = 0
export const WALL = 1
export const MUD = 2
export type CellKind = typeof EMPTY | typeof WALL | typeof MUD

export const MUD_COST = 5

export interface Grid {
  cols: number
  rows: number
  cells: Uint8Array
  start: number
  end: number
}

export type PathAlgo = 'astar' | 'dijkstra' | 'bfs'

export const PATH_ALGOS: Record<PathAlgo, { label: string; name: string; blurb: string; weighted: boolean; complexity: string }> = {
  astar: {
    label: 'A*',
    name: 'A* search',
    blurb: 'Dijkstra plus a Manhattan-distance heuristic, so it expands towards the goal first. Optimal, because the heuristic never overestimates.',
    weighted: true,
    complexity: 'O(E log V)',
  },
  dijkstra: {
    label: 'Dijkstra',
    name: 'Dijkstra',
    blurb: 'Always expands the cheapest known cell next, using a binary heap. Grows in rings of equal cost, so it finds the cheapest path through mud.',
    weighted: true,
    complexity: 'O(E log V)',
  },
  bfs: {
    label: 'BFS',
    name: 'Breadth-first search',
    blurb: 'A plain FIFO queue. Fewest steps, but it ignores weights, so it happily walks through mud.',
    weighted: false,
    complexity: 'O(V + E)',
  },
}

export interface PathTrace {
  algo: PathAlgo
  /** Cells in the order they were expanded (popped). */
  order: number[]
  /** Expansion step (1-based) per cell, 0 if never expanded. */
  visitAt: Int32Array
  /** Step at which a cell first entered the frontier (start = 0), -1 if never. */
  seenAt: Int32Array
  /** Frontier size after each step (index 0..order.length). */
  frontier: number[]
  path: number[]
  /** Sum of entry costs along the path (mud = 5, else 1). */
  cost: number
  found: boolean
}

export const idx = (g: Pick<Grid, 'cols'>, x: number, y: number) => y * g.cols + x
export const xy = (g: Pick<Grid, 'cols'>, i: number) => [i % g.cols, Math.floor(i / g.cols)] as const

export function stepCost(g: Grid, i: number) {
  return g.cells[i] === MUD ? MUD_COST : 1
}

function neighbours(g: Grid, i: number, out: number[]) {
  out.length = 0
  const [x, y] = xy(g, i)
  // Fixed order (up, right, down, left) keeps traces deterministic.
  if (y > 0) out.push(i - g.cols)
  if (x < g.cols - 1) out.push(i + 1)
  if (y < g.rows - 1) out.push(i + g.cols)
  if (x > 0) out.push(i - 1)
  for (let k = out.length - 1; k >= 0; k--) if (g.cells[out[k]] === WALL) out.splice(k, 1)
  return out
}

function manhattan(g: Grid, a: number, b: number) {
  const [ax, ay] = xy(g, a)
  const [bx, by] = xy(g, b)
  return Math.abs(ax - bx) + Math.abs(ay - by)
}

export function runPath(g: Grid, algo: PathAlgo): PathTrace {
  const n = g.cols * g.rows
  const visitAt = new Int32Array(n)
  const seenAt = new Int32Array(n).fill(-1)
  const parent = new Int32Array(n).fill(-1)
  const dist = new Float64Array(n).fill(Infinity)
  const order: number[] = []
  const frontier: number[] = [1]
  const nb: number[] = []
  let open = 1
  let found = false

  dist[g.start] = 0
  seenAt[g.start] = 0

  if (algo === 'bfs') {
    const queue = [g.start]
    let head = 0
    while (head < queue.length) {
      const cur = queue[head++]
      open--
      order.push(cur)
      visitAt[cur] = order.length
      if (cur === g.end) { found = true; frontier.push(open); break }
      for (const nx of neighbours(g, cur, nb)) {
        if (seenAt[nx] !== -1) continue
        seenAt[nx] = order.length
        parent[nx] = cur
        dist[nx] = dist[cur] + stepCost(g, nx)
        queue.push(nx)
        open++
      }
      frontier.push(open)
    }
  } else {
    const heap = new MinHeap()
    const h = (i: number) => (algo === 'astar' ? manhattan(g, i, g.end) : 0)
    let pushes = 0
    heap.push(g.start, h(g.start), 0)
    while (heap.size) {
      const cur = heap.pop() as number
      if (visitAt[cur]) continue // stale entry (lazy decrease-key)
      open--
      order.push(cur)
      visitAt[cur] = order.length
      if (cur === g.end) { found = true; frontier.push(open); break }
      for (const nx of neighbours(g, cur, nb)) {
        if (visitAt[nx]) continue
        const nd = dist[cur] + stepCost(g, nx)
        if (nd >= dist[nx]) continue
        if (seenAt[nx] === -1) { seenAt[nx] = order.length; open++ }
        dist[nx] = nd
        parent[nx] = cur
        // A* ties break towards the lower heuristic (closer to the goal), then FIFO.
        heap.push(nx, nd + h(nx), algo === 'astar' ? h(nx) * 1e6 + ++pushes : ++pushes)
      }
      frontier.push(open)
    }
  }

  const path: number[] = []
  let cost = 0
  if (found) {
    for (let c = g.end; c !== -1; c = parent[c]) path.push(c)
    path.reverse()
    for (let k = 1; k < path.length; k++) cost += stepCost(g, path[k])
  }
  return { algo, order, visitAt, seenAt, frontier, path, cost, found }
}

/* ------------------------------------------------------------------ grids */

export function emptyGrid(cols: number, rows: number): Grid {
  const y = Math.floor(rows / 2)
  return { cols, rows, cells: new Uint8Array(cols * rows), start: idx({ cols }, 1, y), end: idx({ cols }, cols - 2, y) }
}

/**
 * The opening board: a wall with a gap at the bottom, then a mud field with a dry lane along
 * the top. BFS wades straight through the mud; Dijkstra and A* walk round it.
 */
export function presetGrid(cols: number, rows: number): Grid {
  const g = emptyGrid(cols, rows)
  const wx = Math.max(3, Math.floor(cols * 0.28))
  for (let y = 0; y < rows - 4; y++) g.cells[idx(g, wx, y)] = WALL
  const mx0 = Math.floor(cols * 0.5)
  const mx1 = Math.min(cols - 3, mx0 + Math.max(4, Math.round(cols * 0.2)) - 1)
  for (let y = 1; y < rows; y++) for (let x = mx0; x <= mx1; x++) g.cells[idx(g, x, y)] = MUD
  clearEnds(g)
  return g
}

/** Recursive-backtracker maze on odd cells, with a sprinkle of mud in the corridors. */
export function mazeGrid(cols: number, rows: number, seed: number): Grid {
  const rnd = seeded(seed)
  const g = emptyGrid(cols, rows)
  g.cells.fill(WALL)
  const open = (x: number, y: number) => { g.cells[idx(g, x, y)] = EMPTY }
  const sx = 1
  const sy = 1
  const stack: Array<[number, number]> = [[sx, sy]]
  open(sx, sy)
  while (stack.length) {
    const [x, y] = stack[stack.length - 1]
    const dirs: Array<[number, number]> = [[0, -2], [2, 0], [0, 2], [-2, 0]]
    const options = dirs.filter(([dx, dy]) => {
      const nx = x + dx, ny = y + dy
      return nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1 && g.cells[idx(g, nx, ny)] === WALL
    })
    if (!options.length) { stack.pop(); continue }
    const [dx, dy] = options[Math.floor(rnd() * options.length)]
    open(x + dx / 2, y + dy / 2)
    open(x + dx, y + dy)
    stack.push([x + dx, y + dy])
  }
  // Knock out a few extra walls so there is more than one route (and weights matter).
  for (let k = 0; k < Math.floor(cols * rows * 0.04); k++) {
    const x = 1 + Math.floor(rnd() * (cols - 2))
    const y = 1 + Math.floor(rnd() * (rows - 2))
    if ((x + y) % 2 === 1) open(x, y)
  }
  for (let i = 0; i < g.cells.length; i++) if (g.cells[i] === EMPTY && rnd() < 0.1) g.cells[i] = MUD
  g.start = idx(g, 1, 1)
  g.end = idx(g, cols - 2 - ((cols - 1) % 2), rows - 2 - ((rows - 1) % 2))
  clearEnds(g)
  return g
}

/** Random scatter of walls and mud. */
export function scatterGrid(cols: number, rows: number, seed: number): Grid {
  const rnd = seeded(seed)
  const g = emptyGrid(cols, rows)
  for (let i = 0; i < g.cells.length; i++) {
    const r = rnd()
    g.cells[i] = r < 0.26 ? WALL : r < 0.4 ? MUD : EMPTY
  }
  clearEnds(g)
  return g
}

function clearEnds(g: Grid) {
  g.cells[g.start] = EMPTY
  g.cells[g.end] = EMPTY
}

/** Grid size that keeps cells finger-sized on phones and detailed on desktop. */
export function gridSizeFor(width: number): { cols: number; rows: number } {
  if (width < 420) return { cols: 15, rows: 15 }
  if (width < 640) return { cols: 21, rows: 15 }
  if (width < 900) return { cols: 29, rows: 17 }
  return { cols: 37, rows: 19 }
}
