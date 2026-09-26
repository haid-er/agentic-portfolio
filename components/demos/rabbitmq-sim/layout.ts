/**
 * Hand-placed node boxes for the broker diagram in two orientations:
 * `wide` (left to right) and `tall` (top to bottom, phones and narrow columns).
 * Font sizes are in viewBox units, so `layoutFor` raises them when the SVG is drawn smaller
 * than 1:1, keeping text at a readable size on screen.
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

/** Smallest on-screen text sizes (CSS px) for labels and secondary read-outs. */
const MIN_FONT_PX = 12
const MIN_SMALL_PX = 11
/** The tall diagram is capped at this CSS width (keep in sync with max-w-[440px] in Diagram). */
const TALL_MAX_PX = 440
/** Wide needs roughly 1:1 scale; below this its long labels would have to shrink too far. */
const WIDE_MIN_SCALE = 0.93

/** Picks the orientation for a stage width: wide only when it renders near full size. */
export function orientationFor(stageWidth: number): Orientation {
  return stageWidth / CACHE.wide.width >= WIDE_MIN_SCALE ? 'wide' : 'tall'
}

/** Layout for the stage width, with fonts raised so text never renders below the minimums. */
export function layoutFor(o: Orientation, stageWidth: number): Layout {
  const base = CACHE[o]
  const drawn = o === 'tall' ? Math.min(stageWidth, TALL_MAX_PX) : stageWidth
  // Clamp so an unmeasured (0) or tiny stage cannot blow the text up past the boxes.
  const scale = Math.min(2, Math.max(0.8, drawn / base.width || 1))
  return {
    ...base,
    font: Math.max(base.font, MIN_FONT_PX / scale),
    small: Math.max(base.small, MIN_SMALL_PX / scale),
  }
}

/** Shortens a label to fit `width` viewBox units of monospace text at `fontSize`. */
export function fitLabel(text: string, width: number, fontSize: number): string {
  const max = Math.max(4, Math.floor(width / (fontSize * 0.6)))
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}
