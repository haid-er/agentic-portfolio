'use client'
/**
 * Resolve poster inks and type faces from the live CSS tokens.
 * A hidden probe with `data-theme` set to the other world lets a poster borrow
 * that world's inks (admin overrides included) without switching the page.
 */
import { useEffect, useRef, useState } from 'react'
import { readTokens, useThemeKey } from '@/lib/theme/client'
import { otherTheme } from '@/lib/theme'
import type { InkSet } from './engine'
import type { Fonts, Inks } from './render'

const TOKENS = ['--bg', '--ink', '--accent', '--accent-2', '--data-3', '--blend', '--font-display', '--font-body', '--font-mono'] as const

export function useInks(set: InkSet) {
  const theme = useThemeKey()
  const probeRef = useRef<HTMLDivElement | null>(null)
  const [state, setState] = useState<{ inks: Inks; fonts: Fonts } | null>(null)

  useEffect(() => {
    const el = set === 'other' ? probeRef.current : document.documentElement
    if (!el) return
    const t = readTokens(TOKENS, el)
    const spot = t['--accent-2'] || 'gray'
    const inks: Inks = {
      paper: t['--bg'] || 'white',
      ink: t['--ink'] || 'black',
      spot1: spot,
      spot2: set === 'single' ? spot : t['--accent'] || spot,
      spot3: set === 'single' ? spot : t['--data-3'] || spot,
      blend: t['--blend'] === 'screen' ? 'screen' : 'multiply',
    }
    const fonts: Fonts = {
      display: t['--font-display'] || 'serif',
      body: t['--font-body'] || 'serif',
      mono: t['--font-mono'] || 'monospace',
    }
    setState({ inks, fonts })
  }, [set, theme])

  return { ...state, probeRef, probeTheme: otherTheme(theme) }
}
