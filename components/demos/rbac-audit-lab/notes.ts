import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Each role is a list of CASL-style rules: can or cannot, an action, a subject and optional conditions such as orgId = {{user.orgId}}. A check reads the rules from last to first and the first one whose action, subject and conditions match decides; if nothing matches the answer is deny, and "manage" / "all" are wildcards, just as in @casl/ability. Transactions run every step against the data as it is at that moment and write an audit row with each change. If a step is denied or the injected database error fires, the transaction rolls back together with its audit rows, and a separate row written outside the transaction records the attempt. Reverting a committed transaction runs a compensating transaction, so the log stays append-only.',
  limits: [
    'A small CASL-compatible evaluator written for this demo, not the @casl/ability package; it supports eq, ne and in conditions but not field-level rules.',
    'Transactions and the audit log are simulated in memory in your browser; the database error is injected, not real.',
    'Users, organisations, reports and emission values are sample data.',
    'Your edited rules are saved in this browser only (localStorage); data and the log reset on reload.',
  ],
  stack: ['TypeScript', 'CASL rule semantics', 'Zod (rule validation)', 'React 19'],
}
