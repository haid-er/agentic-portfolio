/** /admin/[collection] editor. STUB — owner: admin-editors. */
import { notFound } from 'next/navigation'
import { COLLECTIONS, COLLECTION_NAMES, getRawCollection, type CollectionName } from '@/lib/content'

export const dynamic = 'force-dynamic'

export default async function EditorPage({ params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params
  if (!(COLLECTION_NAMES as string[]).includes(collection)) notFound()
  const name = collection as CollectionName
  return (
    <div className="grid gap-4">
      <h1 className="text-4">{COLLECTIONS[name].label}</h1>
      <pre className="text-00 overflow-auto bg-surface p-4 border border-rule">{JSON.stringify(getRawCollection(name), null, 2)}</pre>
    </div>
  )
}
