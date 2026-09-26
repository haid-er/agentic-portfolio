'use client'
/** Picks the editor for a collection and wraps it in the shared shell (state, validation, save). */
import type { ComponentType } from 'react'
import type { CollectionName } from '@/lib/content/schema'
import { EditorShell, type EditorMeta } from './EditorShell'
import { AiEditor } from './editors/AiEditor'
import { AchievementsEditor, CertificationsEditor, EducationEditor } from './editors/CredentialEditors'
import { ExperienceEditor } from './editors/ExperienceEditor'
import { PlaygroundEditor } from './editors/PlaygroundEditor'
import { ProjectsEditor } from './editors/ProjectsEditor'
import { ResearchEditor } from './editors/ResearchEditor'
import { ResumeEditor } from './editors/ResumeEditor'
import { ServicesEditor, TestimonialsEditor } from './editors/ServicesEditor'
import { SiteEditor, isSiteTab } from './editors/SiteEditor'
import { SkillsEditor } from './editors/SkillsEditor'
import { ThemeEditor, themeCheck } from './editors/ThemeEditor'

const EDITORS: Record<Exclude<CollectionName, 'site'>, ComponentType> = {
  theme: ThemeEditor,
  skills: SkillsEditor,
  experience: ExperienceEditor,
  projects: ProjectsEditor,
  research: ResearchEditor,
  education: EducationEditor,
  certifications: CertificationsEditor,
  achievements: AchievementsEditor,
  services: ServicesEditor,
  testimonials: TestimonialsEditor,
  resume: ResumeEditor,
  playground: PlaygroundEditor,
  ai: AiEditor,
}

export function CollectionEditor({ name, meta, initialData, tab }: {
  name: CollectionName
  meta: EditorMeta
  initialData: unknown
  /** site only: which tab opens first (?tab=). */
  tab?: string
}) {
  const Editor = name === 'site' ? null : EDITORS[name]
  return (
    <EditorShell name={name} meta={meta} initialData={initialData} check={name === 'theme' ? themeCheck : undefined}>
      {Editor ? <Editor /> : <SiteEditor initialTab={isSiteTab(tab) ? tab : 'profile'} />}
    </EditorShell>
  )
}
