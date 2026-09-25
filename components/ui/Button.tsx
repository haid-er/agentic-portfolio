/**
 * Buttons (DESIGN.md 6.2): mono uppercase, 44px min height, trailing arrow.
 * Almanac: square + hard shadow, presses by translate(2px,2px).
 * Strata: pill, presses by scale(.98).
 */
import Link from 'next/link'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/utils'
import { Icon, type IconName } from './Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'sm'

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Leading icon. */
  icon?: IconName
  /** Trailing arrow glyph (default true for primary). */
  arrow?: boolean
  children?: ReactNode
  className?: string
}

export function buttonClasses({ variant = 'primary', size = 'md', className }: Pick<CommonProps, 'variant' | 'size' | 'className'> = {}) {
  return cx(
    'inline-flex items-center justify-center gap-2 min-h-tap max-w-full py-2 text-center select-none [overflow-wrap:anywhere]',
    'font-mono uppercase tracking-[.08em] leading-[1.2] rounded-pill border',
    'transition-[transform,box-shadow,background-color,color] duration-[var(--dur-fast)] ease-[var(--ease-out)]',
    'disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55',
    'strata:active:scale-[.98]',
    size === 'md' ? 'px-5 text-0' : 'px-3 text-00',
    variant === 'primary' &&
      'bg-ink text-bg border-ink almanac:text-on-accent almanac:shadow-[3px_3px_0_var(--accent-2)] almanac:active:translate-x-[2px] almanac:active:translate-y-[2px] almanac:active:shadow-none hover:bg-accent hover:border-accent hover:text-on-accent',
    variant === 'secondary' &&
      'bg-transparent text-ink border-rule hover:bg-bg-2 almanac:active:translate-x-[2px] almanac:active:translate-y-[2px]',
    variant === 'ghost' && 'bg-transparent text-ink border-transparent hover:border-rule',
    variant === 'danger' && 'bg-transparent text-danger border-danger hover:bg-bg-2',
    className,
  )
}

function Inner({ icon, arrow, children }: Pick<CommonProps, 'icon' | 'arrow' | 'children'>) {
  return (
    <>
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
      {arrow ? <Icon name="arrow" size={16} /> : null}
    </>
  )
}

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({ variant = 'primary', size = 'md', icon, arrow, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses({ variant, size, className })} {...rest}>
      <Inner icon={icon} arrow={arrow ?? false}>{children}</Inner>
    </button>
  )
}

export type ButtonLinkProps = CommonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string }

/** Internal hrefs use next/link; external ones open with rel=noopener. */
export function ButtonLink({ variant = 'primary', size = 'md', icon, arrow, className, children, href, ...rest }: ButtonLinkProps) {
  const cls = buttonClasses({ variant, size, className })
  const inner = <Inner icon={icon} arrow={arrow ?? variant === 'primary'}>{children}</Inner>
  if (/^https?:\/\//.test(href)) {
    return <a href={href} className={cls} target="_blank" rel="noopener noreferrer" {...rest}>{inner}</a>
  }
  if (/^(mailto:|tel:)/.test(href)) return <a href={href} className={cls} {...rest}>{inner}</a>
  return <Link href={href} className={cls} {...rest}>{inner}</Link>
}
