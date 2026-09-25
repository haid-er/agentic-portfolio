'use client'
/**
 * Colour token field: swatch + native picker + free text (any CSS colour),
 * with the world's default shown and a one-tap reset. Unset = the default
 * from app/globals.css; only overrides are stored in content/theme.json.
 */
import { RotateCcw } from 'lucide-react'
import { controlClasses } from '@/components/ui'
import { isSafeTokenValue } from '@/lib/theme'
import { cx } from '@/lib/utils'
import { useField } from '../EditorContext'
import { toHex6 } from '../lib/contrast'
import type { Path } from '../lib/path'
import { FieldFrame } from './Frame'

export function ColorField({ path, label, fallback, hint }: { path: Path; label: string; fallback: string; hint?: string }) {
  const f = useField<string | undefined>(path)
  const overridden = f.value !== undefined
  const effective = f.value ?? fallback
  const hex = toHex6(effective) ?? toHex6(fallback) ?? '#000000'
  const unsafe = overridden && !isSafeTokenValue(f.value ?? '')
  return (
    <FieldFrame
      label={label}
      error={f.error ?? (unsafe ? 'Not a usable CSS value (no ; { } < > or comments).' : undefined)}
      changed={f.changed}
      hint={hint ?? (overridden ? `Default ${fallback}` : 'Using the default')}
      aside={overridden ? (
        <button type="button" onClick={() => f.set(undefined)} className="inline-flex items-center gap-1 min-h-[32px] px-1 text-accent-ink hover:underline" aria-label={`Reset ${label} to ${fallback}`}>
          <RotateCcw aria-hidden="true" size={13} strokeWidth={1.5} /> reset
        </button>
      ) : undefined}
    >
      {({ id, describedBy, invalid }) => (
        <div className="flex items-stretch gap-2 min-w-0">
          <label className="relative flex-none size-[44px] border border-rule rounded-0 overflow-hidden cursor-pointer" style={{ background: effective }}>
            <span className="sr-only">Pick {label}</span>
            <input
              type="color"
              value={hex}
              onChange={(e) => f.set(e.target.value.toUpperCase())}
              className="absolute inset-0 opacity-0 cursor-pointer size-full"
            />
          </label>
          <input
            id={id}
            data-path={f.key}
            value={f.value ?? ''}
            placeholder={fallback}
            spellCheck={false}
            aria-describedby={describedBy}
            aria-invalid={invalid || unsafe || undefined}
            onChange={(e) => f.set(e.target.value === '' ? undefined : e.target.value)}
            className={cx(controlClasses, 'font-mono text-0 uppercase min-w-0')}
          />
        </div>
      )}
    </FieldFrame>
  )
}
