/**
 * Recorder model: steps, selector strategies, DOM helpers for replay and the Puppeteer export.
 * No React here, so it stays easy to read and test.
 */

export type Strategy = 'testid' | 'aria' | 'css'
export type StepKind = 'click' | 'type' | 'select' | 'wait'

/** Every recorded target keeps all three selectors, so switching strategy re-targets the whole recording. */
export interface Targets { testid: string; aria: string; css: string }

export interface Step {
  id: string
  kind: StepKind
  /** Human label of the control ("Title", "Publish"). */
  label: string
  targets?: Targets
  value?: string
  ms?: number
}

export const STRATEGIES: { value: Strategy; label: string }[] = [
  { value: 'testid', label: 'data-testid' },
  { value: 'aria', label: 'aria-label' },
  { value: 'css', label: 'CSS id' },
]

export const SANDBOX_URL = 'https://marketplace.example/listing/new'

let seq = 0
export const stepId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`

const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

/** Builds all three selectors from a real element, the way a recorder extension would. */
export function targetsFor(el: HTMLElement): Targets {
  const tag = el.tagName.toLowerCase()
  const testid = el.dataset.testid ? `[data-testid="${esc(el.dataset.testid)}"]` : tag
  const aria = el.getAttribute('aria-label') ? `${tag}[aria-label="${esc(el.getAttribute('aria-label') ?? '')}"]` : tag
  const css = el.id ? `#${CSS.escape(el.id)}` : tag
  return { testid, aria, css }
}

export function labelFor(el: HTMLElement): string {
  return el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 40) ?? el.tagName.toLowerCase()
}

export const selectorOf = (s: Step, strategy: Strategy) => s.targets?.[strategy] ?? ''

/** querySelector that treats a malformed selector as "not found" instead of throwing. */
export function find(root: ParentNode, selector: string): HTMLElement | null {
  if (!selector) return null
  try { return root.querySelector<HTMLElement>(selector) } catch { return null }
}

/**
 * Sets a value the way a real keystroke would, so React's onChange fires:
 * call the prototype's native setter, then dispatch a bubbling event.
 */
export function setNativeValue(el: HTMLElement, value: string, eventName: 'input' | 'change') {
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : el instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (!setter) throw new Error('This element does not accept a value.')
  setter.call(el, value)
  el.dispatchEvent(new Event(eventName, { bubbles: true }))
}

/** A ready-made recording, so the demo is useful before anyone records. */
export function sampleSteps(): Step[] {
  const t = (name: string, tag: string, aria: string, css: string): Targets => ({
    testid: `[data-testid="${name}"]`,
    aria: `${tag}[aria-label="${aria}"]`,
    css: `#lst-a1-${css}`,
  })
  return [
    { id: stepId(), kind: 'type', label: 'Title', value: 'Steel road bike, 54 cm frame', targets: t('listing-title', 'input', 'Title', 'title') },
    { id: stepId(), kind: 'type', label: 'Price', value: '240', targets: t('listing-price', 'input', 'Price', 'price') },
    { id: stepId(), kind: 'select', label: 'Category', value: 'sports', targets: t('listing-category', 'select', 'Category', 'category') },
    { id: stepId(), kind: 'click', label: 'Used, good', targets: t('condition-good', 'button', 'Used, good', 'cond-good') },
    { id: stepId(), kind: 'type', label: 'Description', value: 'Serviced last spring. New tyres. Pickup only.', targets: t('listing-description', 'textarea', 'Description', 'description') },
    { id: stepId(), kind: 'click', label: 'Add photo', targets: t('add-photo', 'button', 'Add photo', 'photo') },
    { id: stepId(), kind: 'click', label: 'Add photo', targets: t('add-photo', 'button', 'Add photo', 'photo') },
    { id: stepId(), kind: 'wait', label: 'Pause', ms: 600 },
    { id: stepId(), kind: 'click', label: 'Publish', targets: t('publish', 'button', 'Publish', 'publish') },
  ]
}

const isPublish = (s: Step) => s.kind === 'click' && s.targets?.testid === '[data-testid="publish"]'

/** Waits for the confirmation right after the Publish click, so later steps (e.g. "Create another") cannot hide it. */
const PUBLISH_CONFIRM = [
  ``,
  `  // Confirm the listing went live.`,
  `  await page.waitForSelector('[data-testid="listing-published"]')`,
  `  console.log('Listing published')`,
].join('\n')

/**
 * Checks a step restored from storage (older schema, hand edits), so a bad entry is dropped
 * instead of crashing the render.
 */
export function isStep(v: unknown): v is Step {
  if (!v || typeof v !== 'object') return false
  const s = v as Step
  const t = s.targets
  return typeof s.id === 'string' && typeof s.label === 'string' &&
    ['click', 'type', 'select', 'wait'].includes(s.kind) &&
    (s.value === undefined || typeof s.value === 'string') &&
    (s.ms === undefined || Number.isFinite(s.ms)) &&
    (t === undefined || (typeof t === 'object' && t !== null && typeof t.testid === 'string' && typeof t.aria === 'string' && typeof t.css === 'string'))
}

export const toSteps = (v: unknown): Step[] => (Array.isArray(v) ? v.filter(isStep) : [])
export const toStrategy = (v: unknown): Strategy => STRATEGIES.find((s) => s.value === v)?.value ?? 'testid'

/** A Puppeteer (v22+) script equivalent to the recording, using the Locator API. */
export function toPuppeteer(steps: Step[], strategy: Strategy): string {
  const q = (v: string) => JSON.stringify(v)
  const body = steps.map((s) => {
    const sel = q(selectorOf(s, strategy))
    switch (s.kind) {
      case 'type': return `  // ${s.label}\n  await page.locator(${sel}).fill(${q(s.value ?? '')})`
      case 'select': return `  // ${s.label}\n  await page.select(${sel}, ${q(s.value ?? '')})`
      case 'click': return `  // ${s.label}\n  await page.locator(${sel}).click()` + (isPublish(s) ? PUBLISH_CONFIRM : '')
      case 'wait': return `  await sleep(${Math.round(s.ms ?? 500)})`
      default: return ''
    }
  })
  return [
    `// Generated by the automation-recorder demo (selector strategy: ${strategy}).`,
    `// Run: npm i puppeteer && node create-listing.mjs`,
    `import puppeteer from 'puppeteer'`,
    ``,
    `const sleep = (ms) => new Promise((r) => setTimeout(r, ms))`,
    ``,
    `const browser = await puppeteer.launch({ headless: false, slowMo: 40 })`,
    `try {`,
    `  const page = await browser.newPage()`,
    `  page.setDefaultTimeout(10_000)`,
    `  await page.goto(${q(SANDBOX_URL)}, { waitUntil: 'networkidle2' })`,
    ``,
    ...body,
    `} finally {`,
    `  await browser.close()`,
    `}`,
    ``,
  ].join('\n')
}
