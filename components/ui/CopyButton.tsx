'use client'
/**
 * Copy-to-clipboard button. 44px target, keyboard accessible, honest about failure:
 * without the Clipboard API (or when the write is refused) it selects `targetId`'s
 * contents, when given, and asks the visitor to press Ctrl/Cmd+C.
 */
import { useEffect, useRef, useState } from 'react'
import { Button, type ButtonVariant } from './Button'
import { useToast } from './Toast'

export interface CopyButtonProps {
  text: string
  label?: string
  copiedLabel?: string
  /** Element whose contents are selected when the Clipboard API fails. */
  targetId?: string
  variant?: ButtonVariant
  className?: string
}

function selectTarget(id: string): boolean {
  const el = document.getElementById(id)
  const sel = window.getSelection()
  if (!el || !sel) return false
  sel.removeAllRanges()
  sel.selectAllChildren(el)
  return true
}

export function CopyButton({ text, label = 'Copy', copiedLabel = 'Copied', targetId, variant = 'secondary', className }: CopyButtonProps) {
  const toast = useToast()
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [said, setSaid] = useState('')
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const done = (next: 'copied' | 'failed', message: string) => {
    setState(next)
    setSaid(message)
    toast(message, { tone: next === 'copied' ? 'ok' : 'warn' })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState('idle'), 2000)
  }

  const onClick = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard')
      await navigator.clipboard.writeText(text)
      done('copied', copiedLabel)
    } catch {
      const selected = targetId ? selectTarget(targetId) : false
      done('failed', selected ? 'Copy was blocked. The text is selected: press Ctrl/Cmd+C.' : 'Copy was blocked by the browser. Select the text by hand.')
    }
  }

  return (
    <>
      <Button variant={variant} size="sm" icon={state === 'copied' ? 'check' : 'copy'} onClick={onClick} className={className}>
        {state === 'copied' ? copiedLabel : label}
      </Button>
      <span className="sr-only" aria-live="polite">{said}</span>
    </>
  )
}
