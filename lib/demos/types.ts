import type { DemoSlug } from './slugs'

/** Props every demo's default export receives (from /playground/[slug]). */
export interface DemoProps {
  slug: DemoSlug
  /**
   * Server-resolved data for a demo that needs content (JSON-serialisable), so the
   * client chunk never imports lib/content. Each demo documents its own shape.
   */
  data?: unknown
}

/**
 * `notes.ts` in every demo folder exports `notes: DemoNotes` (server safe, no JSX,
 * no browser APIs). index.tsx re-exports it: `export { notes } from './notes'`.
 */
export interface DemoNotes {
  /** 2-5 sentence "how it works" shown on the demo page. */
  howItWorks: string
  /** Honest limits ("simulated, no real keys", "synthetic replay on desktop"). */
  limits: string[]
  /** Tech actually used inside the demo. */
  stack: string[]
}
