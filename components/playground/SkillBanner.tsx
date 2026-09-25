'use client'
/**
 * Skill landing banner (/playground?skill=x): names the skill, its band from
 * content/skills.json, its pillar and how many demos prove it. Focusable heading
 * so a chip click moves the viewer (and screen readers) to the result.
 */
import type { Ref } from 'react'
import { Badge, Button } from '@/components/ui'
import type { ResolvedSkill } from './filter'

export function SkillBanner({ ref, resolved, count, pillarLabel, onClear }: {
  ref?: Ref<HTMLHeadingElement>
  resolved: Exclude<ResolvedSkill, { kind: 'none' }>
  count: number
  pillarLabel?: string
  onClear: () => void
}) {
  const name = resolved.kind === 'skill' ? resolved.skill.name : resolved.kind === 'tag' ? resolved.label : resolved.raw
  return (
    <section
      aria-labelledby="skill-landing"
      className="relative grid gap-s3 overflow-hidden border-2 border-rule bg-bg-2 p-s5 rounded-2 strata:border-0 strata:border-l-[6px] strata:border-l-accent-2 md:grid-cols-[1fr_auto] md:items-end"
    >
      <div className="grid gap-s2">
        <p className="mono m-0 text-ink-3">Skill landing</p>
        <h2 id="skill-landing" ref={ref} tabIndex={-1} className="text-[clamp(2rem,6vw,3.5rem)] outline-none scroll-mt-24">
          {name}
        </h2>
        <div className="flex flex-wrap items-center gap-s2">
          {resolved.kind === 'skill' ? <Badge tone="accent">{resolved.skill.level}</Badge> : null}
          {pillarLabel ? <Badge>{pillarLabel}</Badge> : null}
          <span className="mono text-ink-2">
            {resolved.kind === 'unknown'
              ? 'No matching skill'
              : `${count} ${count === 1 ? 'demo proves it' : 'demos prove it'}`}
          </span>
        </div>
      </div>
      <Button variant="secondary" size="sm" icon="close" onClick={onClear} className="justify-self-start">
        All skills
      </Button>
    </section>
  )
}
