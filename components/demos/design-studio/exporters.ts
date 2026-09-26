'use client'
/** File exports for the poster press: PNG via canvas, SVG as a standalone file. */
import type { Poster } from './engine'
import { drawPoster, posterSvg, type Fonts, type Inks } from './render'

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Make sure the faces used on the poster are loaded before a canvas draws them. */
export async function loadFaces(fonts: Fonts) {
  if (typeof document === 'undefined' || !('fonts' in document)) return
  await Promise.all([
    document.fonts.load(`800 48px ${fonts.display}`),
    document.fonts.load(`italic 500 16px ${fonts.body}`),
    document.fonts.load(`500 10px ${fonts.mono}`),
  ]).catch(() => undefined)
}

export async function exportPng(p: Poster, inks: Inks, fonts: Fonts, name: string, scale = 3) {
  await loadFaces(fonts)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(p.w * scale)
  canvas.height = Math.round(p.h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not available in this browser.')
  drawPoster(ctx, p, inks, fonts, scale)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('The browser could not encode the PNG.')
  download(blob, `${name}.png`)
}

export function exportSvg(p: Poster, inks: Inks, fonts: Fonts, name: string, title: string) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n${posterSvg(p, inks, fonts, { title })}`
  download(new Blob([svg], { type: 'image/svg+xml' }), `${name}.svg`)
}
