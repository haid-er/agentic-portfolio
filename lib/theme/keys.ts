/**
 * World keys (dependency free, server + client safe). Owner: seo-theme.
 * Kept out of lib/content/schema so client code (the theme switch, canvas demos)
 * never pulls zod and the content schemas into the shared bundle.
 * lib/content/schema builds `z.enum(THEME_KEYS)` from this list.
 */
export const THEME_KEYS = ['almanac', 'strata'] as const
export type ThemeKey = (typeof THEME_KEYS)[number]

export const isThemeKey = (v: unknown): v is ThemeKey =>
  typeof v === 'string' && (THEME_KEYS as readonly string[]).includes(v)
