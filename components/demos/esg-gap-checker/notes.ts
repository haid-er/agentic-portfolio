import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Paste or upload a sustainability-report excerpt (PDF text is read in your browser with pdf.js). A keyword screen grades 17 climate disclosure requirements instantly and offline. The AI pass then sends the excerpt to the site gateway in three pillar batches, each answered as Zod-validated structured output: a status, a verbatim evidence quote and a next step per requirement. Every quote is checked against your text, and the results are mapped onto ISSB (IFRS S2), TCFD and CSRD (ESRS) in one matrix you can export as JSON or Markdown.',
  limits: [
    'Samples are fictional excerpts.',
    'Covers climate disclosures only (IFRS S2, TCFD, ESRS E1 and related ESRS 2 items); not full ESRS or GRI.',
    'Framework references are section-level pointers, not legal citations. This is a screening aid, not assurance.',
    `Excerpts are capped at 9,000 characters; scanned PDFs without a text layer cannot be read.`,
  ],
  stack: ['React 19', 'TypeScript', 'Zod structured output', 'AI gateway (Groq / Gemini)', 'pdf.js'],
}
