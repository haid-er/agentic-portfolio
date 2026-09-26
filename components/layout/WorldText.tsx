/**
 * Text that differs per world, switched by CSS (almanac:/strata: variants) so
 * the right one shows on first paint with no hydration flash. Server safe.
 */
import type { ReactNode } from 'react'

export function WorldText({ almanac, strata }: { almanac: ReactNode; strata: ReactNode }) {
  return (
    <>
      <span className="strata:hidden">{almanac}</span>
      <span className="almanac:hidden">{strata}</span>
    </>
  )
}
