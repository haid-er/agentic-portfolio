/** Invoice preview for the selected job, printed like a slip. */
import { Badge, Button, EmptyState, Table, TableWrap, Td, Th, Tr } from '@/components/ui'
import { clock, invoiceFor, money, TAX_RATE, type Stop, type Tech } from './model'

export function Invoice({ stop, tech, onCopy }: { stop: Stop | null; tech: Tech | null; onCopy: (text: string) => void }) {
  if (!stop || !tech) {
    return (
      <EmptyState title="No job selected">
        Pick an assigned job on the map, the timeline or the list to preview its invoice.
      </EmptyState>
    )
  }
  const { job } = stop
  const inv = invoiceFor(job, tech)
  const number = `INV-${job.id.slice(1)}${tech.id}`
  const text = [
    `Invoice ${number} (draft)`,
    `${job.address} · ${job.task}`,
    `Technician: ${tech.name} · ${clock(stop.start)}–${clock(stop.end)}`,
    ...inv.lines.map((l) => `${l.label}: ${l.qty} × ${money(l.unit)} = ${money(l.total)}`),
    `Subtotal ${money(inv.subtotal)} · Tax ${money(inv.tax)} · Total ${money(inv.total)}`,
  ].join('\n')

  return (
    <article className="grid gap-3" aria-label={`Invoice preview for ${job.id}`}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 mono text-ink-3">Invoice {number}</p>
          <p className="m-0 font-semibold">{job.address}</p>
          <p className="m-0 text-0 text-ink-2">{job.task} · {tech.name} · {clock(stop.start)}–{clock(stop.end)}</p>
        </div>
        <Badge tone={stop.late > 0 ? 'warn' : 'neutral'}>{stop.late > 0 ? 'draft · late arrival' : 'draft'}</Badge>
      </header>
      <TableWrap label="Invoice lines">
        <Table>
          <thead><Tr><Th>Item</Th><Th className="text-right">Qty</Th><Th className="text-right">Rate</Th><Th className="text-right">Amount</Th></Tr></thead>
          <tbody>
            {inv.lines.map((l) => (
              <Tr key={l.label}>
                <Td>{l.label}</Td>
                <Td className="text-right">{l.qty}</Td>
                <Td className="text-right">{money(l.unit)}</Td>
                <Td className="text-right">{money(l.total)}</Td>
              </Tr>
            ))}
            <Tr><Td colSpan={3} className="text-right text-ink-2">Subtotal</Td><Td className="text-right">{money(inv.subtotal)}</Td></Tr>
            <Tr><Td colSpan={3} className="text-right text-ink-2">Tax ({Math.round(TAX_RATE * 100)}%)</Td><Td className="text-right">{money(inv.tax)}</Td></Tr>
            <Tr><Td colSpan={3} className="text-right font-semibold">Total</Td><Td className="text-right display text-2">{money(inv.total)}</Td></Tr>
          </tbody>
        </Table>
      </TableWrap>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" icon="copy" onClick={() => onCopy(text)}>Copy as text</Button>
        <span className="text-00 text-ink-3">Rates, parts and tax are illustrative.</span>
      </div>
    </article>
  )
}
