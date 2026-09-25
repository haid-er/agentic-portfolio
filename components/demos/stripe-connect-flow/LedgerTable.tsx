/** Stripe's view (every event once) against what the webhook handler applied. */
import { Badge, Table, TableWrap, Td, Th, Tr } from '@/components/ui'
import { money, type Ledger } from './engine'

const ROWS: Array<{ label: string; get: (l: Ledger) => string | number }> = [
  { label: 'Creator account', get: (l) => l.account },
  { label: 'Subscription', get: (l) => l.sub.replace('_', ' ') },
  { label: 'Invoices paid', get: (l) => l.invoicesPaid },
  { label: 'Gross volume', get: (l) => money(l.gross) },
  { label: 'Creator balance', get: (l) => money(l.creator) },
  { label: 'Platform net', get: (l) => money(l.platform) },
  { label: 'Card fees', get: (l) => money(l.stripeFees) },
]

export function LedgerTable({ truth, handler, inFlight }: { truth: Ledger; handler: Ledger; inFlight: number }) {
  const drift = ROWS.filter((r) => r.get(truth) !== r.get(handler))
  const overcount = handler.gross > truth.gross
  return (
    <div className="grid gap-3">
      <TableWrap label="Ledger comparison">
        <Table>
          <thead>
            <Tr><Th>Field</Th><Th>Stripe</Th><Th>Your DB</Th></Tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const a = r.get(truth)
              const b = r.get(handler)
              return (
                <Tr key={r.label}>
                  <Td className="text-ink-2">{r.label}</Td>
                  <Td>{a}</Td>
                  <Td className={a !== b ? 'text-danger font-semibold' : undefined}>
                    {b}{a !== b ? <span className="sr-only"> (differs)</span> : null}
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </TableWrap>
      <p className="m-0 flex flex-wrap items-center gap-2 text-0" aria-live="polite">
        {overcount ? (
          <Badge tone="danger">double counted {money(handler.gross - truth.gross)}</Badge>
        ) : drift.length === 0 ? (
          <Badge tone="ok">in sync</Badge>
        ) : inFlight > 0 ? (
          <Badge tone="warn">catching up: {inFlight} in flight</Badge>
        ) : (
          <Badge tone="warn">{drift.length} field{drift.length === 1 ? '' : 's'} differ</Badge>
        )}
        <span className="text-ink-3 text-00">Your DB only changes when a delivery reaches the handler.</span>
      </p>
    </div>
  )
}
