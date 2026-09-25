'use client'
/** Route error boundary. STUB — owner: shell. */
import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div className="wrap py-s9 grid gap-s5">
      <p className="mono text-ink-3 m-0">Error</p>
      <h1 className="text-5">This page failed to print.</h1>
      <div><Button onClick={reset}>Try again</Button></div>
    </div>
  )
}
