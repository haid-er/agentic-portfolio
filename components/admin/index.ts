/**
 * Admin editors and form primitives (owner: admin-editors).
 *
 * Pages use <CollectionEditor>. Everything else is exported so other admin
 * screens can build forms the same way: wrap in <EditorShell>, then bind
 * fields by path.
 */
export { CollectionEditor } from './CollectionEditor'
export { CollectionNav, type NavItem } from './CollectionNav'
export { EditorShell, REVEAL_EVENT, type EditorMeta, type ExtraCheck, type ExtraIssue } from './EditorShell'
export { useEditor, useField, type EditorApi } from './EditorContext'
export { ConfirmDialog, type DialogAction } from './ConfirmDialog'
export { FieldFrame, Counter } from './fields/Frame'
export { TextField, TextAreaField, NumberField, DateField } from './fields/Text'
export { SelectField, ToggleField, SegmentedField, type Option } from './fields/Choice'
export { MarkdownField, Emphasis } from './fields/Markdown'
export { ListField, type ListFieldProps } from './fields/List'
export { TagsField } from './fields/Tags'
export { ImageField } from './fields/Image'
export { ColorField } from './fields/Color'
export { DemoSlugsField, DemoSelectField } from './fields/Demos'
export { UnverifiedBadge, ItemMeta, IdField } from './fields/Item'
export { Group, FieldGrid } from './fields/Group'
export { contrast, parseColor } from './lib/contrast'
export { getIn, setIn, slugify, uniqueId, type Path } from './lib/path'
