/**
 * Content schema: the single contract between content/*.json, the site and /admin.
 *
 * Rules (CONTRACTS.md "Content"):
 * - Every list item has `id`, `enabled` and an optional `verified` flag.
 *   `enabled: false` items never render on the site; admin shows them with an
 *   "unverified" badge when `verified === false`.
 * - Missing data is an empty string / omitted field and is hidden on the site.
 *   Never invent values to satisfy the schema.
 * - Demo slugs are validated against the registry (lib/demos/registry.ts).
 */
import { z } from 'zod'
import { DEMO_SLUGS } from '@/lib/demos/slugs'
import { THEME_KEYS } from '@/lib/theme/keys'

/* ------------------------------------------------------------------ */
/* primitives                                                          */
/* ------------------------------------------------------------------ */

/** Absolute http(s) URL, mailto:, tel:, site-relative path ("/x") or empty string. */
export const Href = z
  .string()
  .refine((v) => v === '' || /^(https?:\/\/|mailto:|tel:|\/|#)/.test(v), {
    message: 'Must be empty, an http(s)/mailto:/tel: URL, a "/path" or a "#hash"',
  })

/** "YYYY" | "YYYY-MM" | "YYYY-MM-DD" or empty. */
export const PartialDate = z
  .string()
  .refine((v) => v === '' || /^\d{4}(-\d{2}(-\d{2})?)?$/.test(v), { message: 'Use YYYY, YYYY-MM or YYYY-MM-DD' })

/**
 * Array of items whose `key` values must be unique (ids, slugs). Applied to every
 * list collection's `items` and to `site.socials`, so the build and the admin save
 * route reject duplicates as well as the admin form.
 */
function uniqueList<T extends z.ZodTypeAny>(item: T, keys: string[] = ['id']) {
  return z.array(item).superRefine((items, ctx) => {
    for (const key of keys) {
      const seen = new Map<string, number>()
      ;(items as Record<string, unknown>[]).forEach((it, i) => {
        const v = it?.[key]
        if (typeof v !== 'string' || v === '') return
        if (seen.has(v)) {
          ctx.addIssue({ code: 'custom', path: [i, key], message: `Duplicate ${key} "${v}" (also item ${seen.get(v)! + 1})` })
        } else seen.set(v, i)
      })
    }
  })
}

export const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase-kebab-case')

export const DemoSlug = z.enum(DEMO_SLUGS)
export type DemoSlug = z.infer<typeof DemoSlug>

/** Pillars group skills, demos and projects. Labels live in site.profile.pillars. */
export const PILLARS = ['fullstack', 'ai', 'realtime', 'esg', 'fundamentals', 'craft'] as const
export const Pillar = z.enum(PILLARS)
export type Pillar = z.infer<typeof Pillar>

/** Shared by every list item. */
export const ItemBase = z.object({
  id: Slug,
  enabled: z.boolean(),
  /** false = unverified (seeded disabled, badge in admin). Omitted = verified/owner-stated. */
  verified: z.boolean().optional(),
  /** Provenance note for admin only (never rendered on the site). */
  source: z.string().optional(),
})

/* ------------------------------------------------------------------ */
/* site                                                                */
/* ------------------------------------------------------------------ */

export const SECTION_IDS = [
  'hero', 'about', 'experience', 'skills', 'projects', 'playground', 'research', 'education',
  'certifications', 'achievements', 'services', 'testimonials', 'github', 'resume', 'contact',
] as const
export const SectionId = z.enum(SECTION_IDS)
export type SectionId = z.infer<typeof SectionId>

export const Section = z.object({
  id: SectionId,
  enabled: z.boolean(),
  /** Section heading, e.g. "Working record". Empty = component default. */
  title: z.string(),
  /** Short label for nav / contents sheet. Empty = title. */
  navLabel: z.string().optional(),
  /** Optional one-line note under the heading. */
  note: z.string().optional(),
})
export type Section = z.infer<typeof Section>

export const Social = ItemBase.extend({
  label: z.string().min(1),
  url: Href,
  handle: z.string().optional(),
  /** lucide icon name or in-house glyph id (see components/ui/Icon.tsx). */
  icon: z.string().optional(),
})
export type Social = z.infer<typeof Social>

export const Cta = z.object({
  label: z.string().min(1),
  href: Href,
  variant: z.enum(['primary', 'secondary']),
})
export type Cta = z.infer<typeof Cta>

export const PillarInfo = z.object({
  id: Pillar,
  title: z.string().min(1),
  summary: z.string(),
})
export type PillarInfo = z.infer<typeof PillarInfo>

export const Language = z.object({ name: z.string().min(1), level: z.string() })

