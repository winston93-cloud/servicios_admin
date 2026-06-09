export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'servicios-admin-theme'

export const DEFAULT_THEME: Theme = 'dark'

export function isTheme(value: string | null | undefined): value is Theme {
  return value === 'light' || value === 'dark'
}
