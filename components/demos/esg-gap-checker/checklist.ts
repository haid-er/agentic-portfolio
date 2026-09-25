/**
 * Disclosure checklist: climate requirements shared (or not) by ISSB (IFRS S2), TCFD and CSRD (ESRS).
 * References are section-level pointers for orientation, not legal citations.
 * `topic` finds the subject; `depth` finds signs of a specific, decision-useful disclosure.
 */

export type Framework = 'issb' | 'tcfd' | 'csrd'
export type Pillar = 'Governance' | 'Strategy' | 'Risk management' | 'Metrics & targets' | 'Materiality'

export const FRAMEWORKS: Array<{ id: Framework; label: string; full: string }> = [
  { id: 'issb', label: 'ISSB', full: 'IFRS S2 Climate-related Disclosures' },
  { id: 'tcfd', label: 'TCFD', full: 'TCFD recommended disclosures' },
  { id: 'csrd', label: 'CSRD', full: 'CSRD / ESRS E1 and ESRS 2' },
]

export interface Requirement {
  id: string
  pillar: Pillar
  title: string
  /** What a complete disclosure contains (fed to the model and shown on the card). */
  expects: string
  refs: Partial<Record<Framework, string>>
  topic: RegExp[]
  depth: RegExp[]
}

export const CHECKLIST: Requirement[] = [
  {
    id: 'gov-board', pillar: 'Governance', title: 'Board oversight of climate issues',
    expects: 'Which board body oversees climate risks and opportunities, how often it is informed, and how it uses climate in decisions.',
    refs: { issb: 'IFRS S2 Governance', tcfd: 'Governance (a)', csrd: 'ESRS 2 GOV-1' },
    topic: [/\bboard\b/i, /\bdirectors?\b/i, /\bcommittee\b/i],
    depth: [/\b(quarterly|annually|twice a year|each meeting|every meeting|biannual)/i, /\b(oversee|oversight|chair(ed)?|approves?)\b/i, /\b(sustainability|climate|esg|risk) committee\b/i],
  },
  {
    id: 'gov-mgmt', pillar: 'Governance', title: "Management's role",
    expects: 'Which executives or committees own climate risk, their responsibilities, reporting lines and controls.',
    refs: { issb: 'IFRS S2 Governance', tcfd: 'Governance (b)', csrd: 'ESRS 2 GOV-1, GOV-2' },
    topic: [/\b(management|executive|leadership) (team|committee|board)\b/i, /\bchief (executive|financial|sustainability|risk|operating) officer\b/i, /\b(CEO|CFO|CSO|CRO|COO)\b/, /\bhead of sustainability\b/i],
    depth: [/\breports? (to|into)\b/i, /\bresponsib(le|ility) for\b/i, /\b(monthly|quarterly)\b/i, /\bcontrols?\b/i],
  },
  {
    id: 'gov-pay', pillar: 'Governance', title: 'Climate-linked remuneration',
    expects: 'Whether and how climate performance feeds executive pay, with the share of variable pay affected.',
    refs: { issb: 'IFRS S2 Metrics (remuneration)', csrd: 'ESRS 2 GOV-3' },
    topic: [/\b(remuneration|incentive|bonus|variable pay|LTIP|compensation)\b/i],
    depth: [/\d+\s?%/, /\b(weighting|weighted|linked to|tied to)\b/i, /\b(emissions|carbon|climate|net zero)\b/i],
  },
  {
    id: 'str-risks', pillar: 'Strategy', title: 'Climate risks and opportunities by time horizon',
    expects: 'Specific physical and transition risks and opportunities, over defined short, medium and long-term horizons.',
    refs: { issb: 'IFRS S2 Strategy', tcfd: 'Strategy (a)', csrd: 'ESRS E1 IRO-1, ESRS 2 SBM-3' },
    topic: [/\b(physical|transition) risks?\b/i, /\bclimate[- ]related (risks?|opportunit)/i, /\bopportunit(y|ies)\b/i],
    depth: [/\b(short|medium|long)[- ]term\b/i, /\b(20[2-9]\d)\b/, /\b(flood|heat|drought|storm|carbon pric|regulat|policy|technology|market)\w*/i],
  },
  {
    id: 'str-model', pillar: 'Strategy', title: 'Effects on business model and strategy',
    expects: 'How climate risks and opportunities change the business model, value chain, strategy and financial planning.',
    refs: { issb: 'IFRS S2 Strategy', tcfd: 'Strategy (b)', csrd: 'ESRS 2 SBM-3' },
    topic: [/\bbusiness model\b/i, /\bvalue chain\b/i, /\bstrateg(y|ic)\b/i, /\bfinancial planning\b/i],
    depth: [/\b(capex|capital expenditure|investment|allocat)\w*/i, /\b(product|service|portfolio|supply chain)s?\b/i, /\bsuppliers?\b/i],
  },
  {
    id: 'str-scenario', pillar: 'Strategy', title: 'Scenario analysis and resilience',
    expects: 'Climate scenarios used (including a 1.5°C-aligned one), horizons, key assumptions and conclusions on resilience.',
    refs: { issb: 'IFRS S2 Strategy (resilience)', tcfd: 'Strategy (c)', csrd: 'ESRS E1 IRO-1 (scenarios)' },
    topic: [/\bscenarios?\b/i, /\bresilien(ce|t)\b/i, /\bstress[- ]test/i],
    depth: [/1\.5\s?°?\s?C|2\s?°\s?C|well below 2/i, /\b(NGFS|IEA|IPCC|RCP|SSP|NZE)\b/, /\bassumptions?\b/i],
  },
  {
    id: 'str-transition', pillar: 'Strategy', title: 'Transition plan',
    expects: 'A transition plan with decarbonisation levers, milestones, funding (CapEx/OpEx) and dependencies.',
    refs: { issb: 'IFRS S2 Strategy (transition plan)', csrd: 'ESRS E1-1' },
    topic: [/\btransition plan\b/i, /\bnet[- ]zero\b/i, /\bdecarboni[sz]/i],
    depth: [/\b(capex|opex|capital expenditure)\b/i, /\bmilestones?\b/i, /\b(lever|electrif|renewable|efficien|fleet|heat pump)\w*/i, /\b20[3-5]0\b/],
  },
  {
    id: 'str-financial', pillar: 'Strategy', title: 'Financial effects',
    expects: 'Current and anticipated effects of climate risks on financial position, performance and cash flows, quantified where possible.',
    refs: { issb: 'IFRS S2 Strategy (financial effects)', csrd: 'ESRS E1-9' },
    topic: [/\bfinancial (effects?|impacts?|position|performance)\b/i, /\b(impairment|assets at risk|revenue at risk|cash flows?)\b/i],
    depth: [/[£$€]\s?\d/, /\b\d+(\.\d+)?\s?(m|bn|million|billion)\b/i, /\b(quantif|estimated)\w*/i],
  },
  {
    id: 'rm-process', pillar: 'Risk management', title: 'Risk identification and assessment process',
    expects: 'How climate risks are identified, assessed, prioritised and monitored, including inputs and parameters.',
    refs: { issb: 'IFRS S2 Risk management', tcfd: 'Risk management (a), (b)', csrd: 'ESRS E1 IRO-1' },
    topic: [/\brisk (register|assessment|identification|management process)\b/i, /\b(identif|assess|prioriti[sz])\w* (climate|risks?)/i],
    depth: [/\b(likelihood|impact|severity|magnitude|threshold|heat ?map)\b/i, /\b(annual|annually|quarterly)\b/i, /\bprioriti[sz]/i],
  },
  {
    id: 'rm-erm', pillar: 'Risk management', title: 'Integration into enterprise risk management',
    expects: 'How climate risk processes are integrated into the overall (enterprise) risk management system.',
    refs: { issb: 'IFRS S2 Risk management', tcfd: 'Risk management (c)', csrd: 'ESRS 2 IRO-1' },
    topic: [/\b(enterprise|group|overall|principal) risk\b/i, /\bERM\b/, /\bintegrat\w* (into|with)\b/i],
    depth: [/\bprincipal risks?\b/i, /\brisk appetite\b/i, /\b(three lines|internal audit)\b/i],
  },
  {
    id: 'mt-s12', pillar: 'Metrics & targets', title: 'Scope 1 and 2 emissions',
    expects: 'Gross Scope 1 and Scope 2 (location- and market-based) emissions in tCO2e, with prior-year comparison.',
    refs: { issb: 'IFRS S2 Metrics (GHG)', tcfd: 'Metrics & targets (b)', csrd: 'ESRS E1-6' },
    topic: [/\bscope\s?1\b/i, /\bscope\s?2\b/i],
    depth: [/\d[\d,.]*\s?(k?t|tonnes?)\s?CO2e?/i, /\b(location|market)[- ]based\b/i, /\b(prior|previous) year|20\d\d\b/i],
  },
  {
    id: 'mt-s3', pillar: 'Metrics & targets', title: 'Scope 3 emissions',
    expects: 'Scope 3 emissions by relevant category, with data sources and estimation approach.',
    refs: { issb: 'IFRS S2 Metrics (GHG)', tcfd: 'Metrics & targets (b)', csrd: 'ESRS E1-6' },
    topic: [/\bscope\s?3\b/i, /\bvalue[- ]chain emissions\b/i],
    depth: [/\bcategor(y|ies)\b/i, /\d[\d,.]*\s?(k?t|tonnes?)\s?CO2e?/i, /\b(purchased goods|business travel|use of sold|upstream|downstream|commuting)\b/i],
  },
  {
    id: 'mt-method', pillar: 'Metrics & targets', title: 'GHG methodology and boundary',
    expects: 'Measurement standard (GHG Protocol), consolidation approach (equity share, financial or operational control), emission factors and boundary.',
    refs: { issb: 'IFRS S2 Metrics (GHG Protocol)', csrd: 'ESRS E1-6' },
    topic: [/\bGHG Protocol\b/i, /\b(operational|financial) control\b/i, /\bequity share\b/i, /\bemission factors?\b/i, /\bboundary\b/i],
    depth: [/\b(operational|financial) control|equity share\b/i, /\b(DEFRA|DESNZ|IEA|EPA|ecoinvent)\b/i, /\bconsolidat\w*/i],
  },
  {
    id: 'mt-targets', pillar: 'Metrics & targets', title: 'Targets and progress',
    expects: 'Climate targets with base year, target year, scope coverage, validation (e.g. SBTi) and progress against them.',
    refs: { issb: 'IFRS S2 Targets', tcfd: 'Metrics & targets (c)', csrd: 'ESRS E1-4' },
    topic: [/\btargets?\b/i, /\bnet[- ]zero by\b/i, /\breduc\w+ .{0,40}by 20\d\d/i],
    depth: [/\bbase(line)?[- ]year\b/i, /\b(SBTi|science[- ]based)\b/i, /\d+\s?%/, /\bprogress\b/i],
  },
  {
    id: 'mt-energy', pillar: 'Metrics & targets', title: 'Energy consumption and mix',
    expects: 'Total energy consumption (MWh) split by fossil, nuclear and renewable sources.',
    refs: { tcfd: 'Metrics & targets (a)', csrd: 'ESRS E1-5' },
    topic: [/\benergy (consumption|use|mix)\b/i, /\b[kMG]Wh\b/],
    depth: [/\d[\d,.]*\s?[kMG]Wh\b/, /\brenewable\b/i, /\b(fossil|nuclear|gas|electricity)\b/i],
  },
  {
    id: 'mt-carbon-price', pillar: 'Metrics & targets', title: 'Internal carbon price',
    expects: 'Whether an internal carbon price is used, the price per tonne, and how it is applied to decisions.',
    refs: { issb: 'IFRS S2 Metrics (carbon prices)', csrd: 'ESRS E1-8' },
    topic: [/\b(internal|shadow) (carbon )?pric/i, /\bcarbon pric/i],
    depth: [/[£$€]\s?\d+/, /\bper tonne\b/i, /\b(investment|capex) decisions?\b/i],
  },
  {
    id: 'mat-double', pillar: 'Materiality', title: 'Double materiality assessment',
    expects: 'Process and results of the double materiality assessment: impact and financial materiality, stakeholders, thresholds.',
    refs: { csrd: 'ESRS 1, ESRS 2 IRO-1' },
    topic: [/\bdouble materiality\b/i, /\bmateriality assessment\b/i, /\bimpact materiality\b/i],
    depth: [/\bfinancial materiality\b/i, /\bstakeholders?\b/i, /\bthresholds?\b/i],
  },
]

export const PILLARS: Pillar[] = ['Governance', 'Strategy', 'Risk management', 'Metrics & targets', 'Materiality']

export function applicable(r: Requirement, fw: Framework[]): boolean {
  return fw.some((f) => r.refs[f])
}
