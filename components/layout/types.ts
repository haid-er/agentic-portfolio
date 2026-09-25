/**
 * Plain data the server hands to the shell's client islands (nav, folio bar,
 * contents sheet, command palette). Client + server safe: no imports of content.
 */
import type { IconName } from '@/components/ui/Icon'
import type { ThemeKey } from '@/lib/content/schema'

export interface WorldLabel {
  label: string
  swapLabel: string
}

/** Labels of both worlds, keyed by the stable theme key. */
export type ThemeLabels = Record<ThemeKey, WorldLabel>

/** One enabled homepage section, as the nav sees it. */
export interface NavSection {
  id: string
  label: string
  /** Two-digit folio, identical to the numbering on the homepage. */
  folio: string
  href: string
  icon: IconName
  /** Layer ink 1-6 (Strata borehole bars). */
  layer: 1 | 2 | 3 | 4 | 5 | 6
}

export type IndexGroup = 'section' | 'demo' | 'project' | 'page' | 'action'

export type IndexAction = 'theme' | 'copy'

/** A row in the command palette ("the index"). */
export interface IndexEntry {
  key: string
  group: IndexGroup
  label: string
  /** Right-hand mono hint: folio, slug, handle. */
  hint: string
  icon: IconName
  href?: string
  external?: boolean
  action?: IndexAction
  /** Payload for the action (the text to copy). */
  value?: string
  /** Extra words that match a search but are not shown. */
  keywords: string
}

export interface NavModel {
  /** Every enabled section that renders something, in page order (hero excluded). */
  sections: NavSection[]
  /** Short list for the desktop header and the mobile folio bar. */
  primary: NavSection[]
  /** Ids watched by the scroll-spy, hero included. */
  spyIds: string[]
  index: IndexEntry[]
  groupLabels: Record<IndexGroup, string>
}
