/**
 * The retrieval corpus: every visible fact on the site, cut into small, citable chunks.
 * Built only from lib/content getters and the demo registry (nothing hand-written about Malik).
 * Pure data, no browser APIs, so mcp-tool-lab's `search_site` tool reuses it.
 */
import {
  getAchievements, getCertifications, getEducation, getExperience, getProfile, getProjects,
  getResearch, getResume, getSection, getServices, getSite, getSkills, type SectionId,
} from '@/lib/content'
import { getDemos } from '@/lib/demos'
import { formatPartialDate, formatRange } from '@/lib/utils'

export interface Chunk {
  /** Stable id, e.g. "experience:euthyna:2". */
  id: string
  /** Which part of the site it came from (shown as the citation label). */
  section: string
  /** Short human title of the source item. */
  title: string
  /** The text that is indexed and sent to the model. */
  text: string
  /** Where the fact lives on the site. */
  href: string
}

const MAX_CHARS = 620

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const join = (parts: Array<string | number | undefined | null | false>, sep = ' ') => parts.filter((p): p is string => typeof p === 'string' && p !== '').map(clean).filter(Boolean).join(sep)
const sentence = (s: string) => (s && !/[.!?]$/.test(s) ? `${s}.` : s)

function sectionLabel(id: SectionId, fallback: string): string {
  const s = getSection(id)
  return clean(s?.navLabel) || clean(s?.title) || fallback
}

/** Sentence split that keeps "Node.js", "3.5s" and "e.g." intact. */
export const sentences = (t: string) => t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).map((x) => x.trim()).filter(Boolean)

