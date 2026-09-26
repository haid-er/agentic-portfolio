'use client'
/** Match setup: teams, overs, wickets, difficulty and the seed passed to srand(). */
import { useState } from 'react'
import { Button, DemoPanel, Input, Segmented } from '@/components/ui'
import type { Config, Level } from './engine'

const clampName = (s: string, fallback: string) => s.trim().slice(0, 16) || fallback

export function Setup({ initial, onStart, hasSaved, onResume }: {
  initial: Config
  onStart: (c: Config) => void
  hasSaved: boolean
  onResume: () => void
}) {
  const [c, setC] = useState<Config>(initial)
  const set = (patch: Partial<Config>) => setC((x) => ({ ...x, ...patch }))
  return (
    <DemoPanel title="New match" meta="Limited overs" bodyClassName="grid gap-5">
      <div className="grid gap-4 xs:grid-cols-2">
        <Input label="Your team" value={c.teams[0]} maxLength={16} onChange={(e) => set({ teams: [e.target.value, c.teams[1]] })} />
        <Input label="Opponents (CPU)" value={c.teams[1]} maxLength={16} onChange={(e) => set({ teams: [c.teams[0], e.target.value] })} />
      </div>
      <div className="flex flex-wrap gap-4">
        <Segmented label="Overs a side" value={String(c.overs)} onChange={(v) => set({ overs: Number(v) })} options={['1', '2', '5', '10'].map((v) => ({ value: v, label: v }))} />
        <Segmented label="Wickets" value={String(c.wickets)} onChange={(v) => set({ wickets: Number(v) })} options={['2', '5', '10'].map((v) => ({ value: v, label: v }))} />
        <Segmented<Level>
          label="Opposition"
          value={c.level}
          onChange={(level) => set({ level })}
          options={[{ value: 'gentle', label: 'Village' }, { value: 'county', label: 'County' }, { value: 'test', label: 'Test' }]}
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Seed for srand()"
          type="number"
          inputMode="numeric"
          min={1}
          max={99999}
          value={c.seed}
          wrapperClassName="w-40"
          onChange={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 99999) set({ seed: n }) }}
          hint="Same seed + same choices = same match."
        />
        <Button variant="secondary" size="sm" icon="refresh" onClick={() => set({ seed: 1 + Math.floor(Math.random() * 99999) })}>New seed</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          arrow
          onClick={() => onStart({ ...c, teams: [clampName(c.teams[0], 'Home XI'), clampName(c.teams[1], 'Away XI')] })}
        >
          Walk out for the toss
        </Button>
        {hasSaved ? <Button variant="secondary" onClick={onResume}>Resume saved match</Button> : null}
      </div>
    </DemoPanel>
  )
}
