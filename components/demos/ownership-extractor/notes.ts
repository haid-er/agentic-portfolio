import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Describe a corporate group in plain text. An AI extractor (through the site gateway, validated with Zod) or an offline rule reader turns it into entities and ownership links with equity and control. The page then sets the organisational boundary three ways, following chapter 3 of the GHG Protocol Corporate Standard: equity share multiplies stakes down every chain, financial control takes 100% of controlled entities and the equity share of joint arrangements, and operational control takes 100% of whatever the group operates. Edit any stake or control flag and every total, bar and edge redraws.',
  limits: [
    'Samples are fictional companies and figures.',
    'Where the text does not state control, a majority stake is read as control; the entity note says so.',
    'Scope 1 and 2 only; nothing is estimated when an entity has no emissions figure.',
    'The rule reader understands plain sentences ("A owns 70% of B"); free prose needs the AI path.',
  ],
  stack: ['React 19', 'TypeScript', 'Zod structured output', 'AI gateway (Groq / Gemini)', 'SVG'],
}
