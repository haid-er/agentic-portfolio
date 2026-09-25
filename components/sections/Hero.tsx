/** Hero + core-sample plate (DESIGN.md 6.1, 9). STUB — owner: hero-about. */
import { ButtonLink, Kicker } from '@/components/ui'
import { getProfile, getSite } from '@/lib/content'
import type { SectionProps } from './types'

export default function Hero({ section }: SectionProps) {
  const { hero } = getSite()
  const profile = getProfile()
  return (
    <section id={section.id} aria-labelledby="hero-title" className="py-s7 md:py-s8">
      <div className="wrap grid gap-s5">
        <Kicker parts={hero.kicker} />
        <h1 id="hero-title" className="text-hero">{profile.name}</h1>
        {profile.headline ? <p className="display text-3 m-0">{profile.headline}</p> : null}
        {profile.tagline ? <p className="measure text-ink-2 m-0">{profile.tagline}</p> : null}
        <div className="flex flex-wrap gap-3">
          {hero.ctas.map((c) => (
            <ButtonLink key={c.href + c.label} href={c.href} variant={c.variant}>{c.label}</ButtonLink>
          ))}
        </div>
      </div>
    </section>
  )
}
