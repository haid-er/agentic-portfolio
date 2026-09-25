/**
 * Hand-placed node boxes for the broker diagram in two orientations:
 * `wide` (left to right, >= 620px of stage) and `tall` (top to bottom, phones).
 */
export type Orientation = 'wide' | 'tall'
export interface Box { x: number; y: number; w: number; h: number }
export interface Layout { orientation: Orientation; width: number; height: number; font: number; small: number; dot: number; nodes: Record<string, Box> }

const PRODUCERS = ['p-phone-accel', 'p-phone-gyro', 'p-watch-accel', 'p-watch-hr']
const CONSUMERS = ['c-a', 'c-b', 'c-alerts', 'c-archive']

function wide(): Layout {
  const nodes: Record<string, Box> = {}
  PRODUCERS.forEach((id, i) => { nodes[id] = { x: 78, y: 62 + i * 92, w: 136, h: 54 } })
  nodes.x = { x: 290, y: 200, w: 144, h: 60 }
  nodes['q-windows'] = { x: 520, y: 90, w: 148, h: 66 }
  nodes['q-alerts'] = { x: 520, y: 208, w: 148, h: 66 }
  nodes['q-archive'] = { x: 520, y: 326, w: 148, h: 66 }
  const cy = [52, 128, 208, 326]
  CONSUMERS.forEach((id, i) => { nodes[id] = { x: 738, y: cy[i] ?? 0, w: 148, h: 62 } })
  nodes.dlq = { x: 290, y: 388, w: 160, h: 54 }
  return { orientation: 'wide', width: 820, height: 430, font: 12.5, small: 11, dot: 5.5, nodes }
}

function tall(): Layout {
  const nodes: Record<string, Box> = {}
  const cols = [37, 119, 201, 283]
  PRODUCERS.forEach((id, i) => { nodes[id] = { x: cols[i] ?? 0, y: 36, w: 74, h: 50 } })
  nodes.x = { x: 160, y: 146, w: 132, h: 48 }
  nodes['q-windows'] = { x: 78, y: 268, w: 150, h: 60 }
  nodes['q-alerts'] = { x: 201, y: 268, w: 74, h: 60 }
  nodes['q-archive'] = { x: 283, y: 268, w: 74, h: 60 }
  CONSUMERS.forEach((id, i) => { nodes[id] = { x: cols[i] ?? 0, y: 398, w: 74, h: 66 } })
  nodes.dlq = { x: 160, y: 520, w: 164, h: 48 }
  return { orientation: 'tall', width: 320, height: 552, font: 11, small: 10, dot: 4.5, nodes }
}

const CACHE: Record<Orientation, Layout> = { wide: wide(), tall: tall() }
export const layoutFor = (o: Orientation) => CACHE[o]
