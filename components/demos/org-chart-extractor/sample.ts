/** Fictional sample organisation (made-up names). The demo prints it as a chart image for the vision model. */
import type { Person } from './model'

export const SAMPLE_ORG: Person[] = [
  { id: 'p1', name: 'Priya Natarajan', title: 'Chief Executive Officer', department: 'Executive', managerId: null },
  { id: 'p2', name: 'Tom Okafor', title: 'Chief Operating Officer', department: 'Operations', managerId: 'p1' },
  { id: 'p3', name: 'Lena Fischer', title: 'Head of Asset Management', department: 'Operations', managerId: 'p2' },
  { id: 'p4', name: 'Sam Reyes', title: 'Asset Analyst', department: 'Operations', managerId: 'p3' },
  { id: 'p5', name: 'Omar Haddad', title: 'Site Operations Lead', department: 'Operations', managerId: 'p2' },
  { id: 'p6', name: 'Grace Liu', title: 'Chief Financial Officer', department: 'Finance', managerId: 'p1' },
  { id: 'p7', name: 'Daniel Mensah', title: 'Financial Controller', department: 'Finance', managerId: 'p6' },
  { id: 'p8', name: 'Aisha Karim', title: 'Head of Sustainability', department: 'Sustainability', managerId: 'p1' },
  { id: 'p9', name: 'Jonas Berg', title: 'GHG Reporting Analyst', department: 'Sustainability', managerId: 'p8' },
  { id: 'p10', name: 'Mei Tanaka', title: 'ESG Data Engineer', department: 'Sustainability', managerId: 'p8' },
]

export const SAMPLE_OUTLINE = `Priya Natarajan — Chief Executive Officer (Executive)
  Tom Okafor — Chief Operating Officer (Operations)
    Lena Fischer — Head of Asset Management
      Sam Reyes — Asset Analyst
    Omar Haddad — Site Operations Lead
  Grace Liu — Chief Financial Officer (Finance)
    Daniel Mensah — Financial Controller
  Aisha Karim — Head of Sustainability (Sustainability)
    Jonas Berg — GHG Reporting Analyst
    Mei Tanaka — ESG Data Engineer`
