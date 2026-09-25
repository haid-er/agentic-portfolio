/**
 * The two-ink swatch (DESIGN.md 3): the current world's accent overlapped by the
 * NEXT world's accent. The second circle sits in a <g data-theme={next}>, so its
 * var(--accent) resolves to the other world's token (admin overrides included).
 * Which circle shows is decided by CSS, so the first paint is already right.
 */
export function InkSwatch({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 34 22" width={size} height={(size * 22) / 34} aria-hidden="true" focusable="false" className="flex-none">
      <circle cx="11.5" cy="11" r="9" fill="var(--accent)" stroke="var(--rule)" strokeWidth="1" />
      <g className="strata:hidden" style={{ mixBlendMode: 'multiply' }}>
        <g data-theme="strata">
          <circle cx="22.5" cy="11" r="9" fill="var(--accent)" stroke="var(--rule)" strokeWidth="1" />
        </g>
      </g>
      <g className="almanac:hidden" style={{ mixBlendMode: 'screen' }}>
        <g data-theme="almanac">
          <circle cx="22.5" cy="11" r="9" fill="var(--accent)" stroke="var(--rule)" strokeWidth="1" />
        </g>
      </g>
    </svg>
  )
}
