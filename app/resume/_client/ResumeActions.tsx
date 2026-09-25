'use client'
/**
 * Résumé toolbar (screen only): "Download PDF" serves the uploaded file when
 * one exists, otherwise it opens the browser's print dialog, where "Save as PDF"
 * produces the same sheet thanks to the print stylesheet. `?print=1` (linked
 * from the homepage section) opens the dialog once on arrival.
 */
import { useEffect, useRef } from 'react'
import { Button, Icon, buttonClasses } from '@/components/ui'

export function ResumeActions({ pdfUrl, fileName }: { pdfUrl?: string; fileName: string }) {
  const printed = useRef(false)

  useEffect(() => {
    if (printed.current) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('print') !== '1') return
    printed.current = true
    // Drop the flag so a reload or "back" does not reopen the dialog.
    params.delete('print')
    const rest = params.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`)
    // Let fonts settle so the printed proof uses the right faces.
    const go = () => window.setTimeout(() => window.print(), 250)
    if (document.fonts?.ready) document.fonts.ready.then(go, go)
    else go()
  }, [])

  const print = () => window.print()

  return (
    <div className="flex flex-wrap items-center gap-3">
      {pdfUrl ? (
        // Plain <a download>: a static file is not a route, so next/link is not used.
        <a href={pdfUrl} download={fileName} className={buttonClasses()}>
          <Icon name="download" size={16} />
          Download PDF
        </a>
      ) : (
        <Button icon="download" onClick={print} aria-describedby="resume-print-hint">
          Download PDF
        </Button>
      )}
      <Button variant="secondary" icon="doc" onClick={print}>
        Print
      </Button>
      {pdfUrl ? null : (
        <p id="resume-print-hint" className="m-0 basis-full text-0 text-ink-3">
          Opens the print dialog. Choose &ldquo;Save as PDF&rdquo; as the destination.
        </p>
      )}
    </div>
  )
}
