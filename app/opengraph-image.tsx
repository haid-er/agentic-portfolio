/** Dynamic OG image in the Almanac style. STUB — owner: seo-theme. */
import { ImageResponse } from 'next/og'
import { getProfile } from '@/lib/content'

export const alt = 'Portfolio'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  const p = getProfile()
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#F2EADB', color: '#1D2B22' }}>
        <div style={{ fontSize: 96, fontWeight: 700 }}>{p.name}</div>
        <div style={{ fontSize: 40, color: '#1F6B47' }}>{p.headline}</div>
      </div>
    ),
    size,
  )
}
