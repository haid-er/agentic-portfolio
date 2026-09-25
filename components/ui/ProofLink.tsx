/** "Proof: demo-slug" link (DESIGN.md 6.4, 12: every claim ends in a proof). */
import Link from 'next/link'
import { cx } from '@/lib/utils'
import { Icon } from './Icon'

export function ProofLink({ slug, label = 'Proof', className }: { slug: string; label?: string; className?: string }) {
  return (
    <Link
      href={`/playground/${slug}`}
      className={cx(
        'mono inline-flex items-center gap-2 min-h-tap text-accent-ink no-underline',
        'border-b border-current hover:text-ink self-start',
        className,
      )}
    >
      <span>{label}:</span>
      <span>{slug}</span>
      <Icon name="arrow" size={14} />
    </Link>
  )
}

/** A row of proof links: "Proof: a · b". */
export function ProofRow({ slugs, className }: { slugs: string[]; className?: string }) {
  if (!slugs.length) return null
  return (
    <div className={cx('flex flex-wrap items-center gap-x-4 gap-y-1', className)}>
      {slugs.map((s, i) => <ProofLink key={s} slug={s} label={i === 0 ? 'Proof' : 'Also'} />)}
    </div>
  )
}
