import { OG_IMAGE_SIZE } from '@/lib/seo/og'
import { projectOgAlt, projectOgImage, projectOgParams } from '@/lib/seo/og-pages'
export const size = OG_IMAGE_SIZE
export const contentType = 'image/png'
export const alt = projectOgAlt()
export const generateStaticParams = projectOgParams
export default projectOgImage
