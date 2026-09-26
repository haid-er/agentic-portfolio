import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'The lab reads both worlds\' live colour tokens (the shipped defaults plus any admin overrides) from hidden elements that carry each world\'s data-theme attribute. Your edits are applied inline to a real subtree of the site, built from the same buttons, badges and cards the pages use, so the preview is the design system itself rather than a picture of it. Every pair the site depends on is checked with the WCAG 2.x relative-luminance formula: 4.5:1 for text and 3:1 for borders and chart inks. A failing pair can be fixed in one tap by nudging only the foreground\'s HSL lightness, by the smallest step that passes. The hue shift rotates the whole palette, the vision filter simulates colour-vision deficiencies with feColorMatrix, and the result copies out as scoped CSS or as the tokens object content/theme.json stores.',
  limits: [
    'Colour tokens only. Type, radii and spacing are edited in the admin theme editor.',
    'Colour-vision simulation uses the Machado et al. (2009) matrices at full severity: a good guide, not a clinical test.',
    '"Try it on this page" changes this tab only. Nothing is published until an admin saves the tokens in the theme editor, which runs the same contrast checks.',
    'Edits and the admin draft are kept in this browser only.',
  ],
  stack: ['TypeScript', 'CSS custom properties', 'Tailwind CSS v4', 'WCAG 2.x contrast maths', 'SVG feColorMatrix', 'React 19'],
}
