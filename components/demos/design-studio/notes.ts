import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Each poster is built from a seed by a small deterministic generator (a mulberry32 PRNG): it lays out a column grid with matching rows, picks a composition (Swiss blocks, a Bauhaus lattice, sediment bands, sensor traces or a halftone screen) and snaps every shape to the grid. The headline is set by measuring the real typeface on a canvas and shrinking it until the longest word fits the type columns. Everything becomes a list of vector paths and text, which renders as inline SVG on screen and as Path2D on a canvas for the PNG. Spot-colour shapes sit on a second "drum" that can drift a few pixels out of register and overprint with the world\'s blend mode, like a risograph. Inks and typefaces are read live from the site\'s design tokens, so a poster reprints when you switch worlds.',
  limits: [
    'The SVG file names the site\'s web fonts; on a computer without them it falls back to Georgia or a system sans. The PNG has the real type baked in.',
    'Posters use the site\'s own inks (either world, or one spot colour). There is no free colour picker.',
    'Kept prints and your last settings are stored in this browser only.',
  ],
  stack: ['TypeScript', 'SVG', 'Canvas 2D (Path2D)', 'CSS design tokens', 'React 19'],
}
