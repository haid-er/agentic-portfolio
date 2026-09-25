/**
 * App icon: the register mark, printed twice out of register on cream stock.
 * Owner: seo-theme. For app/icon.tsx and app/apple-icon.tsx:
 *
 *   export const size = { width: 512, height: 512 }
 *   export const contentType = 'image/png'
 *   export default () => renderRegisterIcon(size.width)
 */
import { ImageResponse } from 'next/og'
import { getTheme } from '@/lib/content'
import { worldTokens } from '@/lib/theme/tokens'

export function renderRegisterIcon(px = 512): ImageResponse {
  const c = worldTokens(getTheme(), 'almanac')
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', background: c['--bg'] }}>
        <svg width={px} height={px} viewBox="0 0 100 100">
          <g fill="none" stroke={c['--accent-2']} strokeWidth="5" opacity="0.85" transform="translate(3 2.5)">
            <circle cx="48" cy="48" r="24" />
            <path d="M48 14v68M14 48h68" />
          </g>
          <g fill="none" stroke={c['--ink']} strokeWidth="5">
            <circle cx="48" cy="48" r="24" />
            <circle cx="48" cy="48" r="9" />
            <path d="M48 14v68M14 48h68" />
          </g>
        </svg>
      </div>
    ),
    { width: px, height: px },
  )
}
