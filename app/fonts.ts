/**
 * The six families of the two worlds (DESIGN.md 4), exposed as --ff-* variables.
 * globals.css maps them to --font-display / --font-body / --font-mono per world.
 */
import {
  Bricolage_Grotesque,
  DM_Mono,
  Fraunces,
  Hanken_Grotesk,
  Martian_Mono,
  Newsreader,
} from 'next/font/google'

// Almanac
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT', 'WONK'],
  variable: '--ff-fraunces',
  preload: false, // preloaded per world by app/fontPreload.ts
})
const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--ff-newsreader',
  preload: false, // preloaded per world by app/fontPreload.ts
})
const dmMono = DM_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
  variable: '--ff-dm-mono',
  preload: false,
})

// Strata
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  axes: ['opsz', 'wdth'],
  variable: '--ff-bricolage',
  preload: false,
})
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--ff-hanken',
  preload: false,
})
const martian = Martian_Mono({
  subsets: ['latin'],
  display: 'swap',
  axes: ['wdth'],
  variable: '--ff-martian',
  preload: false,
})

export const fontVariables = [fraunces, newsreader, dmMono, bricolage, hanken, martian]
  .map((f) => f.variable)
  .join(' ')

/** Human names per world, for the colophon ("Set in ..."). */
export const WORLD_FONTS = {
  almanac: ['Fraunces', 'Newsreader', 'DM Mono'],
  strata: ['Bricolage Grotesque', 'Hanken Grotesk', 'Martian Mono'],
} as const
