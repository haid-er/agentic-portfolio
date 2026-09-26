/**
 * Two renderers for one poster model:
 *  - posterSvg(): an SVG string (inline preview, thumbnails and the .svg file)
 *  - drawPoster(): Canvas 2D via Path2D (the .png file)
 * Inks and font stacks are resolved from the live CSS tokens by the caller.
 */
import type { Face, Ink, Item, Poster } from './engine'

export type Inks = Record<Ink, string> & { blend: 'multiply' | 'screen' }
export type Fonts = Record<Face, string>

/** XML-escape text and attribute values (inks come from admin-editable CSS tokens, so they are escaped too). */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Font stacks from CSS may contain double quotes; single-quote them for XML attributes. */
const fontAttr = (stack: string) => esc(stack.replace(/"/g, "'"))

function gridSvg(p: Poster, color: string) {
  let d = ''
  for (const x of p.colX) d += `M${x.toFixed(1)} ${p.margin}V${p.h - p.margin}M${(x + p.colW).toFixed(1)} ${p.margin}V${p.h - p.margin}`
  for (const y of p.rowY) d += `M${p.margin} ${y.toFixed(1)}H${p.w - p.margin}M${p.margin} ${(y + p.rowH).toFixed(1)}H${p.w - p.margin}`
  return `<path d="${d}" fill="none" stroke="${esc(color)}" stroke-width="0.5" stroke-dasharray="2 2" opacity="0.7"/>`
}

function itemSvg(it: Item, inks: Inks, fonts: Fonts): string {
  if (it.k === 'path') {
    const fill = it.fill ? esc(inks[it.fill]) : 'none'
    const stroke = it.stroke ? ` stroke="${esc(inks[it.stroke])}" stroke-width="${it.sw ?? 1}" stroke-linejoin="round"` : ''
    const op = it.opacity !== undefined ? ` opacity="${it.opacity}"` : ''
    return `<path d="${it.d}" fill="${fill}"${stroke}${op}/>`
  }
  const tr = it.rot ? ` transform="rotate(${it.rot} ${it.x} ${it.y})"` : ''
  const track = it.tracking ? ` letter-spacing="${(it.tracking * it.size).toFixed(2)}"` : ''
  return `<text x="${it.x.toFixed(1)}" y="${it.y.toFixed(1)}" font-family="${fontAttr(fonts[it.face])}" font-size="${it.size.toFixed(2)}" font-weight="${it.weight}"${it.italic ? ' font-style="italic"' : ''}${track} text-anchor="${it.anchor}" fill="${esc(inks[it.fill])}"${tr}>${esc(it.text)}</text>`
}

export function posterSvg(p: Poster, inks: Inks, fonts: Fonts, opts: { grid?: boolean; title?: string } = {}): string {
  const shift = p.offset.x || p.offset.y ? ` transform="translate(${p.offset.x} ${p.offset.y})"` : ''
  const body = p.items
    .map((it) => (it.layer === 'spot' ? `<g style="mix-blend-mode:${inks.blend}"${shift}>${itemSvg(it, inks, fonts)}</g>` : itemSvg(it, inks, fonts)))
    .join('')
  const title = opts.title ? `<title>${esc(opts.title)}</title>` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.w} ${p.h}" width="${p.w}" height="${p.h}">${title}` +
    `<rect width="${p.w}" height="${p.h}" fill="${esc(inks.paper)}"/>${body}${opts.grid ? gridSvg(p, inks.spot1) : ''}</svg>`
  )
}

/** Draw at `scale` (e.g. 3 for a 1260px-wide PNG). Fonts must be loaded first. */
export function drawPoster(ctx: CanvasRenderingContext2D, p: Poster, inks: Inks, fonts: Fonts, scale: number) {
  ctx.save()
  ctx.scale(scale, scale)
  ctx.fillStyle = inks.paper
  ctx.fillRect(0, 0, p.w, p.h)
  for (const it of p.items) {
    ctx.save()
    if (it.layer === 'spot') {
      ctx.globalCompositeOperation = inks.blend
      ctx.translate(p.offset.x, p.offset.y)
    }
    if (it.k === 'path') {
      const path = new Path2D(it.d)
      if (it.opacity !== undefined) ctx.globalAlpha = it.opacity
      if (it.fill) { ctx.fillStyle = inks[it.fill]; ctx.fill(path) }
      if (it.stroke) { ctx.strokeStyle = inks[it.stroke]; ctx.lineWidth = it.sw ?? 1; ctx.lineJoin = 'round'; ctx.stroke(path) }
    } else {
      ctx.font = `${it.italic ? 'italic ' : ''}${it.weight} ${it.size}px ${fonts[it.face]}`
      ctx.fillStyle = inks[it.fill]
      ctx.textAlign = it.anchor === 'end' ? 'right' : 'left'
      ctx.textBaseline = 'alphabetic'
      const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
      if (it.tracking && 'letterSpacing' in c) c.letterSpacing = `${(it.tracking * it.size).toFixed(2)}px`
      ctx.translate(it.x, it.y)
      if (it.rot) ctx.rotate((it.rot * Math.PI) / 180)
      ctx.fillText(it.text, 0, 0)
    }
    ctx.restore()
  }
  ctx.restore()
}

/** Canvas-backed text measure, so headlines fit the real typeface. */
export function canvasMeasure(fonts: Fonts) {
  const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
  return (text: string, face: Face, size: number, weight: number) => {
    if (!ctx) return text.length * size * 0.56
    ctx.font = `${weight} ${size}px ${fonts[face]}`
    return ctx.measureText(text).width
  }
}
