/** Fan → platform → creator, with the per-charge split as a printed stacked bar. */
import { cx } from '@/lib/utils'
import { CARD_FIXED, CARD_PCT, money, type Split } from './engine'

interface Party { label: string; role: string; value: string; note: string }

export function MoneyFlow({ sp, pulse, accountId }: { sp: Split; pulse: number; accountId?: string }) {
  const parties: Party[] = [
    { label: 'Fan', role: 'customer', value: money(sp.amount), note: 'pays each month' },
    { label: 'Platform', role: 'destination charge', value: money(sp.platformNet), note: `keeps fee ${money(sp.appFee)} − card fee ${money(sp.stripeFee)}` },
    { label: 'Creator', role: accountId ?? 'connected account', value: money(sp.creatorNet), note: 'transferred to the creator' },
  ]
  const parts = [
    { key: 'creator', label: 'Creator', cents: sp.creatorNet, cls: 'bg-data-1' },
    { key: 'platform', label: 'Platform net', cents: Math.max(0, sp.platformNet), cls: 'bg-data-2' },
    { key: 'stripe', label: 'Card processing', cents: sp.stripeFee, cls: 'bg-data-3' },
  ]
  // the card fee comes out of the platform's application fee, so the bar sums to amount + any shortfall
  const total = parts.reduce((a, p) => a + p.cents, 0) || 1

  return (
    <div className="grid gap-4">
      <ol className="m-0 p-0 list-none grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch" aria-label="Money flow for one charge">
        {parties.map((p, i) => (
          <li key={p.label} className="contents">
            {i > 0 ? (
              <span aria-hidden="true" className="flex items-center justify-center text-ink-3 md:px-1">
                <span className="md:hidden">↓</span>
                <span className="hidden md:inline">→</span>
              </span>
            ) : null}
            <div
              key={i === 0 ? pulse : undefined}
              className={cx(
                'border border-rule rounded-1 bg-bg-2 p-3 min-w-0',
                i === 0 && pulse > 0 && 'motion-safe:animate-[fade-in_var(--dur-med)_var(--ease-out)]',
              )}
            >
              <p className="m-0 mono text-ink-3">{p.label} · <span className="normal-case tracking-normal [overflow-wrap:anywhere]">{p.role}</span></p>
              <p className="m-0 display text-3 nums">{p.value}</p>
              <p className="m-0 text-00 text-ink-2">{p.note}</p>
            </div>
          </li>
        ))}
      </ol>

      <figure className="m-0 grid gap-2">
        <figcaption className="mono text-ink-3">Split of one {money(sp.amount)} charge</figcaption>
        <div className="flex h-5 w-full overflow-hidden border border-rule rounded-0" role="img"
          aria-label={parts.map((p) => `${p.label} ${money(p.cents)}`).join(', ')}>
          {parts.map((p) => (
            <span key={p.key} className={cx(p.cls, 'h-full transition-[flex-grow] duration-[var(--dur-med)] [&+&]:border-l [&+&]:border-surface')}
              style={{ flexGrow: p.cents / total, flexBasis: 0 }} />
          ))}
        </div>
        <ul className="m-0 p-0 list-none flex flex-wrap gap-x-4 gap-y-1 text-00">
          {parts.map((p) => (
            <li key={p.key} className="flex items-center gap-2">
              <span aria-hidden="true" className={cx('inline-block size-3 border border-rule', p.cls)} />
              <span className="text-ink-2">{p.label}</span>
              <span className="nums font-semibold">{money(p.cents)}</span>
            </li>
          ))}
        </ul>
        {sp.platformNet < 0 ? (
          <p className="m-0 text-0 text-danger" role="status">
            The fee is smaller than card processing, so the platform loses {money(-sp.platformNet)} on every charge.
          </p>
        ) : null}
        <p className="m-0 text-00 text-ink-3">
          Card processing uses an illustrative {(CARD_PCT * 100).toFixed(1)}% + {money(CARD_FIXED)} rate. On destination charges the platform pays it.
        </p>
      </figure>
    </div>
  )
}
