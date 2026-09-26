'use client'
/**
 * The sandboxed mock marketplace the recorder drives. It is an ordinary controlled React form:
 * the recorder listens to real DOM events on it, and replay dispatches real DOM events back.
 *
 * Every control carries three kinds of hook a bot could target:
 *  - a hashed id that changes with every "site build" (like generated class names),
 *  - an aria-label (mostly stable, but copy edits happen),
 *  - a data-testid (the contract a team keeps stable for automation).
 */
import type { ReactNode } from 'react'
import { Icon } from '@/components/ui'
import { cx } from '@/lib/utils'

export type Build = 'a1' | 'b7'

export const CATEGORIES = [
  { value: '', label: 'Choose a category' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'sports', label: 'Sports and outdoors' },
  { value: 'home', label: 'Home and garden' },
  { value: 'clothing', label: 'Clothing' },
] as const

export const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'like-new', label: 'Used, like new' },
  { value: 'good', label: 'Used, good' },
  { value: 'fair', label: 'Used, fair' },
] as const

export interface SiteState {
  title: string
  price: string
  category: string
  condition: string
  description: string
  location: string
  photos: number
  published: boolean
  errors: Partial<Record<'title' | 'price' | 'category' | 'condition', string>>
}

export const EMPTY_SITE: SiteState = {
  title: '', price: '', category: '', condition: '', description: '', location: '',
  photos: 0, published: false, errors: {},
}

export const MAX_PHOTOS = 3

export function validate(s: SiteState): SiteState['errors'] {
  const errors: SiteState['errors'] = {}
  if (!s.title.trim()) errors.title = 'Add a title.'
  const p = Number(s.price)
  if (!s.price.trim() || !Number.isFinite(p) || p <= 0) errors.price = 'Enter a price above 0.'
  if (!s.category) errors.category = 'Pick a category.'
  if (!s.condition) errors.condition = 'Pick a condition.'
  return errors
}

/** Labels that change between site builds, so the aria strategy can break on one field. */
const COPY: Record<Build, { price: string; publish: string }> = {
  a1: { price: 'Price', publish: 'Publish' },
  b7: { price: 'Asking price', publish: 'Publish listing' },
}

const inputCls =
  'w-full min-h-tap px-3 py-2 bg-surface text-ink border border-rule rounded-0 aria-[invalid=true]:border-danger'

