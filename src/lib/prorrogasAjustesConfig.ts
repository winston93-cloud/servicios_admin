export function urlProrrogasAjustesApp(): string {
  const explicit = process.env.NEXT_PUBLIC_PRORROGAS_AJUSTES_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001'
  }

  return 'https://prorrogas-ajustes.vercel.app'
}
