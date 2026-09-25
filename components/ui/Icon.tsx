/**
 * In-house icon family (DESIGN.md 7): 24x24 grid, 1.5px stroke, currentColor,
 * line caps follow the world (--icon-cap: square in Almanac, round in Strata).
 * Decorative by default (aria-hidden). Pass `title` to make it meaningful.
 */
import type { CSSProperties, ReactNode, SVGProps } from 'react'

export type IconName =
  // brand family
  | 'register' | 'arrow' | 'arrow-up-right' | 'leaders' | 'strata' | 'core'
  // waveforms (signal / sensor / queue demos)
  | 'pulse' | 'sine' | 'square' | 'saw' | 'flat'
  // category glyphs
  | 'leaf' | 'broadsheet' | 'nodes'
  // utility
  | 'menu' | 'close' | 'search' | 'check' | 'alert' | 'info' | 'play' | 'pause' | 'step'
  | 'plus' | 'minus' | 'copy' | 'upload' | 'download' | 'external' | 'refresh' | 'lock'
  | 'mail' | 'github' | 'linkedin' | 'x' | 'facebook' | 'instagram' | 'globe' | 'phone' | 'doc'

const PATHS: Record<IconName, ReactNode> = {
  register: (<><circle cx="12" cy="12" r="6.5" /><path d="M12 1.5v21M1.5 12h21" /></>),
  arrow: <path d="M4 12h15M14 7l5 5-5 5" />,
  'arrow-up-right': <path d="M7 17 17 7M9 7h8v8" />,
  leaders: <path d="M3 12h.5M7.5 12h.5M12 12h.5M16.5 12h.5M21 12h.5" strokeWidth={2.2} />,
  strata: <path d="M3 7c3-2 6 2 9 0s6 2 9 0M3 12c3-2 6 2 9 0s6 2 9 0M3 17c3-2 6 2 9 0s6 2 9 0" />,
  core: (<><rect x="7" y="2.5" width="10" height="19" rx="5" /><path d="M7 9h10M7 14h10" /></>),

  pulse: <path d="M2 12h5l2-6 3 12 2.5-9 1.5 3h6" />,
  sine: <path d="M2 12c2-6 4.5-6 6.5 0s4.5 6 6.5 0 4.5-6 7 0" />,
  square: <path d="M2 15h4V9h5v6h5V9h4v6h2" />,
  saw: <path d="M2 17 8 8v9l6-9v9l6-9v9" />,
  flat: <path d="M2 12h20" />,

  leaf: (<><path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15Z" /><path d="M5 19 14 10M9 15h4M11 12.5V9" /></>),
  broadsheet: (<><path d="M4 3.5h13l3 3v14H4z" /><path d="M7 8h10M7 11.5h4.5M7 15h4.5M13.5 11.5H17v5.5h-3.5z" /></>),
  nodes: (<><circle cx="5.5" cy="6" r="2.5" /><circle cx="18.5" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8 6h8M7 8.2l3.8 7.5M17 8.2l-3.8 7.5" /></>),

  menu: <path d="M3 7h18M3 12h18M3 17h18" />,
  close: <path d="M5 5l14 14M19 5 5 19" />,
  search: (<><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></>),
  check: <path d="m4 12.5 5 5 11-11" />,
  alert: (<><path d="M12 3 2.5 20h19z" /><path d="M12 10v4.5M12 17v.5" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>),
  play: <path d="M7 4.5v15l12-7.5z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  step: <path d="M5 5v14l9-7zM18 5v14" />,
  plus: <path d="M12 4v16M4 12h16" />,
  minus: <path d="M4 12h16" />,
  copy: (<><rect x="8" y="8" width="12" height="12" /><path d="M16 8V4H4v12h4" /></>),
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" />,
  download: <path d="M12 4v12M7 11l5 5 5-5M4 16v4h16v-4" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />,
  refresh: <path d="M20 5v5h-5M4 19v-5h5M19 10a7.5 7.5 0 0 0-13.5-2.5M5 14a7.5 7.5 0 0 0 13.5 2.5" />,
  lock: (<><rect x="5" y="10.5" width="14" height="10" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>),
  mail: (<><rect x="3" y="5" width="18" height="14" /><path d="m3 6 9 7 9-7" /></>),
  github: <path d="M9 19c-4.5 1.5-4.5-2.5-6.5-3M15 21.5v-3.8a3.3 3.3 0 0 0-.9-2.6c3-.3 6.2-1.5 6.2-6.7a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6s-1.1-.3-3.7 1.4a12.7 12.7 0 0 0-6.6 0C5.9 1 4.8 1.3 4.8 1.3a4.8 4.8 0 0 0-.1 3.6 5.2 5.2 0 0 0-1.4 3.6c0 5.2 3.2 6.4 6.2 6.7a3.3 3.3 0 0 0-.9 2.6v3.8" />,
  linkedin: (<><rect x="3" y="3" width="18" height="18" /><path d="M7.5 10v7M7.5 7v.5M11.5 17v-7M11.5 13a3 3 0 0 1 6 0v4" /></>),
  x: <path d="M4 4l16 16M20 4 4 20" />,
  facebook: <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V10H6.5v3.5H9V21h3.5v-7.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />,
  instagram: (<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5v.5" /></>),
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>),
  phone: <path d="M5 3.5h4l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5l1.5-2.5 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5.5a2 2 0 0 1 2-2" />,
  doc: (<><path d="M6 2.5h8l4 4v15H6z" /><path d="M14 2.5v4h4M9 12h6M9 15.5h6" /></>),
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number | string
  /** Accessible name. Omit for decorative icons (default). */
  title?: string
}

export function Icon({ name, size = 20, title, style, ...rest }: IconProps) {
  const decorative = !title
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="miter"
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : 'img'}
      focusable="false"
      style={{ strokeLinecap: 'var(--icon-cap)' as CSSProperties['strokeLinecap'], flex: 'none', ...style }}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  )
}

/** Map a social id / content icon string to an in-house glyph. */
export function socialIcon(id: string | undefined): IconName {
  const k = (id ?? '').toLowerCase()
  if (k.includes('github')) return 'github'
  if (k.includes('linkedin')) return 'linkedin'
  if (k === 'x' || k.includes('twitter')) return 'x'
  if (k.includes('facebook')) return 'facebook'
  if (k.includes('instagram')) return 'instagram'
  if (k.includes('mail')) return 'mail'
  if (k.includes('phone')) return 'phone'
  return 'globe'
}

/**
 * The two-ink swatch (theme control glyph, DESIGN.md 3): two overlapping
 * circles in the current and next world's accents. Colours come from props so
 * the shell can pass the literal next-world tokens.
 */
export function SwatchGlyph({ from, to, size = 34 }: { from: string; to: string; size?: number }) {
  return (
    <svg viewBox="0 0 34 22" width={size} height={(size * 22) / 34} aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="9.5" fill={from} stroke="var(--rule)" strokeWidth="1" />
      <circle cx="23" cy="11" r="9.5" fill={to} stroke="var(--rule)" strokeWidth="1" style={{ mixBlendMode: 'multiply' }} />
    </svg>
  )
}