function FieldRow({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label htmlFor={id} className="mono text-ink-2">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="m-0 flex items-center gap-1 text-0 text-danger">
          <Icon name="alert" size={14} />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}

export function MockSite({ build, state, onChange, onPublish, onReset }: {
  build: Build
  state: SiteState
  onChange: (patch: Partial<SiteState>) => void
  onPublish: () => void
  onReset: () => void
}) {
  const id = (name: string) => `lst-${build}-${name}`
  const copy = COPY[build]
  const err = state.errors

  if (state.published) {
    const cat = CATEGORIES.find((c) => c.value === state.category)?.label ?? ''
    const cond = CONDITIONS.find((c) => c.value === state.condition)?.label ?? ''
    return (
      <div data-testid="listing-published" className="grid gap-3" role="status" aria-live="polite">
        <p className="m-0 flex items-center gap-2 font-semibold text-ok">
          <Icon name="check" size={18} /> Listing published (in the sandbox)
        </p>
        <article className="grid gap-3 xs:grid-cols-[120px_1fr] border border-rule rounded-1 p-3 bg-bg">
          <div aria-hidden="true" className="aspect-square rounded-0 border border-rule bg-bg-2 [background-image:repeating-linear-gradient(45deg,var(--rule-soft)_0_2px,transparent_2px_9px)]" />
          <div className="min-w-0 grid gap-1 content-start">
            <p className="m-0 display text-2 [overflow-wrap:anywhere]">{state.title}</p>
            <p className="m-0 nums font-semibold text-accent-ink">{formatPrice(state.price)}</p>
            <p className="m-0 mono text-ink-3">{[cat, cond, state.location].filter(Boolean).join(' · ')}</p>
            {state.description ? <p className="m-0 text-0 text-ink-2 [overflow-wrap:anywhere]">{state.description}</p> : null}
            <p className="m-0 mono text-ink-3">{state.photos} photo{state.photos === 1 ? '' : 's'} · listed just now</p>
          </div>
        </article>
        <button
          type="button"
          id={id('again')}
          data-testid="create-another"
          aria-label="Create another listing"
          onClick={onReset}
          className="justify-self-start min-h-tap px-4 border border-rule rounded-pill font-mono text-00 uppercase tracking-[.08em] hover:bg-bg-2"
        >
          Create another
        </button>
      </div>
    )
  }

  return (
    <form
      noValidate
      aria-label="Create listing"
      onSubmit={(e) => { e.preventDefault(); onPublish() }}
      className="grid gap-4"
    >
      <p className="m-0 display text-2">Create listing</p>

      <FieldRow id={id('title')} label="Title" error={err.title}>
        <input
          id={id('title')} data-testid="listing-title" aria-label="Title" className={inputCls}
          value={state.title} maxLength={80} autoComplete="off" placeholder="What are you selling?"
          aria-invalid={Boolean(err.title) || undefined} aria-describedby={err.title ? `${id('title')}-err` : undefined}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </FieldRow>

      <div className="grid gap-4 xs:grid-cols-2">
        <FieldRow id={id('price')} label={copy.price} error={err.price}>
          <input
            id={id('price')} data-testid="listing-price" aria-label={copy.price} className={cx(inputCls, 'nums')}
            value={state.price} inputMode="decimal" autoComplete="off" placeholder="0" maxLength={9}
            aria-invalid={Boolean(err.price) || undefined} aria-describedby={err.price ? `${id('price')}-err` : undefined}
            onChange={(e) => onChange({ price: e.target.value.replace(/[^\d.]/g, '') })}
          />
        </FieldRow>
        <FieldRow id={id('category')} label="Category" error={err.category}>
          <select
            id={id('category')} data-testid="listing-category" aria-label="Category" className={inputCls}
            value={state.category}
            aria-invalid={Boolean(err.category) || undefined} aria-describedby={err.category ? `${id('category')}-err` : undefined}
            onChange={(e) => onChange({ category: e.target.value })}
          >
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </FieldRow>
      </div>

      <fieldset className="m-0 p-0 border-0 grid gap-1 min-w-0">
        <legend className="mono text-ink-2 mb-1">Condition</legend>
        <div role="radiogroup" aria-label="Condition" className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => {
            const on = state.condition === c.value
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={on}
                id={id(`cond-${c.value}`)}
                data-testid={`condition-${c.value}`}
                aria-label={c.label}
                onClick={() => onChange({ condition: c.value })}
                className={cx(
                  'min-h-tap px-3 border rounded-pill text-0 transition-colors duration-[var(--dur-fast)]',
                  on ? 'bg-ink text-bg border-ink' : 'bg-surface text-ink border-rule hover:bg-bg-2',
                )}
              >
                {on ? <span aria-hidden="true">● </span> : null}{c.label}
              </button>
            )
          })}
        </div>
        {err.condition ? (
          <p className="m-0 flex items-center gap-1 text-0 text-danger"><Icon name="alert" size={14} />{err.condition}</p>
        ) : null}
      </fieldset>

      <FieldRow id={id('description')} label="Description">
        <textarea
          id={id('description')} data-testid="listing-description" aria-label="Description" rows={3}
          className={cx(inputCls, 'leading-[1.5] resize-y')} maxLength={400} value={state.description}
          placeholder="Size, age, pickup details"
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </FieldRow>

      <FieldRow id={id('location')} label="Pickup area">
        <input
          id={id('location')} data-testid="listing-location" aria-label="Pickup area" className={inputCls}
          value={state.location} maxLength={60} autoComplete="off" placeholder="Neighbourhood or city"
          onChange={(e) => onChange({ location: e.target.value })}
        />
      </FieldRow>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          id={id('photo')}
          data-testid="add-photo"
          aria-label="Add photo"
          disabled={state.photos >= MAX_PHOTOS}
          onClick={() => onChange({ photos: Math.min(MAX_PHOTOS, state.photos + 1) })}
          className="inline-flex items-center gap-2 min-h-tap px-3 border border-dashed border-rule rounded-1 text-0 hover:bg-bg-2 disabled:opacity-55"
        >
          <Icon name="plus" size={16} /> Add photo
        </button>
        <div className="flex gap-2" aria-label={`${state.photos} of ${MAX_PHOTOS} photos added`} role="img">
          {Array.from({ length: MAX_PHOTOS }, (_, i) => (
            <span
              key={i}
              className={cx(
                'size-9 border rounded-0',
                i < state.photos
                  ? 'border-rule bg-bg-2 [background-image:repeating-linear-gradient(45deg,var(--rule-soft)_0_2px,transparent_2px_7px)]'
                  : 'border-dashed border-rule-soft',
              )}
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        id={id('publish')}
        data-testid="publish"
        aria-label={copy.publish}
        className="justify-self-start min-h-tap px-5 bg-ink text-bg almanac:text-on-accent border border-ink rounded-pill font-mono text-0 uppercase tracking-[.08em] hover:bg-accent hover:border-accent hover:text-on-accent"
      >
        {copy.publish}
      </button>
    </form>
  )
}

export function formatPrice(p: string): string {
  const n = Number(p)
  if (!Number.isFinite(n)) return p
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