export const Profile = z.object({
  name: z.string().min(1),
  headline: z.string(),
  tagline: z.string(),
  shortBio: z.string(),
  location: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  avatar: z.string().optional(),
  motto: z.string(),
  pillars: z.array(PillarInfo),
  languages: z.array(Language),
  interests: z.array(z.string()),
})
export type Profile = z.infer<typeof Profile>

export const Hero = z.object({
  /** Mono kicker fragments, joined with "/". */
  kicker: z.array(z.string()),
  /** Role line under the name (display italic). `*word*` renders as <em>. */
  role: z.string(),
  /** Lede paragraph (gets the drop cap). */
  lede: z.string(),
  ctas: z.array(Cta),
  plateTitle: z.string(),
  plateNote: z.string(),
  /** Show the live UK grid-carbon reading under the core plate. */
  showGridReading: z.boolean(),
  /**
   * Ordered core-sample layers, as "collection:id" refs (e.g. "experience:euthyna").
   * Empty or omitted = derived from content.
   */
  plateLayers: z.array(z.string().regex(/^(experience|project|education|research):[a-z0-9-]+$/, 'Use collection:id, e.g. experience:euthyna')).optional(),
})
export type Hero = z.infer<typeof Hero>

export const About = z.object({
  body: z.array(z.string()),
})

export const Contact = z.object({
  blurb: z.string(),
  /** Show the form (needs site.contactFormEndpoint), else mailto only. */
  formEnabled: z.boolean(),
  availability: z.string().optional(),
})

export const Seo = z.object({
  title: z.string().min(1),
  titleTemplate: z.string(),
  description: z.string(),
  keywords: z.array(z.string()),
  siteUrl: z.string(),
  ogImage: z.string().optional(),
  twitterHandle: z.string().optional(),
  /** Person JSON-LD sameAs (disambiguation). */
  sameAs: z.array(z.string()),
})
export type Seo = z.infer<typeof Seo>

export const Analytics = z.object({ enabled: z.boolean() })

export const Site = z.object({
  profile: Profile,
  hero: Hero,
  about: About,
  contact: Contact,
  socials: uniqueList(Social),
  /** Order = render order. Hidden when enabled:false. */
  sections: z.array(Section),
  seo: Seo,
  analytics: Analytics,
  /** Web3Forms / Formspree endpoint. Empty = mailto fallback. */
  contactFormEndpoint: Href,
  /** Footer / masthead furniture. */
  masthead: z.object({
    location: z.string(),
    strapline: z.string(),
    colophon: z.string(),
  }),
  /**
   * Extra "never render" terms (matched at the start of a word, case-insensitive)
   * on top of the fixed contract terms kept in code.
   */
  privacy: z.object({ excluded: z.array(z.string()).default([]) }).optional(),
})
export type Site = z.infer<typeof Site>

/* ------------------------------------------------------------------ */
/* theme (content/theme.json, DESIGN.md 2.4)                           */
/* ------------------------------------------------------------------ */

export { THEME_KEYS }
export const ThemeKey = z.enum(THEME_KEYS)
export type ThemeKey = z.infer<typeof ThemeKey>

export const ThemeDef = z.object({
  label: z.string().min(1),
  reads: z.enum(['light', 'dark']),
  swapLabel: z.string(),
  /** Overrides on top of app/globals.css defaults, keys are CSS custom properties ("--bg"). */
  tokens: z.record(z.string().regex(/^--[a-z0-9-]+$/), z.string()),
})
export type ThemeDef = z.infer<typeof ThemeDef>

export const Theme = z.object({
  default: z.union([z.literal('auto'), ThemeKey]),
  themes: z.object({ almanac: ThemeDef, strata: ThemeDef }),
})
export type Theme = z.infer<typeof Theme>

/* ------------------------------------------------------------------ */
/* skills                                                              */
/* ------------------------------------------------------------------ */

export const Skill = ItemBase.extend({
  name: z.string().min(1),
  pillar: Pillar,
  /**
   * Editorial band (not from any source: docs/context gives no proficiency levels).
   * Optional and never shown on the public site; kept only as an admin sorting aid.
   */
  level: z.enum(['core', 'working', 'exploring']).optional(),
  /**
   * Demos that prove the skill (DESIGN.md 6.3). May be empty: the skill is then
   * listed as "no demo yet" and is never linked or counted as proven.
   */
  demoSlugs: z.array(DemoSlug),
  keywords: z.array(z.string()).optional(),
})
export type Skill = z.infer<typeof Skill>
export const Skills = z.object({ items: uniqueList(Skill) })

/* ------------------------------------------------------------------ */
/* experience                                                          */
/* ------------------------------------------------------------------ */

export const Highlight = z.object({
  text: z.string().min(1),
  proofDemo: DemoSlug.optional(),
})
export type Highlight = z.infer<typeof Highlight>

