import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Your prompt is split into token-like pieces in the browser with a GPT-style pre-tokenizer and costed with BPE rules of thumb, so the estimate works offline; an optional live check sends it once through the site AI gateway and reads the provider’s real input-token count. The workload (static prefix, variable input, output, volume) is priced on every model in a reference price sheet read from the providers’ public pricing pages, then prompt caching (cached-input rates on the static prefix, including cache-write premiums) and the batch tier are applied to show what each lever saves. The router section runs ten sample requests from an emissions-data pipeline through ordered first-match rules (keywords, prompt length, default) and compares the bill with sending everything to one model.',
  limits: [
    'Token counts are estimates: every provider and model generation has its own tokenizer. Use the live check or the provider’s count endpoint for exact numbers.',
    'Prices are list rates read on the date shown; they change often, so every cell is editable (edits stay in this browser).',
    'Long-context surcharges, cache storage fees, peak-hour pricing and minimum cacheable prefix sizes vary by provider and are only flagged, not modelled.',
    'The router compares cost only; whether a cheaper model is good enough needs an evaluation on your own traffic.',
  ],
  stack: ['React 19', 'TypeScript', 'Unicode-aware pre-tokenizer regex', 'AI gateway (live token count)', 'CSS bars, no chart library'],
}
