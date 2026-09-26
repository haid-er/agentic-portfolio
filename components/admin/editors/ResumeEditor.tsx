'use client'
import { Button } from '@/components/ui'
import { useField } from '../EditorContext'
import { ToggleField } from '../fields/Choice'
import { FieldGrid, Group } from '../fields/Group'
import { ImageField } from '../fields/Image'
import { TagsField } from '../fields/Tags'
import { DateField, TextAreaField } from '../fields/Text'

export function ResumeEditor() {
  const updated = useField<string>(['updated'])
  return (
    <>
      <Group title="Résumé page" description="The print-optimised /resume page and its downloadable PDF.">
        <ToggleField path={['enabled']} label="Résumé page and section enabled" />
        <ImageField path={['pdfUrl']} label="Résumé PDF" kind="pdf" uploadName="resume" optional={false}
          hint="Path of the uploaded PDF under /uploads/…; uploads replace /uploads/resume.pdf. If the file is missing at build time, or the field is empty, Download PDF prints /resume instead." />
        <TextAreaField path={['summary']} label="Summary" rows={3} recommend={{ max: 360 }} />
        <FieldGrid>
          <div className="flex items-end gap-2">
            <DateField path={['updated']} label="Last updated" />
            <Button size="sm" variant="ghost" className="mb-[22px]" onClick={() => updated.set(new Date().toISOString().slice(0, 10))}>Today</Button>
          </div>
        </FieldGrid>
      </Group>
      <Group title="Lists" layer={2}>
        <TagsField path={['expertise']} label="Areas of expertise" />
        <TagsField path={['technologies']} label="Technologies" />
      </Group>
    </>
  )
}
