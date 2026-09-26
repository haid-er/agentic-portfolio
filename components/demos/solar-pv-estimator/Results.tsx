/** Yield headline, CO₂ avoided and a 12-month bar chart drawn in the world's data inks. */
import { MONTHS, fmtInt, type PvBase } from './pv'

export function MonthlyBars({ monthly }: { monthly: number[] }) {
  const max = Math.max(...monthly, 1)
  const peak = monthly.indexOf(Math.max(...monthly))
  return (
    <figure className="m-0 grid gap-2">
      <div aria-hidden="true" className="grid grid-cols-12 items-end gap-1 h-36 border-b border-rule">
        {monthly.map((v, i) => (
          <div key={MONTHS[i]} className="relative h-full flex items-end">
            <span
              className="w-full origin-bottom transition-transform duration-[var(--dur-med)] ease-[var(--ease-out)] motion-reduce:transition-none"
              style={{
                height: '100%',
                transform: `scaleY(${v / max})`,
                background: i === peak ? 'var(--data-2)' : 'var(--data-1)',
              }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="grid grid-cols-12 gap-1 text-center mono text-ink-3 tracking-normal">
        {MONTHS.map((m) => <span key={m}>{m.slice(0, 1)}<span className="hidden xs:inline">{m.slice(1)}</span></span>)}
      </div>
      <figcaption className="text-00 text-ink-3">
        Average monthly output, kWh. Peak month ({MONTHS[peak]}) in the second ink.
      </figcaption>
      <table className="sr-only">
        <caption>Average monthly output</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">kWh</th></tr></thead>
        <tbody>{monthly.map((v, i) => <tr key={MONTHS[i]}><td>{MONTHS[i]}</td><td>{fmtInt(v)}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}

export function Provenance({ base }: { base: PvBase }) {
  const rows: [string, string][] = [
    ['Tilt', `${base.slope}°${base.optimal ? ' (optimised)' : ''}`],
    ['Azimuth', `${base.azimuth}° from south${base.optimal ? ' (optimised)' : ''}`],
    ['Radiation data', base.radiationDb],
    ['Years averaged', base.years],
    ['Elevation', base.elevation === null ? '' : `${Math.round(base.elevation)} m`],
    ['Plane irradiation', base.yearlyIrradiation === null ? '' : `${fmtInt(base.yearlyIrradiation)} kWh/m²/yr`],
  ]
  return (
    <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 text-0">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="mono text-ink-3">{k}</dt>
          <dd className="m-0 nums text-ink [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
