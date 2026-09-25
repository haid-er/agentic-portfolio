import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'A pure, seeded state machine stands in for the Stripe API. Onboarding creates an Express connected account, the creator sets a recurring price, and the fan subscribes through a destination charge with application_fee_percent, so the platform keeps its fee, pays card processing, and the rest is transferred to the creator. Every call emits the events Stripe would send, and a delivery scheduler plays them to your endpoint: failed attempts retry on an exponential backoff, some events arrive twice, and arrival order can shuffle. The handler records processed event ids (dedupe) and ignores status updates older than the last one it applied, so its ledger matches Stripe no matter how messy delivery gets. Turn dedupe off to watch it drift.',
  limits: [
    'Fully simulated: no Stripe account, no keys and no network calls. Object ids are random look-alikes.',
    'The retry schedule is compressed to minutes. Stripe really retries for up to three days in live mode.',
    'Card processing uses an illustrative 2.9% + $0.30 rate; real pricing varies by country and card.',
    'Signature verification (Stripe-Signature) is not simulated, because there is no secret to sign with.',
  ],
  stack: ['React 19', 'TypeScript reducer (pure, seeded)', 'Stripe Connect data model', 'localStorage for settings'],
}
