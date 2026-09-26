/**
 * "Never render" terms (CONTRACTS 7, BRIEF 2). Server + client safe (pure).
 *
 * CONTRACT_EXCLUDED is the contract's floor, not a content choice, so admin cannot
 * switch it off; content adds more terms via `site.privacy.excluded`.
 * Matching is case-insensitive at the start of a word ("vlad-app", "fallnet2" and
 * "LOGICCOVE" match; "novladimir" does not). Over-matching is deliberate: a wrongly
 * hidden item is harmless, a leaked one is not.
 */
export const CONTRACT_EXCLUDED = ['logiccove', 'vlad', 'fallnet'] as const

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Contract terms plus the given extra terms, trimmed, blanks dropped. */
export function excludedTerms(extra: readonly unknown[] = []): string[] {
  const more = extra.filter((t): t is string => typeof t === 'string' && t.trim() !== '').map((t) => t.trim())
  return Array.from(new Set([...CONTRACT_EXCLUDED, ...more]))
}

/** Build a predicate for the contract terms plus `extra` (e.g. site.privacy.excluded). */
export function makeExcluded(extra: readonly unknown[] = []): (text: string) => boolean {
  const re = new RegExp(`(^|[^a-z0-9])(${excludedTerms(extra).map(escapeRe).join('|')})`, 'i')
  return (text) => re.test(text)
}

/** Read the extra terms from a site object defensively. */
export function siteExcluded(site: { privacy?: { excluded?: unknown } } | undefined): string[] {
  const list = site?.privacy?.excluded
  return Array.isArray(list) ? excludedTerms(list).slice(CONTRACT_EXCLUDED.length) : []
}
