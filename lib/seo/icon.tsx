/**
 * App icon: the register mark, printed twice out of register on cream stock.
 * Owner: seo-theme. Route files stay one-liners:
 *
 *   // app/icon.tsx  -> /icon/192 and /icon/512 (favicon + PWA sizes)
 *   import { appIconMetadata, renderAppIcon } from '@/lib/seo/icon'
 *   export const generateImageMetadata = appIconMetadata
 *   export default renderAppIcon
 *
 *   // app/apple-icon.tsx
 *   import { APPLE_ICON_SIZE, renderAppleIcon } from '@/lib/seo/icon'
 *   export const size = APPLE_ICON_SIZE
 *   export const contentType = 'image/png'
 *   export default renderAppleIcon
 *
 * app/manifest.ts lists the same URLs (`manifestIcons()`).
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

/** Square PNG sizes served by app/icon.tsx (192 + 512 are what PWA installability needs). */
export const APP_ICON_SIZES = [192, 512] as const
export const APPLE_ICON_SIZE = { width: 180, height: 180 }

/** `generateImageMetadata` for app/icon.tsx: one image per size, id = the pixel size. */
export function appIconMetadata() {
  return APP_ICON_SIZES.map((px) => ({
    id: String(px),
    size: { width: px, height: px },
    contentType: 'image/png',
  }))
}

/** Default export of app/icon.tsx. `id` is a string (Next 15) or a promise of one (Next 16). */
export async function renderAppIcon({ id }: { id: string | Promise<string> }): Promise<ImageResponse> {
  const px = Number(await id)
  return renderRegisterIcon((APP_ICON_SIZES as readonly number[]).includes(px) ? px : 512)
}

/** Default export of app/apple-icon.tsx. */
export function renderAppleIcon(): ImageResponse {
  return renderRegisterIcon(APPLE_ICON_SIZE.width)
}

/** The icon list for app/manifest.ts (URLs match the routes above). */
export function manifestIcons(): { src: string; sizes: string; type: string; purpose?: 'any' | 'maskable' }[] {
  return [
    ...APP_ICON_SIZES.map((px) => ({ src: `/icon/${px}`, sizes: `${px}x${px}`, type: 'image/png', purpose: 'any' as const })),
    { src: '/apple-icon', sizes: `${APPLE_ICON_SIZE.width}x${APPLE_ICON_SIZE.height}`, type: 'image/png' },
  ]
}
