import type { Section } from '@/lib/content/schema'

/** Props every homepage section receives from app/page.tsx. */
export interface SectionProps {
  section: Section
  /** Two-digit folio number by render order ("01" = first enabled section). */
  folio: string
}
