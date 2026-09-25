/** Web app manifest. STUB — owner: seo-theme. */
import type { MetadataRoute } from 'next'
import { getProfile, getSeo } from '@/lib/content'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: getSeo().title,
    short_name: getProfile().name,
    description: getSeo().description,
    start_url: '/',
    display: 'standalone',
    background_color: '#F2EADB',
    theme_color: '#1D2B22',
  }
}
