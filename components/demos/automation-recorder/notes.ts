import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Press Record and use the mock marketplace form: the recorder listens to trusted DOM events (input, change, click) on the sandbox and turns them into steps, merging keystrokes in one field into a single "type" step. Every step keeps three selectors for its element (data-testid, aria-label and the hashed CSS id). Replay starts from a fresh page, resolves each selector with querySelector, polls briefly like waitForSelector, moves a ghost cursor to the element and drives it with real DOM events, so the form reacts exactly as it does to a person. Ship a site update to see why brittle selectors break a bot, then export the same steps as a Puppeteer script that uses the Locator API.',
  limits: [
    'The marketplace is a mock form inside this page, not a real site; nothing is posted anywhere and no account is involved.',
    'Replay runs in your browser against this page only. The exported script targets a placeholder URL (marketplace.example), so point it at a site you are allowed to automate.',
    'Only clicks, typing, dropdown choices and waits are recorded; drag, file uploads and navigation are out of scope.',
  ],
  stack: ['TypeScript', 'React 19', 'DOM events (native value setter + dispatchEvent)', 'querySelector selector strategies', 'Puppeteer Locator API (exported script)'],
}
