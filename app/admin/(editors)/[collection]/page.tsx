/**
 * /admin/[collection]: one editor per content collection. Owner: admin-editors.
 * The server hands the raw collection (disabled + unverified items included)
 * to the client editor, which loads the latest stored copy and saves through
 * /api/admin/content/[collection].
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CollectionEditor } from '@/components/admin'
import { COLLECTIONS, COLLECTION_NAMES, getRawCollection, type CollectionName } from '@/lib/content'

export const dynamic = 'force-dynamic'

type Props = {
  params: Promise<{ collection: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const known = (v: string): v is CollectionName => (COLLECTION_NAMES as string[]).includes(v)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { collection } = await params
  return { title: known(collection) ? `Edit ${COLLECTIONS[collection].label}` : 'Not found', robots: { index: false, follow: false } }
}

export default async function EditorPage({ params, searchParams }: Props) {
  const { collection } = await params
  if (!known(collection)) notFound()
  const { tab } = await searchParams
  const meta = COLLECTIONS[collection]
  return (
    <CollectionEditor
      key={collection}
      name={collection}
      meta={{ label: meta.label, description: meta.description, file: meta.file }}
      initialData={getRawCollection(collection)}
      tab={typeof tab === 'string' ? tab : undefined}
    />
  )
}
