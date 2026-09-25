/**
 * Structured data (schema.org JSON-LD). Owner: seo-theme.
 *
 * One connected graph for the whole site: WebSite + ProfilePage -> Person
 * (with `sameAs` to disambiguate him from others with the same name, BRIEF 2)
 * -> ScholarlyArticle(s) he authored. Every value comes from content/; fields
 * that are empty in content are omitted, never guessed.
 *
 * Co-author names are never emitted (BRIEF 2): articles list only this Person.
 */
import {
  getAchievements,
  getCertifications,
  getEducation,
  getExperience,
  getProfile,
  getResearch,
  getSeo,
  getSkills,
  getSocials,
  type ResearchItem,
} from '@/lib/content'
import { absoluteUrl, siteUrl } from './url'

type Node = Record<string, unknown>

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Drop undefined, empty strings and empty arrays so the graph stays honest. */
export function compact<T extends Node>(node: T): T {
  const out: Node = {}
  for (const [k, v] of Object.entries(node)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out as T
}

const isHttp = (u: string | undefined): u is string => !!u && /^https?:\/\//.test(u)
const uniq = <T>(xs: T[]) => Array.from(new Set(xs))
/** Compare URLs loosely (scheme, trailing slash, case). */
const norm = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase()

export const ids = {
  person: () => `${siteUrl()}/#person`,
  website: () => `${siteUrl()}/#website`,
  profile: () => `${siteUrl()}/#profile`,
  article: (r: ResearchItem) => `${siteUrl()}/#article-${r.id}`,
}

const personRef = () => ({ '@id': ids.person() })

export const doiUrl = (doi?: string) => (doi ? `https://doi.org/${doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}` : undefined)

/** Safe JSON for <script type="application/ld+json">. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp('\\u2028', 'g'), '\\u2028')
    .replace(new RegExp('\\u2029', 'g'), '\\u2029')
}

/* ------------------------------------------------------------------ */
/* sameAs                                                              */
/* ------------------------------------------------------------------ */

/**
 * Profile URLs that identify him: `seo.sameAs` plus enabled http(s) socials.
 * Publication links (they identify a paper, not a person) and the site itself are excluded.
 */
export function sameAsUrls(): string[] {
  const paperUrls = new Set(
    getResearch().items.flatMap((r) => [r.url, doiUrl(r.doi)]).filter(isHttp).map(norm),
  )
  const self = norm(siteUrl())
  const all = [...getSeo().sameAs, ...getSocials().map((s) => s.url)].filter(isHttp)
  const seen = new Set<string>()
  return all.filter((u) => {
    const n = norm(u)
    if (n === self || paperUrls.has(n) || seen.has(n)) return false
    seen.add(n)
    return true
  })
}

/* ------------------------------------------------------------------ */
/* nodes                                                               */
/* ------------------------------------------------------------------ */

export function personNode(): Node {
  const p = getProfile()
  const github = getSocials().find((s) => s.id === 'github')
  const current = getExperience().filter((e) => e.end === '')
  const credentials = getCertifications().map((c) =>
    compact({
      '@type': 'EducationalOccupationalCredential',
      name: c.name,
      url: isHttp(c.url) ? c.url : undefined,
      recognizedBy: c.issuer ? { '@type': 'Organization', name: c.issuer } : undefined,
      dateCreated: c.date || undefined,
    }),
  )
  const awards = getAchievements()
    .filter((a) => a.kind === 'award' || a.kind === 'competition')
    .map((a) => a.title)

  return compact({
    '@type': 'Person',
    '@id': ids.person(),
    name: p.name,
    alternateName: github?.handle || undefined,
    url: siteUrl(),
    mainEntityOfPage: { '@id': ids.profile() },
    image: p.avatar ? absoluteUrl(p.avatar) : undefined,
    jobTitle: p.headline || undefined,
    description: p.shortBio || p.tagline || undefined,
    email: p.email ? `mailto:${p.email}` : undefined,
    homeLocation: p.location ? { '@type': 'Place', name: p.location } : undefined,
    worksFor: current.map((e) =>
      compact({ '@type': 'Organization', name: e.org, url: isHttp(e.orgUrl) ? e.orgUrl : undefined }),
    ),
    alumniOf: getEducation().map((e) =>
      compact({ '@type': 'EducationalOrganization', name: e.institution, address: e.location || undefined }),
    ),
    hasCredential: credentials,
    award: awards,
    knowsAbout: uniq(getSkills().map((s) => s.name)),
    knowsLanguage: p.languages.map((l) => l.name),
    sameAs: sameAsUrls(),
  })
}

export function websiteNode(): Node {
  const seo = getSeo()
  return compact({
    '@type': 'WebSite',
    '@id': ids.website(),
    url: siteUrl(),
    name: seo.title,
    description: seo.description || undefined,
    inLanguage: 'en',
    author: personRef(),
    publisher: personRef(),
    copyrightHolder: personRef(),
  })
}

export function profilePageNode(): Node {
  const seo = getSeo()
  return compact({
    '@type': 'ProfilePage',
    '@id': ids.profile(),
    url: siteUrl(),
    name: seo.title,
    description: seo.description || undefined,
    isPartOf: { '@id': ids.website() },
    mainEntity: personRef(),
    about: personRef(),
  })
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

/** "85 (9)" -> { volume: "85", issue: "9" } (only what the string states). */
function splitVolume(v?: string): { volume?: string; issue?: string } {
  if (!v) return {}
  const m = v.match(/^\s*([^()\s]+)\s*(?:\(([^)]+)\))?/)
  return m ? { volume: m[1], issue: m[2] } : { volume: v }
}

/** ScholarlyArticle for one research item. Only this Person is listed as an author. */
export function scholarlyArticleNode(r: ResearchItem): Node {
  const { volume, issue } = splitVolume(r.volume)
  const periodical = r.venue ? { '@type': 'Periodical', name: r.venue } : undefined
  const volumeNode = volume ? compact({ '@type': 'PublicationVolume', volumeNumber: volume, isPartOf: periodical }) : undefined
  const isPartOf = issue
    ? compact({ '@type': 'PublicationIssue', issueNumber: issue, isPartOf: volumeNode })
    : volumeNode ?? periodical
  const doi = doiUrl(r.doi)
  return compact({
    '@type': 'ScholarlyArticle',
    '@id': ids.article(r),
    headline: r.title.length > 110 ? `${r.title.slice(0, 109)}…` : r.title,
    name: r.title,
    abstract: r.abstract || undefined,
    datePublished: r.year || undefined,
    url: isHttp(r.url) ? r.url : doi,
    sameAs: doi && doi !== r.url ? [doi] : undefined,
    identifier: r.doi ? { '@type': 'PropertyValue', propertyID: 'DOI', value: r.doi } : undefined,
    /* The paper has co-authors whose names are never published here; say so honestly. */
    creditText:
      r.authorPosition && r.authorCount ? `${ordinal(r.authorPosition)} of ${r.authorCount} authors` : undefined,
    isPartOf,
    author: [personRef()],
    inLanguage: 'en',
  })
}

/* ------------------------------------------------------------------ */
/* documents                                                           */
/* ------------------------------------------------------------------ */

/** The site-wide graph: WebSite, ProfilePage, Person and his articles. */
export function siteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [websiteNode(), profilePageNode(), personNode(), ...getResearch().items.map(scholarlyArticleNode)],
  }
}

