export const NIVELES_CREDENCIAL = [
  { nivel: 1, etiqueta: 'Maternal', defaultKey: 'kinder' },
  { nivel: 2, etiqueta: 'Kinder', defaultKey: 'kinder' },
  { nivel: 3, etiqueta: 'Primaria', defaultKey: 'primaria' },
  { nivel: 4, etiqueta: 'Secundaria', defaultKey: 'secundaria' },
] as const

export function urlVistaPreviaFondo(nivel: number, bust = Date.now()): string {
  return `/api/credenciales/fondo?nivel=${nivel}&t=${bust}`
}
