import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Each activity line is a quantity (kWh, litres, passenger-km, tonnes) multiplied by an emission factor, then by an inclusion share set by the organisational boundary. Operational and financial control take an entity at 100% or 0% (joint financial control takes the equity share); equity share always takes the ownership percentage. Scope 2 can be reported location-based or market-based, and electricity lines automatically derive their Scope 3 Category 3 transmission and distribution losses. The panel on the right recalculates the same inventory under all three boundaries, and the CSV export carries every line with its factor, source and inclusion share.',
  limits: [
    'Emission factors are rounded, illustrative values in the style of the UK DESNZ conversion factors (refrigerants use IPCC AR4 GWP100). Check the current year’s published set before reporting; every factor is editable.',
    'The sample group and its activity data are fictional.',
    'Market-based Scope 2 uses the grid factor for the uncovered share instead of a published residual mix.',
    'Covers a subset of Scope 3 (categories 3, 5, 6 and 7). It is a teaching calculator, not an assured inventory.',
    'Everything runs and is stored in your browser; nothing is uploaded.',
  ],
  stack: ['React 19', 'TypeScript', 'Zod (persisted state validation)', 'CSS-drawn stacked bars', 'CSV via Blob'],
}
