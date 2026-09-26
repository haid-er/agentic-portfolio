import { OG_IMAGE_SIZE } from '@/lib/seo/og'
import { demoOgAlt, demoOgImage, demoOgParams } from '@/lib/seo/og-pages'
export const size = OG_IMAGE_SIZE
export const contentType = 'image/png'
export const alt = demoOgAlt()
export const generateStaticParams = demoOgParams
export default demoOgImage
