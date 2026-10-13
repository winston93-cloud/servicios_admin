import { createBoletasDb } from './boletasInsforge'
import type { BoletasModuloEmail } from './boletasEmailNivel'
import { letraDesdeGrupoNum } from './boletasCiclo'

export type BoletaModulo = BoletasModuloEmail

export const BOLETA_MODULOS: BoletaModulo[] = [
  'kinder-es',
  'kinder-en',
  'primaria-es',
  'primaria-en',
  'secundaria',
]

export const ETIQUETA_MODULO: Record<BoletaModulo, string> = {
  'kinder-es': 'Kinder · Español',
  'kinder-en': 'Kinder · Inglés',
  'primaria-es': 'Primaria · Español',
  'primaria-en': 'Primaria · Inglés',
  secundaria: 'Secundaria',
}

/** Etiqueta corta para el papá (el nivel ya se sabe por el alumno). */
export const ETIQUETA_MODULO_PAPA: Record<BoletaModulo, string> = {
  'kinder-es': 'Español',
  'kinder-en': 'Inglés',
  'primaria-es': 'Español',
  'primaria-en': 'Inglés',
  secundaria: 'Boleta',
}

/** Módulos de boleta por `alumno_nivel` (2 kinder · 3 primaria · 4 secundaria). Maternal no tiene. */
export function modulosDeNivel(nivel: number): BoletaModulo[] {
  if (nivel === 2) return ['kinder-es', 'kinder-en']
  if (nivel === 3) return ['primaria-es', 'primaria-en']
  if (nivel === 4) return ['secundaria']
  return []
}

export function esModuloBoleta(v: unknown): v is BoletaModulo {
  return typeof v === 'string' && (BOLETA_MODULOS as string[]).includes(v)
}

export function trimestreValido(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 3 ? n : null
}

export type BoletaPublicacion = {
  ciclo: number
  modulo: BoletaModulo
  trimestre: number
  /** 0 + grupo '' = todo el módulo; si no, solo ese grado y grupo. */
  grado: number
  grupo: string
  publicadaPor: string
  publicadaEn: string
}

/** Grado y grupo del alumno en la clave de publicación (`alumno_grado`, letra de `alumno_grupo`). */
export type AlcancePublicacion = { grado: number; grupo: string }

function mapPublicacion(r: Record<string, unknown>): BoletaPublicacion {
  return {
    ciclo: Number(r.ciclo),
    modulo: String(r.modulo) as BoletaModulo,
    trimestre: Number(r.trimestre),
    grado: Number(r.grado ?? 0),
    grupo: String(r.grupo ?? ''),
    publicadaPor: String(r.publicada_por ?? ''),
    publicadaEn: String(r.publicada_en ?? ''),
  }
}

export function alcanceDeAlumno(alumno: { alumno_grado?: unknown; alumno_grupo?: unknown }): AlcancePublicacion {
  return {
    grado: Number(alumno.alumno_grado) || 0,
    grupo: letraDesdeGrupoNum(Number(alumno.alumno_grupo) || 0),
  }
}

export function publicacionAplica(p: BoletaPublicacion, alcance?: AlcancePublicacion | null): boolean {
  if (p.grado === 0 && p.grupo === '') return true
  return Boolean(alcance && p.grado === alcance.grado && p.grupo === alcance.grupo)
}

export async function listarPublicaciones(
  ciclo: number,
  modulos?: BoletaModulo[]
): Promise<BoletaPublicacion[]> {
  let q = createBoletasDb()
    .from('boleta_publicacion')
    .select('ciclo, modulo, trimestre, grado, grupo, publicada_por, publicada_en')
    .eq('ciclo', ciclo)
  if (modulos) {
    if (!modulos.length) return []
    q = q.in('modulo', modulos)
  }
  const { data, error } = await q.order('trimestre', { ascending: true })
  if (error) throw new Error(`Publicaciones de boletas: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapPublicacion)
}

/** Sin `alcance` solo cuenta la publicación de todo el módulo. */
export async function estaPublicada(
  ciclo: number,
  modulo: BoletaModulo,
  trimestre: number,
  alcance?: AlcancePublicacion | null
): Promise<boolean> {
  const { data, error } = await createBoletasDb()
    .from('boleta_publicacion')
    .select('ciclo, modulo, trimestre, grado, grupo, publicada_por, publicada_en')
    .eq('ciclo', ciclo)
    .eq('modulo', modulo)
    .eq('trimestre', trimestre)
  if (error) throw new Error(`Publicación de boleta: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).some((r) => publicacionAplica(mapPublicacion(r), alcance))
}

export async function publicarTrimestre(input: {
  ciclo: number
  modulo: BoletaModulo
  trimestre: number
  por: string
  grado?: number
  grupo?: string
}): Promise<void> {
  const { error } = await createBoletasDb()
    .from('boleta_publicacion')
    .insert([
      {
        ciclo: input.ciclo,
        modulo: input.modulo,
        trimestre: input.trimestre,
        grado: input.grado ?? 0,
        grupo: input.grupo ?? '',
        publicada_por: input.por,
      },
    ])
  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(`Publicar boletas: ${error.message}`)
  }
}

export async function retirarTrimestre(input: {
  ciclo: number
  modulo: BoletaModulo
  trimestre: number
  grado?: number
  grupo?: string
}): Promise<void> {
  const { error } = await createBoletasDb()
    .from('boleta_publicacion')
    .delete()
    .eq('ciclo', input.ciclo)
    .eq('modulo', input.modulo)
    .eq('trimestre', input.trimestre)
    .eq('grado', input.grado ?? 0)
    .eq('grupo', input.grupo ?? '')
  if (error) throw new Error(`Retirar boletas: ${error.message}`)
}

export async function videoPortalBoletas(ciclo: number): Promise<string | null> {
  const { data, error } = await createBoletasDb()
    .from('boleta_portal_config')
    .select('video_url')
    .eq('ciclo', ciclo)
    .limit(1)
  if (error) {
    console.error('Video portal boletas:', error.message)
    return null
  }
  const url = String((data?.[0] as Record<string, unknown> | undefined)?.video_url ?? '').trim()
  return url.startsWith('https://') ? url : null
}
