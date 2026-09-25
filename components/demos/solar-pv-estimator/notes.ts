import type { DemoNotes } from '@/lib/demos/types'

export const notes: DemoNotes = {
  howItWorks:
    'Pick a site on the map, search a place (Open-Meteo geocoding), use your location or type coordinates. The browser asks this site’s /api/demos/pvgis route, which validates the input, calls the EU JRC PVGIS model from the server (PVGIS has no CORS) and caches the answer at the edge for a day. It always asks for 1 kWp at 0% loss: PVGIS output scales linearly with array size and system losses, so the panel sliders rescale instantly and only location or orientation changes cost a request. CO₂ avoided is yearly output times the grid factor you choose, including the live GB reading from carbonintensity.org.uk.',
  limits: [
    'PVGIS gives a long-term average for an unshaded, fixed array. It does not know your roof, local shading or panel degradation.',
    'CO₂ avoided assumes every kWh displaces grid electricity at one constant factor; real grids decarbonise and marginal factors differ.',
    'The UK annual factor is a rounded DESNZ-style value; use your own country’s factor for sites elsewhere.',
    'PVGIS cannot model points over the sea, and its coverage thins towards the poles (this demo accepts latitudes -65 to 72).',
    'Map tiles © OpenStreetMap contributors. Results you have seen are kept in your browser so revisited sites work offline.',
  ],
  stack: ['Next.js route handler (proxy + edge cache)', 'Zod', 'PVGIS 5.3 (EU JRC)', 'Open-Meteo geocoding', 'Web Mercator tile maths', 'carbonintensity.org.uk'],
}
