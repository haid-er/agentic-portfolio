'use client'
/**
 * Shared list-item furniture (CONTENT rules: id, enabled, verified, source).
 * - UnverifiedBadge: the warn slug on `verified: false` items (text, never colour only).
 * - ItemMeta: visibility, verification and provenance for one item.
 * - IdField: kebab-case id with "derive from title" and a uniqueness check.
 */
import { useEffect, useRef } from 'react'
import { ShieldAlert, ShieldCheck, Wand2 } from 'lucide-react'
import { Badge, controlClasses } from '@/components/ui'
import { cx } from '@/lib/utils'
import { useEditor, useField } from '../EditorContext'
import { getIn, slugify, uniqueId, type Path } from '../lib/path'
import { ToggleField } from './Choice'
import { FieldFrame } from './Frame'
import { TextAreaField } from './Text'

export function UnverifiedBadge({ className }: { className?: string }) {
  return (
    <Badge tone="warn" className={className}>
      <ShieldAlert aria-hidden="true" size={13} strokeWidth={1.5} />
      Unverified
    </Badge>
  )
}

/** Visibility + verification + source, for the top of an item body. */
export function ItemMeta({ path, kind = 'item' }: { path: Path; kind?: string }) {
  const enabled = useField<boolean>([...path, 'enabled'])
  const verified = useField<boolean | undefined>([...path, 'verified'])
  const source = useField<string | undefined>([...path, 'source'])
  const unverified = verified.value === false
  return (
    <div className={cx('grid gap-s3 p-s3 rounded-1 border', unverified ? 'border-warn bg-bg' : 'border-rule-soft bg-bg')}>
      <div className="flex flex-wrap items-center gap-x-s5 gap-y-1">
        <ToggleField path={[...path, 'enabled']} label="Shown on the site" />
        {unverified ? (
          <button
            type="button"
            onClick={() => verified.set(undefined)}
            className="inline-flex items-center gap-2 min-h-tap text-0 underline text-accent-ink"
          >
            <ShieldCheck aria-hidden="true" size={16} strokeWidth={1.5} /> I confirmed this; mark verified
          </button>
        ) : (
          <button
            type="button"
            onClick={() => verified.set(false)}
            className="inline-flex items-center gap-2 min-h-tap text-0 text-ink-3 hover:text-ink hover:underline"
          >
            <ShieldAlert aria-hidden="true" size={16} strokeWidth={1.5} /> Flag as unverified
          </button>
        )}
      </div>
      {unverified ? (
        <p className="m-0 flex items-start gap-2 text-0 text-warn">
          <ShieldAlert aria-hidden="true" size={16} strokeWidth={1.5} className="mt-[2px] flex-none" />
          <span>
            This {kind} is not verified against the source documents.
            {enabled.value ? ' It is shown publicly; hide it until confirmed.' : ' It stays hidden until you confirm it.'}
          </span>
        </p>
      ) : null}
      {source.value !== undefined || unverified ? (
        <TextAreaField
          path={[...path, 'source']}
          label="Source (admin only)"
          hint="Where this fact comes from. Never rendered on the site."
          optional
          rows={2}
        />
      ) : null}
    </div>
  )
}

/** Kebab-case id; the wand fills it from `from` (usually the title) and keeps it unique in the list. */
export function IdField({ path, listPath, from, label = 'ID', hint }: { path: Path; listPath: Path; from?: string; label?: string; hint?: string }) {
  const ed = useEditor()
  const f = useField<string>(path)
  const siblings = ((getIn(ed.data, listPath) as { id?: string; slug?: string }[] | undefined) ?? [])
  const field = path[path.length - 1] as 'id' | 'slug'
  const index = path[path.length - 2] as number
  const others = siblings.filter((_, i) => i !== index).map((s) => s[field] ?? '')
  const duplicate = f.value !== '' && others.includes(f.value)
  const error = f.error ?? (duplicate ? `Another item already uses “${f.value}”.` : undefined)
  const suggestion = from ? uniqueId(from, others) : ''
  // Fresh items start as "new" / "new-2": keep them in sync with the title until the id is edited by hand.
  const auto = useRef(/^new(-\d+)?$/.test(f.value ?? ''))
  useEffect(() => {
    if (auto.current && suggestion && suggestion !== f.value) f.set(suggestion)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion])
  return (
    <FieldFrame label={label} error={error} changed={f.changed} hint={hint ?? 'lowercase-kebab-case; used in links and commit messages'}>
      {({ id, describedBy, invalid }) => (
        <div className="flex gap-2">
          <input
            id={id}
            data-path={f.key}
            value={f.value ?? ''}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onChange={(e) => { auto.current = false; f.set(e.target.value) }}
            onBlur={(e) => { const s = slugify(e.target.value); if (s && s !== e.target.value) f.set(s) }}
            className={cx(controlClasses, 'font-mono text-0')}
            autoComplete="off"
            spellCheck={false}
          />
          {from ? (
            <button
              type="button"
              onClick={() => { auto.current = false; f.set(suggestion) }}
              disabled={!suggestion || suggestion === f.value}
              aria-label={`Derive ${label} from the title: ${suggestion}`}
              title={suggestion ? `Use “${suggestion}”` : undefined}
              className="grid place-items-center size-[44px] flex-none border border-rule rounded-0 text-ink-2 hover:bg-bg-2 disabled:opacity-40"
            >
              <Wand2 aria-hidden="true" size={17} strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
      )}
    </FieldFrame>
  )
}
