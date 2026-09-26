/** Each technician gets an ink AND a marker shape, so colour is never the only signal. */
export const INK = [
  { stroke: 'stroke-data-1', fill: 'fill-data-1', bg: 'bg-data-1', text: 'text-data-1', shape: 'circle' },
  { stroke: 'stroke-data-2', fill: 'fill-data-2', bg: 'bg-data-2', text: 'text-data-2', shape: 'square' },
  { stroke: 'stroke-data-3', fill: 'fill-data-3', bg: 'bg-data-3', text: 'text-data-3', shape: 'diamond' },
  { stroke: 'stroke-data-4', fill: 'fill-data-4', bg: 'bg-data-4', text: 'text-data-4', shape: 'triangle' },
] as const

export type Shape = (typeof INK)[number]['shape']

export const inkFor = (i: number) => INK[i % INK.length] ?? INK[0]

/** SVG path for a marker of radius r centred on (x, y). */
export function markerPath(shape: Shape, x: number, y: number, r: number): string {
  switch (shape) {
    case 'square': return `M${x - r} ${y - r}h${2 * r}v${2 * r}h${-2 * r}Z`
    case 'diamond': return `M${x} ${y - r * 1.25}L${x + r * 1.25} ${y}L${x} ${y + r * 1.25}L${x - r * 1.25} ${y}Z`
    case 'triangle': return `M${x} ${y - r * 1.2}L${x + r * 1.15} ${y + r * 0.9}L${x - r * 1.15} ${y + r * 0.9}Z`
    default: return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`
  }
}
