export type CategoriaEnlace = 'cursor' | 'modelos' | 'agentes' | 'diseno' | 'infra' | 'tips'

export type EnlaceX = {
  id: number
  tweet_id: string
  enlace: string
  cuenta: string
  autor: string
  /** ISO con zona horaria. */
  fecha: string
  titulo: string
  resumen: string
  nota: string | null
  categoria: CategoriaEnlace
}

/** Borrador que regresa el autocompletado; el admin lo revisa antes de guardar. */
export type BorradorEnlaceX = Omit<EnlaceX, 'id' | 'fecha'> & {
  textoOriginal: string
  autocompletadoIA: boolean
}

export const CATEGORIAS: { valor: CategoriaEnlace; etiqueta: string }[] = [
  { valor: 'cursor', etiqueta: 'Cursor' },
  { valor: 'modelos', etiqueta: 'Modelos de IA' },
  { valor: 'agentes', etiqueta: 'Agentes y automatización' },
  { valor: 'diseno', etiqueta: 'Diseño UI/UX' },
  { valor: 'infra', etiqueta: 'Infraestructura' },
  { valor: 'tips', etiqueta: 'Tips y buenas prácticas' },
]

export const ENLACES_X_PIN_HEADER = 'x-enlaces-pin'

/** Acepta x.com / twitter.com (también mobile. y www.) con /status/<id>. */
export function parsearEnlaceX(url: string): { cuenta: string; tweetId: string; enlace: string } | null {
  const m = url.trim().match(/^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{5,25})/i)
  if (!m) return null
  const cuenta = m[1]!.toLowerCase()
  return { cuenta, tweetId: m[2]!, enlace: `https://x.com/${cuenta}/status/${m[2]}` }
}