export const ExperienceItem = ItemBase.extend({
  role: z.string().min(1),
  org: z.string().min(1),
  orgUrl: Href.optional(),
  /** Product / client context, e.g. "Euthyna" or "Kickstart HQ". */
  product: z.string().optional(),
  location: z.string().optional(),
  mode: z.enum(['remote', 'hybrid', 'on-site', '']).optional(),
  start: PartialDate,
  /** Empty string = present. */
  end: PartialDate,
  summary: z.string().optional(),
  highlights: z.array(Highlight),
  stack: z.array(z.string()),
  /** The one allowed metric display (DESIGN.md 6.4): e.g. {from:"27s", to:"3.5s", label:"response time"}. */
  metric: z.object({ from: z.string(), to: z.string(), label: z.string() }).optional(),
})
export type ExperienceItem = z.infer<typeof ExperienceItem>
export const Experience = z.object({ items: uniqueList(ExperienceItem) })

/* ------------------------------------------------------------------ */
/* projects                                                            */
/* ------------------------------------------------------------------ */

export const Project = ItemBase.extend({
  slug: Slug,
  title: z.string().min(1),
  summary: z.string(),
  story: z.array(z.string()),
  role: z.string().optional(),
  pillar: Pillar,
  tags: z.array(z.string()),
  stack: z.array(z.string()),
  start: PartialDate.optional(),
  end: PartialDate.optional(),
  /** Still running: shows "– Present" instead of an end date. */
  ongoing: z.boolean().optional(),
  /** Coursework or practice build: listed under "Learning builds", after the real work. */
  learning: z.boolean().optional(),
  outcome: z.string().optional(),
  links: z.object({ live: Href.optional(), repo: Href.optional() }),
  /** Private repo: the repo link is never rendered and never quoted. */
  private: z.boolean(),
  featured: z.boolean(),
  demoSlugs: z.array(DemoSlug),
  image: z.string().optional(),
})
export type Project = z.infer<typeof Project>
export const Projects = z.object({ items: uniqueList(Project, ['id', 'slug']) })

/* ------------------------------------------------------------------ */
/* research                                                            */
/* ------------------------------------------------------------------ */

export const ResearchResult = z.object({
  label: z.string().min(1),
  value: z.number(),
  unit: z.string(),
  note: z.string().optional(),
})

export const ResearchItem = ItemBase.extend({
  title: z.string().min(1),
  venue: z.string(),
  volume: z.string().optional(),
  article: z.string().optional(),
  year: z.string(),
  doi: z.string().optional(),
  url: Href.optional(),
  /** "2nd of 5 authors" — never co-author names (BRIEF 2). */
  authorPosition: z.number().int().positive().optional(),
  authorCount: z.number().int().positive().optional(),
  abstract: z.string().optional(),
  results: z.array(ResearchResult),
  resultsCaption: z.string().optional(),
  bibtex: z.string().optional(),
  demoSlugs: z.array(DemoSlug),
})
export type ResearchItem = z.infer<typeof ResearchItem>
export const Research = z.object({
  items: uniqueList(ResearchItem),
  /** Neighbouring pipeline (MotionIQ) steps shown next to the paper. */
  pipeline: z.object({
    enabled: z.boolean(),
    title: z.string(),
    note: z.string(),
    steps: z.array(z.string()),
    demoSlug: DemoSlug.optional(),
  }),
})

/* ------------------------------------------------------------------ */
/* education / certifications / achievements                           */
/* ------------------------------------------------------------------ */

export const EducationItem = ItemBase.extend({
  institution: z.string().min(1),
  degree: z.string().min(1),
  field: z.string().optional(),
  location: z.string().optional(),
  start: PartialDate,
  end: PartialDate,
  grade: z.string().optional(),
  notes: z.array(z.string()),
  demoSlugs: z.array(DemoSlug).optional(),
})
export type EducationItem = z.infer<typeof EducationItem>
export const Education = z.object({ items: uniqueList(EducationItem) })

export const Certification = ItemBase.extend({
  name: z.string().min(1),
  issuer: z.string(),
  date: PartialDate,
  url: Href.optional(),
  credentialId: z.string().optional(),
  demoSlugs: z.array(DemoSlug).optional(),
})
export type Certification = z.infer<typeof Certification>
export const Certifications = z.object({ items: uniqueList(Certification) })

export const Achievement = ItemBase.extend({
  title: z.string().min(1),
  detail: z.string().optional(),
  date: PartialDate.optional(),
  url: Href.optional(),
  kind: z.enum(['award', 'competition', 'talk', 'leadership', 'badge', 'other']),
  /** Render as the circular "stamp" (DESIGN.md 6.5). */
  stamp: z.boolean().optional(),
  demoSlugs: z.array(DemoSlug).optional(),
})
export type Achievement = z.infer<typeof Achievement>
export const Achievements = z.object({ items: uniqueList(Achievement) })