/**
 * Person JSON-LD with sameAs (BRIEF 2: disambiguation). Used by the root layout.
 * Returns the connected site graph, whose main entity is the Person, so the
 * ScholarlyArticle nodes ship on every page without a second script tag.
 */
export function personJsonLd() {
  return siteJsonLd()
}

/** A standalone ScholarlyArticle document (e.g. for a research detail view). */
export function scholarlyArticleJsonLd(r: ResearchItem) {
  return { '@context': 'https://schema.org', ...scholarlyArticleNode(r) }
}

/** BreadcrumbList for inner pages: [{name, path}] from the home page down. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: absoluteUrl(t.path),
    })),
  }
}

/** A playground demo as a free WebApplication by this Person. */
export function demoJsonLd(d: { slug: string; title: string; summary: string; skills?: string[] }) {
  return {
    '@context': 'https://schema.org',
    ...compact({
      '@type': 'WebApplication',
      name: d.title,
      description: d.summary || undefined,
      url: absoluteUrl(`/playground/${d.slug}`),
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any (web browser)',
      isAccessibleForFree: true,
      keywords: d.skills?.length ? d.skills.join(', ') : undefined,
      author: { '@type': 'Person', '@id': ids.person(), name: getProfile().name },
      isPartOf: { '@id': ids.website() },
    }),
  }
}
