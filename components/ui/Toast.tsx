'use client'
/**
 * Toasts (DESIGN.md 6.7): bottom-left on desktop, above the folio bar on mobile.
 * Wrap once in the root layout (<ToastProvider>), then `const toast = useToast(); toast('Saved')`.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { cx } from '@/lib/utils'
import type { Tone } from './Badge'

interface ToastItem { id: number; message: string; tone: Tone }
type ToastFn = (message: string, opts?: { tone?: Tone; ms?: number }) => void

const Ctx = createContext<ToastFn>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const toast = useCallback<ToastFn>((message, opts) => {
    const id = Date.now() + Math.random()
    setItems((xs) => [...xs.slice(-2), { id, message, tone: opts?.tone ?? 'neutral' }])
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), opts?.ms ?? 4000)
  }, [])
  const value = useMemo(() => toast, [toast])
  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="fixed left-4 right-4 md:right-auto z-[var(--z-toast)] bottom-[calc(var(--folio-bar)+16px+env(safe-area-inset-bottom))] lg:bottom-[var(--toast-lift,16px)] flex flex-col gap-2 pointer-events-none"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto max-w-sm px-4 py-3 bg-surface text-ink border border-rule shadow-press text-0',
              'strata:rounded-pill almanac:[mask:linear-gradient(#000,#000)]',
              t.tone === 'danger' && 'border-danger',
              t.tone === 'ok' && 'border-ok',
              t.tone === 'warn' && 'border-warn',
              t.tone === 'accent' && 'border-accent',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastFn {
  return useContext(Ctx)
}