/* ------------------------------------------------------------------ */
/* services / testimonials / resume                                    */
/* ------------------------------------------------------------------ */

export const Service = ItemBase.extend({
  title: z.string().min(1),
  summary: z.string(),
  /** lucide-react icon name in PascalCase, e.g. "Workflow". */
  icon: z.string(),
  demoSlugs: z.array(DemoSlug),
})
export type Service = z.infer<typeof Service>
export const Services = z.object({ items: uniqueList(Service) })

export const Testimonial = ItemBase.extend({
  quote: z.string().min(1),
  author: z.string().min(1),
  role: z.string().optional(),
  org: z.string().optional(),
  url: Href.optional(),
})
export type Testimonial = z.infer<typeof Testimonial>
export const Testimonials = z.object({ items: uniqueList(Testimonial) })

export const Resume = z.object({
  enabled: z.boolean(),
  /** Uploaded PDF (public/uploads/...). Empty = window.print() of /resume. */
  pdfUrl: z.string(),
  summary: z.string(),
  expertise: z.array(z.string()),
  technologies: z.array(z.string()),
  updated: PartialDate,
})
export type Resume = z.infer<typeof Resume>

/* ------------------------------------------------------------------ */
/* playground                                                          */
/* ------------------------------------------------------------------ */

export const PlaygroundDemo = z.object({
  slug: DemoSlug,
  enabled: z.boolean(),
  /** Optional overrides of registry copy (admin-editable). */
  title: z.string().optional(),
  summary: z.string().optional(),
  mirrors: z.string().optional(),
  /** Replaces the registry's skill tags ("Also exercises"). Empty = registry tags. */
  skills: z.array(z.string().min(1)).optional(),
  /** Non-empty = "best on desktop" with this reason; empty = the registry's phone note. */
  mobileNote: z.string().optional(),
  /** Replaces the "Honest limits" list on the demo page. Empty = the demo's own notes. */
  limits: z.array(z.string().min(1)).optional(),
})
export type PlaygroundDemo = z.infer<typeof PlaygroundDemo>

export const Playground = z.object({
  intro: z.string(),
  /** Homepage featured specimen card (DESIGN.md 10). */
  featured: DemoSlug,
  demos: uniqueList(PlaygroundDemo, ['slug']),
})
export type Playground = z.infer<typeof Playground>

/* ------------------------------------------------------------------ */
/* ai                                                                  */
/* ------------------------------------------------------------------ */

export const PROVIDER_IDS = ['groq', 'gemini', 'deepseek'] as const
export const ProviderId = z.enum(PROVIDER_IDS)
export type ProviderId = z.infer<typeof ProviderId>

export const ProviderConfig = z.object({
  enabled: z.boolean(),
  /** May list comma-separated alternates tried in order. */
  model: z.string().min(1),
  /** May list comma-separated alternates tried in order. */
  visionModel: z.string().optional(),
})

export const Ai = z.object({
  /** Router order is fixed: groq -> gemini -> deepseek -> browser fallback. */
  providers: z.object({ groq: ProviderConfig, gemini: ProviderConfig, deepseek: ProviderConfig }),
  /** Hard per-request output cap applied to every provider. */
  maxTokens: z.number().int().min(16).max(4096),
  /** Per-IP requests per minute across /api/ai/*. */
  perIpPerMinute: z.number().int().min(1).max(120),
  /** Max characters of user input per request. */
  maxInputChars: z.number().int().min(100).max(60000),
  /** Per-instance DeepSeek token budget (input + output). */
  deepseekBudgetTokens: z.number().int().min(0),
  /** Allow demos to fall back to in-browser models (transformers.js). */
  browserFallback: z.boolean(),
})
export type Ai = z.infer<typeof Ai>

/* ------------------------------------------------------------------ */
/* collection registry                                                 */
/* ------------------------------------------------------------------ */

export const SCHEMAS = {
  site: Site,
  theme: Theme,
  skills: Skills,
  experience: Experience,
  projects: Projects,
  research: Research,
  education: Education,
  certifications: Certifications,
  achievements: Achievements,
  services: Services,
  testimonials: Testimonials,
  resume: Resume,
  playground: Playground,
  ai: Ai,
} as const

export type CollectionName = keyof typeof SCHEMAS
export type CollectionData<N extends CollectionName> = z.infer<(typeof SCHEMAS)[N]>
export const COLLECTION_NAMES = Object.keys(SCHEMAS) as CollectionName[]
