'use client'
/** Every resource × action for one user; a cell click asks that exact question. */
import { Icon, Table, TableWrap, Td, Th } from '@/components/ui'
import { cx } from '@/lib/utils'
import { check } from './ability'
import type { Action, Resource, Role, User } from './model'

const COLS: Action[] = ['read', 'create', 'update', 'delete', 'approve']

export function Matrix({ user, role, resources, active, onPick }: {
  user: User
  role: Role | undefined
  resources: Resource[]
  active: { action: Action; resourceId: string }
  onPick: (action: Action, resourceId: string) => void
}) {
  return (
    <TableWrap label={`Permission matrix for ${user.label}`}>
      <Table>
        <thead>
          <tr>
            <Th>Resource</Th>
            {COLS.map((a) => <Th key={a} className="text-center">{a}</Th>)}
          </tr>
        </thead>
        <tbody>
          {resources.map((r) => (
            <tr key={r.id}>
              <Td className="min-w-[10rem]">
                <span className="block text-0">{r.label}</span>
                <span className="block font-mono text-00 text-ink-3">{r.subject}</span>
              </Td>
              {COLS.map((a) => {
                const ok = check(role, user, a, r).allowed
                const on = active.action === a && active.resourceId === r.id
                return (
                  <Td key={a} className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => onPick(a, r.id)}
                      aria-label={`${a} ${r.label}: ${ok ? 'allowed' : 'denied'}`}
                      aria-pressed={on}
                      className={cx(
                        'inline-flex items-center justify-center size-11 rounded-0 border',
                        on ? 'border-ink bg-bg-2' : 'border-transparent hover:border-rule',
                        ok ? 'text-ok' : 'text-ink-3',
                      )}
                    >
                      <Icon name={ok ? 'check' : 'minus'} size={18} />
                    </button>
                  </Td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </TableWrap>
  )
}
