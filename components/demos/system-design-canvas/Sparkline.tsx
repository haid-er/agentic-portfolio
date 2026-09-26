/** A tiny line of recent values (latency or errors). Drawn with SVG; the latest value is printed beside it. */
export function Sparkline({ values, max, label, stroke }: { values: number[]; max: number; label: string; stroke: string }) {
  const W = 120
  const H = 28
  const top = Math.max(max, ...values, 1e-9)
  const pts = values.map((v, i) => `${values.length < 2 ? W : (i / (values.length - 1)) * W},${H - 2 - (Math.min(v, top) / top) * (H - 4)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} className="block max-w-full">
      <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="var(--rule-soft)" />
      {values.length > 1 ? <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" /> : null}
    </svg>
  )
}
