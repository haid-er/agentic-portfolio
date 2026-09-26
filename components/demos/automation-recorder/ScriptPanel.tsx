'use client'
/** The recording as a runnable Puppeteer script, with copy and download. */
import { useMemo } from 'react'
import { Button, DemoPanel, EmptyState, useToast } from '@/components/ui'
import { toPuppeteer, type Step, type Strategy } from './recorder'

const FILE = 'create-listing.mjs'

export function ScriptPanel({ steps, strategy }: { steps: Step[]; strategy: Strategy }) {
  const toast = useToast()
  const code = useMemo(() => toPuppeteer(steps, strategy), [steps, strategy])
  const empty = steps.length === 0

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast('Script copied', { tone: 'ok' })
    } catch {
      toast('Copy failed: your browser blocked clipboard access. Use Download instead.', { tone: 'danger' })
    }
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    const a = document.createElement('a')
    a.href = url
    a.download = FILE
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <DemoPanel
      title="Puppeteer export"
      meta={FILE}
      actions={
        <>
          <Button size="sm" variant="secondary" icon="copy" onClick={copy} disabled={empty}>Copy</Button>
          <Button size="sm" variant="secondary" icon="download" onClick={download} disabled={empty}>Download</Button>
        </>
      }
    >
      {empty ? (
        <EmptyState title="Nothing to export yet">Record or load steps and the script writes itself here.</EmptyState>
      ) : (
        <pre
          tabIndex={0}
          aria-label="Generated Puppeteer script"
          className="m-0 max-h-[26rem] overflow-auto p-3 bg-bg border border-rule-soft rounded-1 font-mono text-00 leading-[1.6] text-ink whitespace-pre"
        >
          <code>{code}</code>
        </pre>
      )}
    </DemoPanel>
  )
}
