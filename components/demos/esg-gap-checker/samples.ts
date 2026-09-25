/** Fictional report excerpts (made-up companies and figures) to try the checker without a file. */
export interface Sample { id: string; label: string; text: string }

export const SAMPLES: Sample[] = [
  {
    id: 'harbourline',
    label: 'Harbourline Logistics (fairly mature)',
    text: `Governance. The Board has overall responsibility for climate-related risks and opportunities. The Sustainability Committee, chaired by an independent non-executive director, oversees our climate strategy and reviews progress quarterly. The Chief Financial Officer is responsible for climate risk management and reports to the Board twice a year. 15% of the annual bonus for executive directors is linked to reductions in fleet emissions.

Strategy. We have identified physical risks, such as flooding at two coastal depots, and transition risks, including rising carbon prices and low-emission zone regulation, over short-term (to 2027), medium-term (to 2035) and long-term (to 2050) horizons. Electrification of our last-mile fleet is also an opportunity to win contracts with customers setting supplier requirements. In 2024 we ran a qualitative scenario analysis using a 1.5°C scenario and a 3°C current-policies scenario; we concluded our strategy is resilient, although depot flood exposure increases under 3°C.

Risk management. Climate risks are identified through our annual risk assessment and scored on likelihood and impact. Climate change is recorded as a principal risk in the group risk register.

Metrics and targets. Scope 1 emissions were 48,200 tCO2e and Scope 2 (market-based) emissions were 3,900 tCO2e in 2024, down from 51,700 tCO2e and 4,400 tCO2e in 2023. We report in line with the GHG Protocol using the operational control approach. We are screening our Scope 3 emissions and expect to report them next year. We have committed to reduce absolute Scope 1 and 2 emissions by 42% by 2030 from a 2021 base year and to reach net zero by 2050.`,
  },
  {
    id: 'meridian',
    label: 'Meridian Homes (early stage)',
    text: `At Meridian Homes, sustainability is at the heart of everything we do. We are proud of our commitment to building a greener future for our customers and communities. Climate change is one of the defining challenges of our time, and our leadership team takes it very seriously.

This year we switched our head office to a renewable electricity tariff and installed LED lighting across our sales centres. Our energy use fell compared with last year. We are exploring opportunities to use lower-carbon materials, such as timber frame construction, in future developments.

We intend to set a net zero target in due course and will continue to engage with our suppliers on their environmental performance. We recognise that extreme weather may affect our construction sites. We will keep our approach to climate under review.`,
  },
]
