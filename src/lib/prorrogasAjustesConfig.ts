export function urlProrrogasAjustesApp(operador?: string | null): string {
  const explicit = process.env.NEXT_PUBLIC_PRORROGAS_AJUSTES_URL?.trim()
  const base = (
    explicit ||
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3001'
      : 'https://prorrogas-ajustes.vercel.app')
  ).replace(/\/$/, '')

  // Entrada directa al módulo (sin hub de dos tarjetas).
  const path = base.endsWith('/prorrogas') ? base : `${base}/prorrogas`
  const user = (operador ?? '').trim()
  if (!user) return path

  const url = new URL(path)
  url.searchParams.set('operador', user)
  return url.toString()
}
