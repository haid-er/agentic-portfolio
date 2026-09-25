/**
 * Résumé section: the summary and expertise on the left, a miniature of the
 * printed sheet on the right (a real preview built from content, not an image).
 * "Download PDF" serves the uploaded file, else opens /resume and prints it.
 */
import Link from 'next/link'
import { resumeDownloadHref } from '@/app/resume/pdf'
import { ButtonLink, Card, Icon, SectionShell, Tag, buttonClasses } from '@/components/ui'
import { getExperience, getProfile, getResume } from '@/lib/content'
import { cx, formatPartialDate } from '@/lib/utils'
import type { SectionProps } from './types'

const PREVIEW_ROLES = 3
const PREVIEW_TECH = 8

function DownloadButton({ fileName }: { fileName: string }) {
  const dl = resumeDownloadHref()
  const cls = buttonClasses({ variant: 'secondary' })
  if (dl.kind === 'pdf') {
    // A static file, not a route: plain <a download>.
    return (
      <a href={dl.href} download={fileName} className={cls}>
        <Icon name="download" size={16} />
        Download PDF
      </a>
    )
  }
  return (
    <Link href={dl.href} className={cls} aria-describedby="resume-dl-hint">
      <Icon name="download" size={16} />
      Download PDF
    </Link>
  )
}

function SheetPreview() {
  const p = getProfile()
  const r = getResume()
  const roles = getExperience().slice(0, PREVIEW_ROLES)
  const tech = r.technologies.slice(0, PREVIEW_TECH)
  return (
    <Link
      href="/resume"
      className={cx(
        'group block no-underline text-ink',
        'almanac:rotate-[-1.2deg] transition-transform duration-[var(--dur-med)] ease-[var(--ease-out)]',
        'hover:rotate-0 focus-visible:rotate-0 strata:hover:-translate-y-[2px]',
      )}
    >
      <Card feature layer={2} className="grid gap-s4">
        <div className="flex items-center justify-between gap-s3 border-b-2 border-rule pb-s3">
          <span className="mono text-ink-3">Proof sheet · A4</span>
          <Icon name="register" size={18} className="text-accent-2" />
        </div>

        <div className="grid gap-1">
          <p className="display m-0 text-4">{p.name}</p>
          {p.headline ? <p className="m-0 text-0 text-ink-2">{p.headline}</p> : null}
        </div>

        {roles.length ? (
          <ul className="m-0 p-0 list-none grid gap-s2">
            {roles.map((e) => (
              <li key={e.id} className="grid grid-cols-[1fr_auto] items-baseline gap-s3 border-t border-rule-soft pt-s2">
                <span className="min-w-0 text-0">
                  <span className="font-semibold">{e.role}</span>
                  <span className="text-ink-2"> · {e.org}</span>
                </span>
                <span className="mono text-ink-3 nums">{formatPartialDate(e.start).split(' ').pop()}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {/* ruled lines: the rest of the sheet, set in grey */}
        <div aria-hidden="true" className="grid gap-[7px]">
          {[92, 78, 86, 54].map((w) => (
            <span key={w} className="block h-[5px] rounded-pill bg-rule-soft" style={{ width: `${w}%` }} />
          ))}
        </div>

        {tech.length ? (
          <ul className="m-0 p-0 list-none flex flex-wrap gap-1" aria-label="Technologies">
            {tech.map((t) => <li key={t}><Tag className="normal-case tracking-normal">{t}</Tag></li>)}
          </ul>
        ) : null}

        <span className="mono inline-flex items-center gap-2 text-accent-ink">
          Open the full sheet
          <Icon name="arrow" size={14} className="transition-transform duration-[var(--dur-fast)] group-hover:translate-x-[3px]" />
        </span>
      </Card>
    </Link>
  )
}

export default function Resume({ section, folio }: SectionProps) {
  const resume = getResume()
  if (!resume.enabled) return null
  const p = getProfile()
  const fileName = `${p.name.replace(/\s+/g, '-')}-Resume.pdf`
  const printFallback = resumeDownloadHref().kind === 'print'

  return (
    <SectionShell
      id={section.id}
      folio={folio}
      title={section.title || 'Résumé'}
      note={section.note}
      aside={resume.updated ? <span className="mono text-ink-3 nums">Updated {formatPartialDate(resume.updated)}</span> : undefined}
    >
      <div className="grid gap-s7 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
        <div className="grid gap-s5 min-w-0">
          {resume.summary ? <p className="m-0 text-2 leading-[1.35] measure">{resume.summary}</p> : null}

          {resume.expertise.length ? (
            <ol className="m-0 p-0 list-none grid measure" aria-label="Expertise">
              {resume.expertise.map((x, i) => (
                <li
                  key={x}
                  className="flex items-baseline gap-s3 min-h-tap py-s2 border-b border-rule-soft almanac:first:border-t strata:first:border-t"
                >
                  <span aria-hidden="true" className="display text-2 text-accent-ink nums w-8 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-1">{x}</span>
                </li>
              ))}
            </ol>
          ) : null}

          <div className="grid gap-s2">
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/resume">Open the résumé</ButtonLink>
              <DownloadButton fileName={fileName} />
            </div>
            {printFallback ? (
              <p id="resume-dl-hint" className="m-0 text-00 text-ink-3">
                Opens the résumé and the print dialog: choose &ldquo;Save as PDF&rdquo;.
              </p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 max-w-[440px] w-full justify-self-center lg:justify-self-end">
          <SheetPreview />
        </div>
      </div>
    </SectionShell>
  )
}
