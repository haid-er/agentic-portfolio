'use client'
/** Copies an address to the clipboard and confirms with a toast (text, never colour alone). */
import { useState } from 'react'
import { Button, useToast } from '@/components/ui'

export function CopyEmail({ email }: { email: string }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      toast(`Copied ${email}`, { tone: 'ok' })
      window.setTimeout(() => setCopied(false), 2400)
    } catch {
      toast('Copy is blocked here. Select the address instead.', { tone: 'warn' })
    }
  }

  return (
    <Button variant="ghost" size="sm" icon={copied ? 'check' : 'copy'} onClick={copy} aria-label={`Copy email address ${email}`}>
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}
