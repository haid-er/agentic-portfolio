'use client'
/** Copy the edited world as CSS or as theme.json tokens, ready to paste into the admin theme editor. */
import { useState } from 'react'
import { Button, ButtonLink, DemoPanel, Segmented, useToast } from '@/components/ui'
import type { ThemeKey } from '@/lib/theme/keys'
import { cssBlock, themeJsonTokens, type Edits, type Palette } from './tokens'

type Format = 'css' | 'json'

export function Output({ world, label, palette, edits, failing, onSendToAdmin }: {
  world: ThemeKey
  label: string
  palette: Palette
  edits: Edits
  failing: number
  onSendToAdmin: () => boolean
}) {
  const toast = useToast()
  const [format, setFormat] = useState<Format>('css')
  const [allTokens, setAllTokens] = useState(false)
  const [sent, setSent] = useState(false)
  const text = format === 'css' ? cssBlock(world, palette, allTokens ? undefined : edits) : themeJsonTokens(world, palette)
  const changed = Object.keys(edits).length

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast(format === 'css' ? 'CSS copied.' : 'theme.json tokens copied.', { tone: 'ok' })
    } catch {
      toast('Clipboard is blocked here: select the text and copy it by hand.', { tone: 'warn' })
    }
  }

  // Hand-off: the admin editor takes pasted theme.json tokens, so copy them; the draft stays in this browser as a backup.
  const send = async () => {
    if (!onSendToAdmin()) return
    setSent(true)
    try {
      await navigator.clipboard.writeText(themeJsonTokens(world, palette))
      toast(`theme.json tokens for ${label} copied.`, { tone: 'ok' })
    } catch {
      setFormat('json')
      toast('Clipboard is blocked here: copy the theme.json tokens above by hand.', { tone: 'warn' })
    }
  }

  return (
    <DemoPanel title="Output" meta={changed ? `${changed} token${changed === 1 ? '' : 's'} changed` : 'No changes'}>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Segmented label="Format" value={format} onChange={setFormat} options={[{ value: 'css', label: 'CSS' }, { value: 'json', label: 'theme.json' }]} />
          {format === 'css' ? (
            <label className="inline-flex items-center gap-2 min-h-tap text-0 cursor-pointer">
              <input type="checkbox" checked={allTokens} onChange={(e) => setAllTokens(e.target.checked)} className="size-5 accent-[var(--accent)]" />
              All colour tokens
            </label>
          ) : null}
        </div>
        <pre className="m-0 max-h-72 overflow-auto p-3 bg-bg-2 border border-rule rounded-1 font-mono text-00 leading-[1.6] text-ink whitespace-pre" tabIndex={0} aria-label={`${format === 'css' ? 'CSS' : 'theme.json'} output`}>
          {text}
        </pre>
        <p className="m-0 text-00 text-ink-3">
          {format === 'css'
            ? 'Scoped to the world attribute, so it can theme any subtree, not just the page.'
            : 'Overrides on top of the shipped defaults, in the shape content/theme.json stores under this world’s tokens.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon="copy" onClick={copy}>Copy</Button>
          <Button size="sm" icon="upload" onClick={send} disabled={failing > 0 || changed === 0}>Copy for admin</Button>
        </div>
        {failing > 0 ? (
          <p className="m-0 text-0 text-danger" role="status">Saving is blocked while {failing} pair{failing === 1 ? '' : 's'} fail contrast. Fix them first.</p>
        ) : null}
        {sent ? (
          <div className="grid gap-2 p-3 border border-rule rounded-1 bg-bg-2">
            <p className="m-0 text-0 text-ink-2">
              Open Themes in the admin in this browser and choose “Load Theme lab draft”: it picks up these {label} colours as unsaved edits and runs the contrast check before saving. Or paste these theme.json tokens by hand. Saving there commits and redeploys.
            </p>
            <ButtonLink href="/admin/theme" size="sm" variant="secondary">Open the theme editor (sign-in required)</ButtonLink>
          </div>
        ) : null}
      </div>
    </DemoPanel>
  )
}
