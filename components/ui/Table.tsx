/** Tables (DESIGN.md 6.7): mono heads, hairline rows, tabular nums, own scroll box with edge fade. */
import type { HTMLAttributes, ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cx } from '@/lib/utils'

export function TableWrap({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className={cx('scroll-x', className)}>
      {children}
    </div>
  )
}

export function Table({ className, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cx('w-full border-collapse text-0 nums', className)} {...rest} />
}
export function Th({ className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cx('mono text-ink-3 text-left font-normal py-2 px-3 border-b border-rule whitespace-nowrap', className)} {...rest} />
}
export function Td({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cx('py-2 px-3 border-b border-rule-soft align-top', className)} {...rest} />
}
export function Tr(props: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} />
}
