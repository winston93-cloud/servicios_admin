import { createBoletasDb } from './boletasInsforge'
import type { BoletaModulo } from './boletasPortal'

/** Inicio y fin de cada trimestre (fechas YYYY-MM-DD). Las captura la dirección; sin fila = sin fechas. */
export type TrimestreFechas = { trimestre: number; inicio: string; fin: string }

const TABLA = 'boleta_trimestre_fechas'
const FECHA = /^\d{4}-\d{2}-\d{2}$/

export async function obtenerTrimestreFechas(ciclo: number, modulo: BoletaModulo): Promise<TrimestreFechas[]> {
  const { data, error } = await createBoletasDb()
    .from(TABLA)
    .select('trimestre, inicio, fin')
    .eq('ciclo', ciclo)
    .eq('modulo', modulo)
    .order('trimestre')
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    trimestre: Number(r.trimestre),
    inicio: String(r.inicio).slice(0, 10),
    fin: String(r.fin).slice(0, 10),
  }))
}

export async function fechasDeTrimestre(ciclo: number, modulo: BoletaModulo, trimestre: number): Promise<TrimestreFechas | null> {
  return (await obtenerTrimestreFechas(ciclo, modulo)).find((f) => f.trimestre === trimestre) ?? null
}

/** Guarda las fechas que vengan; un trimestre con inicio y fin vacíos se borra. Valida que no se encimen. */
export async function fijarTrimestreFechas(input: {
  ciclo: number
  modulo: BoletaModulo
  fechas: unknown
  por: string
}): Promise<TrimestreFechas[]> {
  const lista = Array.isArray(input.fechas) ? (input.fechas as Record<string, unknown>[]) : []
  const poner: TrimestreFechas[] = []
  const quitar: number[] = []
  for (const f of lista) {
    const trimestre = Number(f.trimestre)
    if (![1, 2, 3].includes(trimestre)) throw new Error('Trimestre inválido (1 a 3).')
    const inicio = String(f.inicio ?? '').trim()
    const fin = String(f.fin ?? '').trim()
    if (!inicio && !fin) {
      quitar.push(trimestre)
      continue
    }
    if (!FECHA.test(inicio) || !FECHA.test(fin)) throw new Error(`Trimestre ${trimestre}: pon fecha de inicio y de fin.`)
    if (fin < inicio) throw new Error(`Trimestre ${trimestre}: la fecha de fin es antes del inicio.`)
    poner.push({ trimestre, inicio, fin })
  }
  const previas = (await obtenerTrimestreFechas(input.ciclo, input.modulo)).filter(
    (p) => !quitar.includes(p.trimestre) && !poner.some((x) => x.trimestre === p.trimestre)
  )
  const todas = [...previas, ...poner].sort((a, b) => a.trimestre - b.trimestre)
  for (let i = 1; i < todas.length; i++) {
    if (todas[i].inicio <= todas[i - 1].fin) {
      throw new Error(`El trimestre ${todas[i].trimestre} empieza antes de que termine el ${todas[i - 1].trimestre}.`)
    }
  }
  const db = createBoletasDb()
  if (poner.length) {
    const ahora = new Date().toISOString()
    const { error } = await db.from(TABLA).upsert(
      poner.map((f) => ({ ciclo: input.ciclo, modulo: input.modulo, ...f, actualizado_por: input.por, updated_at: ahora })),
      { onConflict: 'ciclo,modulo,trimestre' }
    )
    if (error) throw new Error(error.message)
  }
  if (quitar.length) {
    const { error } = await db.from(TABLA).delete().eq('ciclo', input.ciclo).eq('modulo', input.modulo).in('trimestre', quitar)
    if (error) throw new Error(error.message)
  }
  return obtenerTrimestreFechas(input.ciclo, input.modulo)
}
