export function urlProrrogasAjustesApp(): string {
  const explicit = process.env.NEXT_PUBLIC_PRORROGAS_AJUSTES_URL?.trim()
  const base = (
    explicit ||
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3001'
      : 'https://prorrogas-ajustes.vercel.app')
  ).replace(/\/$/, '')

  // Entrada directa al módulo (sin hub de dos tarjetas).
  if (base.endsWith('/prorrogas')) return base
  return `${base}/prorrogas`
}