/** Split long text on sentence boundaries so each chunk stays small and citable. */
function split(text: string, max = MAX_CHARS): string[] {
  const t = clean(text)
  if (t.length <= max) return t ? [t] : []
  const out: string[] = []
  let cur = ''
  // Very long "sentences" (skill lists) break on semicolons instead.
  const parts = sentences(t).flatMap((s) => (s.length > max ? s.split(/;\s+/).map((x, i, a) => (i < a.length - 1 ? `${x};` : x)) : [s]))
  for (const s of parts) {
    if (cur && cur.length + s.length + 1 > max) { out.push(cur.trim()); cur = '' }
    cur += `${s} `
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function push(out: Chunk[], base: Omit<Chunk, 'id' | 'text'> & { key: string }, text: string) {
  split(text).forEach((part, i) => {
    out.push({ id: `${base.key}:${i}`, section: base.section, title: base.title, href: base.href, text: part })
  })
}

/** Date span without inventing "Present" when both ends are unknown. */
function span(start: string, end: string): string {
  if (start && end) return formatRange(start, end)
  return formatPartialDate(start || end)
}

let cached: Chunk[] | null = null

/** Words of the person's name: present in almost every chunk, so they carry no signal for ranking. */
export function nameStopwords(): string[] {
  return getProfile().name.toLowerCase().match(/[a-z0-9]+/g) ?? []
}

/** All chunks (memoised: content is static per build). */
export function getCorpus(): Chunk[] {
  if (cached) return cached
  const out: Chunk[] = []
  const profile = getProfile()
  const site = getSite()

  // Profile + about
  const aboutLabel = sectionLabel('about', 'About')
  push(out, { key: 'profile', section: aboutLabel, title: profile.name, href: '/#about' },
    join([sentence(join([profile.name, profile.headline && `is a ${profile.headline}`])), sentence(profile.tagline), profile.shortBio, profile.location && `Based in ${profile.location}.`]))
  site.about.body.forEach((p, i) => push(out, { key: `about:${i}`, section: aboutLabel, title: `${aboutLabel} ${profile.name}`, href: '/#about' }, p))
  if (profile.languages.length || profile.interests.length) {
    push(out, { key: 'profile:more', section: aboutLabel, title: `${profile.name}: languages and interests`, href: '/#about' },
      join([
        profile.languages.length && `Languages: ${profile.languages.map((l) => join([l.name, l.level && `(${l.level})`])).join(', ')}.`,
        profile.interests.length && `Interests: ${profile.interests.join('; ')}.`,
      ]))
  }

  // Pillars + skills
  const skillsLabel = sectionLabel('skills', 'Skills')
  const skills = getSkills()
  for (const p of profile.pillars) {
    const inPillar = skills.filter((s) => s.pillar === p.id)
    push(out, { key: `pillar:${p.id}`, section: skillsLabel, title: p.title, href: '/#skills' }, join([sentence(p.title), p.summary]))
    if (inPillar.length) {
      push(out, { key: `skills:${p.id}`, section: skillsLabel, title: `${p.title}: skills and proofs`, href: '/#skills' },
        `${p.title} skills, each with a playground proof: ${inPillar.map((s) => `${s.name} (${s.level}, proof: ${s.demoSlugs.join(', ')})`).join('; ')}.`)
    }
  }

  // Experience
  const expLabel = sectionLabel('experience', 'Experience')
  for (const e of getExperience()) {
    const title = `${e.role}, ${e.org}`
    const base = { section: expLabel, title, href: '/#experience' }
    push(out, { ...base, key: `experience:${e.id}` }, join([
      `${e.role} at ${e.org}${e.product && e.product !== e.org ? ` (${e.product})` : ''}, ${formatRange(e.start, e.end)}.`,
      join([e.location, e.mode]) && `${join([e.location, e.mode], ', ')}.`,
      e.summary,
      e.metric && `Result: ${e.metric.label} went from ${e.metric.from} to ${e.metric.to}.`,
      e.stack.length && `Stack: ${e.stack.join(', ')}.`,
    ]))
    e.highlights.forEach((h, i) => push(out, { ...base, key: `experience:${e.id}:h${i}` }, join([`At ${e.org}:`, h.text, h.proofDemo && `(Proof: ${h.proofDemo}.)`])))
  }

  // Projects
  const projLabel = sectionLabel('projects', 'Projects')
  for (const p of getProjects()) {
    const base = { section: projLabel, title: p.title, href: `/projects/${p.slug}` }
    push(out, { ...base, key: `project:${p.slug}` }, join([
      sentence(`${p.title}: ${p.summary}`),
      p.role && `Role: ${p.role}.`,
      (p.start || p.end) && `When: ${span(p.start ?? '', p.end ?? '')}.`,
      p.outcome && sentence(`Outcome: ${p.outcome}`),
      p.stack.length && `Stack: ${p.stack.join(', ')}.`,
      p.demoSlugs.length && `Proof demos: ${p.demoSlugs.join(', ')}.`,
    ]))
    p.story.forEach((s, i) => push(out, { ...base, key: `project:${p.slug}:s${i}` }, s))
  }

  // Research
  const resLabel = sectionLabel('research', 'Research')
  const research = getResearch()
  for (const r of research.items) {
    const base = { section: resLabel, title: r.title, href: '/#research' }
    push(out, { ...base, key: `research:${r.id}` }, join([
      `Paper: "${r.title}", ${join([r.venue, r.volume, r.year], ', ')}.`,
      r.authorPosition && r.authorCount && `${profile.name} is author ${r.authorPosition} of ${r.authorCount}.`,
      r.doi && `DOI: ${r.doi}.`,
      r.results.length && `${r.resultsCaption || 'Reported results'}: ${r.results.map((x) => `${x.label} ${x.value}${x.unit}`).join(', ')}.`,
    ]))
    if (r.abstract) push(out, { ...base, key: `research:${r.id}:abs` }, r.abstract)
  }
  if (research.pipeline.enabled && research.pipeline.steps.length) {
    push(out, { key: 'research:pipeline', section: resLabel, title: research.pipeline.title, href: '/#research' },
      join([sentence(research.pipeline.title), research.pipeline.note, `Steps: ${research.pipeline.steps.join(' → ')}.`]))
  }

  // Education, certifications, achievements, services
  const eduLabel = sectionLabel('education', 'Education')
  for (const e of getEducation()) {
    push(out, { key: `education:${e.id}`, section: eduLabel, title: e.institution, href: '/#education' }, join([
      `${e.degree}${e.field ? ` in ${e.field}` : ''} at ${e.institution}${span(e.start, e.end) ? `, ${span(e.start, e.end)}` : ''}.`,
      e.location && `${e.location}.`,
      e.grade && `Grade: ${e.grade}.`,
      ...e.notes,
    ]))
  }
  const certLabel = sectionLabel('certifications', 'Certifications')
  for (const c of getCertifications()) {
    push(out, { key: `cert:${c.id}`, section: certLabel, title: c.name, href: '/#certifications' },
      join([`Certification: ${c.name}`, c.issuer && `from ${c.issuer}`, c.date && `(${formatPartialDate(c.date)})`]) + '.')
  }
  const achLabel = sectionLabel('achievements', 'Achievements')
  for (const a of getAchievements()) {
    push(out, { key: `ach:${a.id}`, section: achLabel, title: a.title, href: '/#achievements' },
      join([sentence(a.title), a.detail, a.date && `Date: ${formatPartialDate(a.date)}.`]))
  }
  const svcLabel = sectionLabel('services', 'Services')
  for (const s of getServices()) {
    push(out, { key: `svc:${s.id}`, section: svcLabel, title: s.title, href: '/#services' },
      join([sentence(`Service: ${s.title}`), s.summary, s.demoSlugs.length && `Proof demos: ${s.demoSlugs.join(', ')}.`]))
  }

  // Résumé + contact
  const resume = getResume()
  if (resume.enabled && (resume.summary || resume.expertise.length)) {
    push(out, { key: 'resume', section: sectionLabel('resume', 'Résumé'), title: 'Résumé summary', href: '/resume' },
      join([resume.summary, resume.expertise.length && `Expertise: ${resume.expertise.join(', ')}.`, resume.technologies.length && `Technologies: ${resume.technologies.join(', ')}.`]))
  }
  push(out, { key: 'contact', section: sectionLabel('contact', 'Contact'), title: 'Contact', href: '/#contact' },
    join([site.contact.blurb, site.contact.availability, profile.email && `Email: ${profile.email}.`, profile.location && `Location: ${profile.location}.`]))

  // Playground demos (the proofs)
  for (const d of getDemos()) {
    push(out, { key: `demo:${d.slug}`, section: 'Playground', title: d.title, href: `/playground/${d.slug}` },
      join([sentence(`Demo "${d.title}" (${d.slug}): ${d.summary}`), d.skills.length && `Proves: ${d.skills.join(', ')}.`, d.mirrors && `Mirrors real work: ${d.mirrors}`]))
  }

  cached = out.filter((c) => c.text.length > 0)
  return cached
}

/** Text used for embeddings and BM25 (title gives short chunks some context). */
export const indexText = (c: Chunk) => `${c.section} · ${c.title}. ${c.text}`
