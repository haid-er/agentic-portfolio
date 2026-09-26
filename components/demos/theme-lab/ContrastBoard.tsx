'use client'
/** Live WCAG checks: the required pairs (with one-tap fixes) and a text-on-paper matrix. */
import { Badge, Button, DemoPanel, Icon, Table, TableWrap, Td, Th } from '@/components/ui'
import type { ColorToken } from '@/lib/theme'
import { cx } from '@/lib/utils'
import { contrast, fixForeground, grade } from './color'
import { MATRIX_BG, MATRIX_FG, PAIRS, ratioOf, type Palette, type Pair } from './tokens'

function Chip({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block size-4 border border-rule align-middle shrink-0" style={{ background: color }} />
}

export function ContrastBoard({ palette, onFix, onFixAll }: {
  palette: Palette
  onFix: (token: ColorToken, value: string) => void
  onFixAll: () => void
}) {
  const failing = PAIRS.filter((p) => ratioOf(palette, p) < p.min)
  return (
    <DemoPanel
      title="Contrast"
      meta={failing.length ? `${failing.length} failing` : 'All pairs pass'}
      actions={failing.length ? <Button size="sm" icon="check" onClick={onFixAll}>Fix all</Button> : undefined}
    >
      <div className="grid gap-5">
        <p className="m-0 text-0 text-ink-2" aria-live="polite">
          {failing.length
            ? `${failing.length} pair${failing.length === 1 ? '' : 's'} below the minimum. Fixes move only the foreground's lightness, by the smallest step that passes.`
            : 'Every text pair is at least 4.5:1 and every border and chart ink at least 3:1.'}
        </p>

        <TableWrap label="Required contrast pairs">
          <Table>
            <thead>
              <tr><Th>Use</Th><Th>Pair</Th><Th className="text-right">Ratio / needs</Th><Th>Result</Th></tr>
            </thead>
            <tbody>
              {PAIRS.map((p) => <PairRow key={`${p.fg}${p.bg}`} pair={p} palette={palette} onFix={onFix} />)}
            </tbody>
          </Table>
        </TableWrap>

        <div className="grid gap-2">
          <h4 className="m-0 mono text-ink-2">Text on paper</h4>
          <TableWrap label="Contrast matrix of text inks on paper tokens">
            <Table>
              <thead>
                <tr>
                  <Th>Ink \ paper</Th>
                  {MATRIX_BG.map((b) => <Th key={b} className="text-right"><span className="inline-flex items-center gap-1"><Chip color={palette[b]} />{b}</span></Th>)}
                </tr>
              </thead>
              <tbody>
                {MATRIX_FG.map((f) => (
                  <tr key={f}>
                    <Td className="font-mono text-00 whitespace-nowrap"><span className="inline-flex items-center gap-1"><Chip color={palette[f]} />{f}</span></Td>
                    {MATRIX_BG.map((b) => {
                      const r = contrast(palette[f], palette[b]) ?? 0
                      const g = grade(r, 4.5)
                      return (
                        <Td key={b} className="text-right whitespace-nowrap">
                          <span className="font-mono">{r.toFixed(2)}</span>{' '}
                          <span className={cx('mono', g.pass ? 'text-ok' : r >= 3 ? 'text-warn' : 'text-danger')}>{g.label}</span>
                        </Td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
          <p className="m-0 text-00 text-ink-3">AA needs 4.5:1 for body text; “Large only” means 3:1, fine for 24px type and decoration.</p>
        </div>
      </div>
    </DemoPanel>
  )
}

function PairRow({ pair, palette, onFix }: { pair: Pair; palette: Palette; onFix: (token: ColorToken, value: string) => void }) {
  const r = ratioOf(palette, pair)
  const ok = r >= pair.min
  const fix = ok ? null : fixForeground(palette[pair.fg], palette[pair.bg], pair.min)
  return (
    <tr>
      <Td className="whitespace-nowrap">{pair.use}</Td>
      <Td className="whitespace-nowrap">
        <span
          // Graphic pairs (3:1) are sampled as large bold text, where 3:1 is the WCAG bar.
          className={cx('inline-flex items-center px-2 py-[2px] border border-rule-soft font-mono', pair.min < 4.5 ? 'text-[19px] font-bold leading-tight' : 'text-00')}
          style={{ background: palette[pair.bg], color: palette[pair.fg] }}
        >
          {pair.fg.slice(2)} / {pair.bg.slice(2)}
        </span>
      </Td>
      <Td className="text-right font-mono whitespace-nowrap">{r.toFixed(2)} <span className="text-00 text-ink-3">/ {pair.min}</span></Td>
      <Td className="whitespace-nowrap">
        {ok ? (
          <Badge tone="ok"><Icon name="check" size={12} /> Pass</Badge>
        ) : fix ? (
          <Button size="sm" variant="danger" onClick={() => onFix(pair.fg, fix)} aria-label={`Fix ${pair.use}: set ${pair.fg} to ${fix}`}>
            Fix → {fix}
          </Button>
        ) : (
          <Badge tone="danger">Move {pair.bg}</Badge>
        )}
      </Td>
    </tr>
  )
}
