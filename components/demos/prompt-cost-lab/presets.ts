/**
 * Workload presets for an emissions-data pipeline (the kind of LLM work where token
 * bills add up): classify invoice lines, extract bill fields, draft report paragraphs.
 * Volumes are example values for the calculator, not measurements.
 */
const SCOPE3 = [
  'Purchased goods and services', 'Capital goods', 'Fuel- and energy-related activities', 'Upstream transportation and distribution',
  'Waste generated in operations', 'Business travel', 'Employee commuting', 'Upstream leased assets',
  'Downstream transportation and distribution', 'Processing of sold products', 'Use of sold products',
  'End-of-life treatment of sold products', 'Downstream leased assets', 'Franchises', 'Investments',
]

const CATEGORY_LIST = [
  'Scope 1: direct emissions from owned or controlled sources (fuel burned on site, company vehicles, refrigerant leaks).',
  'Scope 2: indirect emissions from purchased electricity, steam, heating and cooling.',
  ...SCOPE3.map((c, i) => `Scope 3, category ${i + 1}: ${c}.`),
].join('\n')

const CLASSIFY_SYSTEM = `You classify single invoice lines for a greenhouse-gas inventory that follows the GHG Protocol.
Pick exactly one category from the list below. If the line is not an emissions source (for example, a bank fee), answer "none".
Answer with the category label only, no explanation.

Categories:
${CATEGORY_LIST}`

const EXTRACT_SYSTEM = `You extract structured fields from utility bills and meter statements.
Return only JSON that matches this schema:
{"supplier": string, "site": string | null, "periodStart": "YYYY-MM-DD", "periodEnd": "YYYY-MM-DD", "energyType": "electricity" | "gas" | "heat" | "water", "quantity": number, "unit": "kWh" | "m3" | "MWh", "totalCost": number | null, "currency": string | null}
Rules:
- Copy numbers exactly as printed; never convert units.
- If a field is missing, use null. Never guess a date.
- If the document holds several meters, return the main supply only.

Example input:
"Harbour Gas plc. Account 88213. Site: Unit 4, Dock Road. Period 01/04/2025 to 30/06/2025. Gas used: 18,220 kWh. Amount due: £1,457.60"
Example output:
{"supplier":"Harbour Gas plc","site":"Unit 4, Dock Road","periodStart":"2025-04-01","periodEnd":"2025-06-30","energyType":"gas","quantity":18220,"unit":"kWh","totalCost":1457.6,"currency":"GBP"}

Example input:
"City Water. Statement for meter W-1180, March 2025. Consumption 412 m3."
Example output:
{"supplier":"City Water","site":null,"periodStart":"2025-03-01","periodEnd":"2025-03-31","energyType":"water","quantity":412,"unit":"m3","totalCost":null,"currency":null}`

const DRAFT_SYSTEM = `You draft paragraphs for a company's annual sustainability report.
Style guide:
- Plain English, active voice, short sentences. No marketing language, no superlatives.
- Every number you mention must appear in the data provided. Never estimate or round beyond one decimal place.
- Name the reporting boundary (operational control) and the method (location-based or market-based) whenever Scope 2 figures appear.
- Explain changes year on year with the drivers given in the data; if no driver is given, say the driver is not yet analysed.
- Use tCO2e for emissions. Write "Scope 1", "Scope 2" and "Scope 3" with capitals.
- Close with one sentence on what the company will do next, only if the data includes a plan.

Definitions you may rely on:
${CATEGORY_LIST}

Location-based Scope 2 uses average grid emission factors for where electricity is consumed. Market-based Scope 2 uses the factors attached to contracts the company chose, such as renewable energy certificates or supplier-specific tariffs. Report both when the data provides both.

Example of the expected tone:
"Scope 2 emissions (location-based) fell from 412.0 to 355.4 tCO2e. The main driver was the move of the Leeds office to a building with a heat pump, which replaced gas heating. Market-based emissions were lower still because two sites buy electricity on a renewable tariff. We will extend sub-metering to the remaining sites next year."

Checklist before you answer:
1. Is every number traceable to the data?
2. Is the method named for each Scope 2 figure?
3. Are drivers stated only where the data gives them?
4. Is the paragraph under the requested length?
5. Did you avoid claims about targets, offsets or net zero that the data does not contain?`

export interface Preset {
  id: string
  label: string
  system: string
  user: string
  outputTokens: number
  requestsPerDay: number
  cacheHitRate: number
  batchShare: number
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'classify',
    label: 'Classify invoice lines',
    system: CLASSIFY_SYSTEM,
    user: 'Invoice line: "Diesel for site generators, 1,200 litres, March".',
    outputTokens: 16,
    requestsPerDay: 20000,
    cacheHitRate: 0.9,
    batchShare: 0.8,
  },
  {
    id: 'extract',
    label: 'Extract utility bills',
    system: EXTRACT_SYSTEM,
    user: '"Northern Power Ltd. Customer ref NP-55120. Supply address: 2 Mill Lane. Billing period 1 July 2025 to 30 September 2025. Day units 8,210 kWh, night units 4,240 kWh, total 12,450 kWh. Standing charge 92 days. Total due £2,988.00 including VAT."',
    outputTokens: 140,
    requestsPerDay: 3000,
    cacheHitRate: 0.8,
    batchShare: 0.5,
  },
  {
    id: 'draft',
    label: 'Draft report paragraphs',
    system: DRAFT_SYSTEM,
    user: 'Write a paragraph of at most 120 words on Scope 1 emissions. Data: Scope 1 2024: 1,204.5 tCO2e. Scope 1 2025: 1,090.2 tCO2e. Drivers: fleet of 14 vans replaced by electric vans in May 2025; refrigerant leak at Site B (2.5 kg R-410A). Plan: none provided.',
    outputTokens: 260,
    requestsPerDay: 200,
    cacheHitRate: 0.6,
    batchShare: 0,
  },
]
