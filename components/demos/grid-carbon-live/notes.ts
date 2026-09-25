import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'The browser reads the free carbonintensity.org.uk API (NESO with the University of Oxford) directly: the half-hourly 48-hour forecast with measured values where they exist, and the current generation mix, nationally or for the DNO region behind a postcode area. Every reply is validated with Zod before it is drawn. The heat-pump hint slides a window of the chosen length across the forecast and picks the lowest average intensity, then compares it with starting now for the energy you enter. Data refreshes every 30 minutes while the tab is visible, and the last good snapshot is kept locally so the page still works offline, clearly marked with its timestamp.',
  limits: [
    'Covers Great Britain only (Northern Ireland is a separate grid). Forecasts are the feed’s own and can be revised.',
    'Intensity is average (not marginal) emissions per kWh consumed, so the saving is indicative of shifting a small load.',
    'The heat-pump figures assume a constant electrical draw; real units modulate with weather and flow temperature.',
    'Only the outward postcode is sent, and only to carbonintensity.org.uk. Nothing is estimated when the feed is down.',
  ],
  stack: ['React 19', 'TypeScript', 'Zod', 'carbonintensity.org.uk REST API', 'SVG chart drawn at container width', 'localStorage offline snapshot'],
}
