export function urlCchicApp(): string {
  const explicit = process.env.NEXT_PUBLIC_CCHIC_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000'
  }

  return 'https://cchic.vercel.app'
}
