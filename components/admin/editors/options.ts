/** Choice lists shared by the editors (values mirror lib/content/schema enums). */
import { PILLARS } from '@/lib/content/schema'
import type { Option } from '../fields/Choice'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const PILLAR_OPTIONS: Option[] = PILLARS.map((p) => ({ value: p, label: cap(p) }))

export const LEVEL_OPTIONS = [
  { value: 'core', label: 'Core' },
  { value: 'working', label: 'Working' },
  { value: 'exploring', label: 'Exploring' },
] as const

export const MODE_OPTIONS: Option[] = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'on-site', label: 'On-site' },
]

export const ACHIEVEMENT_KINDS: Option[] = ['award', 'competition', 'talk', 'leadership', 'badge', 'other'].map((k) => ({ value: k, label: cap(k) }))

export const CTA_VARIANTS = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
] as const

export const HREF_HINT = 'https://…, mailto:, tel:, /path or #section. Empty hides it.'

/** Join non-empty parts with " · " for item subtitles. */
export const meta = (...parts: Array<string | undefined | false>) => parts.filter(Boolean).join(' · ')
