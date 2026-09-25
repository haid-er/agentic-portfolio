'use client'
/**
 * Reads the query string for the gallery. The page stays static: during
 * prerender the Suspense fallback renders the unfiltered gallery, and the
 * browser then hydrates this with the real ?skill= / ?pillar= / ?q= values.
 */
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Gallery, type GalleryProps } from './Gallery'

function WithParams(props: Omit<GalleryProps, 'urlQuery'>) {
  const params = useSearchParams()
  return <Gallery {...props} urlQuery={params.toString()} />
}

export function GalleryFromUrl(props: Omit<GalleryProps, 'urlQuery'>) {
  return (
    <Suspense fallback={<Gallery {...props} />}>
      <WithParams {...props} />
    </Suspense>
  )
}
