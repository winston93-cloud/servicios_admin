/** Búsqueda de módulos del dashboard: sin acentos, por relevancia, tolera errores leves. */

export type ModuloBuscable = {
  label: string
  desc: string
  kicker?: string
  badge?: string
  tags?: string[]
}

export type ResultadoBusqueda<T> = { item: T; puntos: number }

/** Minúsculas y sin acentos, carácter por carácter (mismo largo que el original). */
export function normalizarBusqueda(texto: string): string {
  let out = ''
  for (const ch of texto) {
    const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    out += (base || ch).charAt(0).toLowerCase()
  }
  return out
}

export function tokensBusqueda(q: string): string[] {
  return normalizarBusqueda(q.trim()).split(/[\s,.;:/-]+/).filter(Boolean)
}

function distancia(a: string, b: string): number {
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = fila[0]
    fila[0] = i
    for (let j = 1; j <= b.length; j++) {
      const arriba = fila[j]
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = arriba
    }
  }
  return fila[b.length]
}

/** Errores de dedo («taleres») o raíz de la palabra («pagos» → «pagados»). */
function parecido(token: string, palabras: string[]): boolean {
  if (token.length < 4) return false
  const tolerancia = token.length >= 7 ? 2 : 1
  const raiz = token.slice(0, -1)
  return palabras.some(
    (p) =>
      p.startsWith(raiz) ||
      distancia(token, p) <= tolerancia ||
      (p.length > token.length && distancia(token, p.slice(0, token.length)) <= tolerancia)
  )
}

function puntosToken(token: string, m: ModuloBuscable): number {
  const label = normalizarBusqueda(m.label)
  const palabras = label.split(/[\s/.-]+/)
  if (palabras.some((p) => p.startsWith(token))) return 100
  if (label.includes(token)) return 70
  const meta = normalizarBusqueda([m.kicker, m.badge, ...(m.tags ?? [])].filter(Boolean).join(' '))
  if (meta.includes(token)) return 45
  if (normalizarBusqueda(m.desc).includes(token)) return 25
  if (parecido(token, palabras)) return 15
  return 0
}

export function buscarModulos<T extends ModuloBuscable>(items: T[], q: string): ResultadoBusqueda<T>[] {
  const tokens = tokensBusqueda(q)
  if (!tokens.length) return items.map((item) => ({ item, puntos: 0 }))
  const frase = tokens.join(' ')
  return items
    .map((item, orden) => {
      let puntos = 0
      for (const t of tokens) {
        const p = puntosToken(t, item)
        if (!p) return null
        puntos += p
      }
      if (normalizarBusqueda(item.label).startsWith(frase)) puntos += 60
      return { item, puntos, orden }
    })
    .filter((r): r is ResultadoBusqueda<T> & { orden: number } => r !== null)
    .sort((a, b) => b.puntos - a.puntos || a.orden - b.orden)
    .map(({ item, puntos }) => ({ item, puntos }))
}

/** Tramos [inicio, fin) del texto que coinciden con algún token (para resaltar). */
export function tramosCoincidencia(texto: string, q: string): [number, number][] {
  const tokens = tokensBusqueda(q)
  if (!tokens.length) return []
  const norm = normalizarBusqueda(texto)
  const marcas = new Array<boolean>(norm.length).fill(false)
  for (const t of tokens) {
    let desde = 0
    for (;;) {
      const i = norm.indexOf(t, desde)
      if (i < 0) break
      for (let k = i; k < i + t.length; k++) marcas[k] = true
      desde = i + t.length
    }
  }
  const tramos: [number, number][] = []
  for (let i = 0; i < marcas.length; i++) {
    if (!marcas[i]) continue
    const ini = i
    while (i < marcas.length && marcas[i]) i++
    tramos.push([ini, i])
  }
  return tramos
}
