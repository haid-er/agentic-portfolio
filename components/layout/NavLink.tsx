'use client'
/**
 * A nav link that jumps to a homepage section in place (smooth unless reduced
 * motion, focus moves to the section heading) and otherwise behaves like next/link.
 */
import Link from 'next/link'
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { useReducedMotion } from '@/lib/hooks'
import { canJump, jumpToSection } from './events'

interface NavLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string
  children: ReactNode
  /**
   * Called before an in-page jump or a navigation (close a dialog). When set, the
   * jump waits a beat so the closing dialog hands focus back first.
   */
  onNavigate?: () => void
}

export function NavLink({ href, children, onNavigate, onClick, ...rest }: NavLinkProps) {
  const reduced = useReducedMotion()
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    if (!onNavigate) {
      if (jumpToSection(href, reduced)) e.preventDefault()
      return
    }
    if (canJump(href)) {
      e.preventDefault()
      onNavigate()
      window.setTimeout(() => jumpToSection(href, reduced), 60)
    } else {
      onNavigate()
    }
  }
  return <Link href={href} onClick={handle} {...rest}>{children}</Link>
}
