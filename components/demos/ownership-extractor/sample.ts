/** Fictional sample groups (made-up companies and figures, for illustration only). */
export interface Sample { id: string; label: string; text: string }

export const SAMPLES: Sample[] = [
  {
    id: 'aster',
    label: 'Aster Holdings (energy group)',
    text: `Aster Holdings plc is the reporting entity.
Aster Holdings plc owns 100% of Aster Energy Ltd.
Aster Energy Ltd owns 70% of Brightwater Solar GmbH.
Brightwater Solar GmbH owns 60% of Brightwater O&M Ltd.
Aster Holdings plc and Kestrel Power SA each own 50% of Northgate Wind JV.
Aster Holdings plc and Kestrel Power SA share joint control of Northgate Wind JV.
Kestrel Power SA operates Northgate Wind JV.
Aster Holdings plc holds a 30% stake in Harbour Grid Services Ltd.
Aster Holdings plc has no control over Harbour Grid Services Ltd.
Aster Energy Ltd holds a 40% stake in Coastline Storage BV and has operational control of Coastline Storage BV under a management agreement.
Scope 1 and 2 emissions: Aster Holdings plc 1,200 tCO2e; Aster Energy Ltd 18,500 tCO2e; Brightwater Solar GmbH 4,300 tCO2e; Brightwater O&M Ltd 900 tCO2e; Northgate Wind JV 6,000 tCO2e; Harbour Grid Services Ltd 22,000 tCO2e; Coastline Storage BV 3,100 tCO2e; Kestrel Power SA 51,000 tCO2e.`,
  },
  {
    id: 'lumen',
    label: 'Lumen Estates (property group)',
    text: `Lumen Estates plc is the parent company.
Lumen Offices Ltd is a wholly owned subsidiary of Lumen Estates plc.
Lumen Retail Ltd is 80% owned by Lumen Estates plc.
Lumen Offices Ltd owns 55% of Canal Wharf Ltd.
Lumen Offices Ltd has no control over Canal Wharf Ltd.
Lumen Retail Ltd holds a 25% stake in Riverside Mall LLP.
Riverside Mall LLP is operated by Lumen Retail Ltd.
Lumen Estates plc owns 45% of Parkside Living Ltd and has financial control of Parkside Living Ltd.
Lumen Estates plc 450 tCO2e. Lumen Offices Ltd 2,800 tCO2e. Lumen Retail Ltd 3,900 tCO2e. Canal Wharf Ltd 1,600 tCO2e. Riverside Mall LLP 5,200 tCO2e. Parkside Living Ltd 2,100 tCO2e.`,
  },
]

/** Free-form prose the rule reader cannot follow: shows why the AI path exists. */
export const PROSE_SAMPLE = `Founded in 1998, Veld Foods is now a group of four companies. The Dutch parent, Veld Foods NV, bought three quarters of the Polish bakery Piekarnia Wisła in 2021 and runs its plants day to day. Its dairy arm, Veld Dairy BV, is fully held and in turn has a minority position (about a third) in the Belgian cheese maker Fromagerie Ardenne, where it has board seats but no say over operations. Veld Foods NV also shares a 50/50 logistics venture, ColdChain Partners, with a freight firm, with decisions taken jointly. Last year the bakery reported roughly 7,400 tonnes of CO2e, the dairy arm 12,900, the cheese maker 8,100, ColdChain Partners 3,300 and the parent's own offices 300.`
