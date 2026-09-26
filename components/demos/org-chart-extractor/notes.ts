import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Upload an org-chart image or PDF (page 1 is rendered in your browser with pdf.js), or use the printed sample chart. The image is downscaled on your device and sent once to a vision model through the site AI gateway, which must answer with a Zod-validated flat list of people and manager ids. The page repairs dangling links and cycles, then draws an editable chart, a collapsible tree and a table; every edit updates all three, and you can export nested JSON. The sample run is scored against its answer key, and an indented outline builds the same tree fully offline.',
  limits: [
    'The sample organisation and names are fictional.',
    'Vision models can misread small or rotated text and crossing lines; check the tree before exporting.',
    'One page per PDF and up to 20 people per extraction (the free-tier output cap); crop large charts into sections.',
    'Nothing is stored: edits live in this tab until you export.',
  ],
  stack: ['React 19', 'TypeScript', 'Zod structured output', 'AI gateway vision (Groq / Gemini)', 'pdf.js', 'SVG'],
}
