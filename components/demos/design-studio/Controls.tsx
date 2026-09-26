'use client'
/** Press settings: style, format, inks, grid, type and seed. */
import { Button, DemoPanel, Input, Segmented, Toggle } from '@/components/ui'
import { STYLES, type PosterParams } from './engine'
import { MAX_HEADLINE, MAX_SUBLINE } from './params'
import { Range } from './Range'

export function Controls({ params, update, onPull, labels }: {
  params: PosterParams
  update: (patch: Partial<PosterParams>) => void
  onPull: () => void
  labels: { world: string; other: string }
}) {
  const style = STYLES.find((s) => s.value === params.style)
  const step = (d: number) => update({ seed: ((params.seed - 1 + d + 9999) % 9999) + 1 })
  return (
    <DemoPanel title="Press settings" bodyClassName="grid gap-5">
      <div className="grid gap-2">
        <Segmented label="Composition" value={params.style} onChange={(style) => update({ style })} options={STYLES} />
        {style ? <p className="m-0 text-0 text-ink-2">{style.blurb}</p> : null}
      </div>

      <div className="grid gap-4 xs:grid-cols-2 mid:grid-cols-1 lg:grid-cols-2">
        <Segmented
          label="Sheet"
          value={params.format}
          onChange={(format) => update({ format })}
          options={[{ value: 'a-series', label: 'A-series' }, { value: 'square', label: 'Square' }]}
        />
        <Segmented
          label="Inks"
          value={params.inks}
          onChange={(inks) => update({ inks })}
          options={[
            { value: 'world', label: labels.world },
            { value: 'other', label: labels.other },
            { value: 'single', label: 'One spot' },
          ]}
        />
      </div>

      <Range
        label="Grid columns"
        value={params.cols}
        min={3}
        max={12}
        step={1}
        unit=""
        onChange={(cols) => update({ cols })}
        hint="Shapes and type snap to these columns and the matching rows."
      />

      <div className="grid gap-3">
        <Input
          label="Headline"
          value={params.headline}
          maxLength={MAX_HEADLINE}
          onChange={(e) => update({ headline: e.target.value })}
          hint={`Sized to fit the type columns. ${params.headline.length}/${MAX_HEADLINE}`}
        />
        <Input
          label="Subline"
          value={params.subline}
          maxLength={MAX_SUBLINE}
          onChange={(e) => update({ subline: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap gap-x-5">
        <Toggle label="Show the grid" checked={params.grid} onChange={(grid) => update({ grid })} />
        <Toggle label="Misregister the spot drum" checked={params.misregister} onChange={(misregister) => update({ misregister })} />
      </div>

      <div className="grid gap-2">
        <span className="mono text-ink-2" id="seed-label">Seed</span>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="seed-label">
          <Button size="sm" variant="secondary" icon="minus" onClick={() => step(-1)} aria-label="Previous seed" />
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={9999}
            value={params.seed}
            aria-label="Seed number"
            onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 1 && n <= 9999) update({ seed: Math.round(n) }) }}
            className="w-24 min-h-tap px-3 bg-surface text-ink border border-rule rounded-0 font-mono nums"
          />
          <Button size="sm" variant="secondary" icon="plus" onClick={() => step(1)} aria-label="Next seed" />
          <Button size="sm" icon="refresh" onClick={onPull}>Random</Button>
        </div>
        <p className="m-0 text-00 text-ink-3">Same seed and settings always pull the same print.</p>
      </div>
    </DemoPanel>
  )
}
