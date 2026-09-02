/**
 * Lista de inscripción por grupo (entrada al colegio).
 * Consulta tipo "2a" / "7b" → alumnos activos del ciclo vigente, verde/rojo.
 */
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { grupoNumDesdeLetra, letraDesdeGrupoNum } from '@/lib/boletasCiclo'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { getClient } from '@/lib/boucherCore'
import type { PagoDetalleRegistro } from '@/lib/pagoColegiaturaService'
import { alumnoTienePagoSemiref } from '@/lib/portalAdmisionesColegiatura'
import type { RevisionInscripcionPlantel } from '@/lib/revisionPagadosInscripcion'

export type GrupoEntradaParseado = {
  etiqueta: string
  gradoDisplay: number
  letra: string
  grupoNum: number
  /** Pares nivel+grado a buscar (p. ej. kinder y primaria comparten 2a). */
  filtros: Array<{ nivel: number; grado: number }>
}

export type RevisionGrupoAlumnoItem = {
  alumno_id: number
  alumno_ref: string
  nombre_completo: string
  nivel: number
  nivel_label: string
  grado: number
  grado_label: string
  grupo_letra: string
  plantel: RevisionInscripcionPlantel
  plantel_label: string
  pagado: boolean
  completa_por: '12' | '13' | null
  tiene_dif1: boolean
}

export type RevisionGrupoResultado = {
  ok: true
  consulta: string
  grupo_etiqueta: string
  ciclo_inscripcion: number
  ciclo_label: string
  total: number
  pagados: number
  pendientes: number
  alumnos: RevisionGrupoAlumnoItem[]
}

/**
 * Interpreta "2a", "7b", "9C", etc.
 * 7–9 → Secundaria (grados internos 1–3).
 * 1–6 → Primaria y Kinder (mismos números de grado).
 */
export function parseGrupoEntrada(raw: string): GrupoEntradaParseado | null {
  const limpio = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
  const m = limpio.match(/^(\d{1,2})([a-f])$/i)
  if (!m) return null

  const gradoDisplay = parseInt(m[1], 10)
  const letra = m[2].toUpperCase()
  const grupoNum = grupoNumDesdeLetra(letra)
  if (grupoNum == null || !Number.isFinite(gradoDisplay) || gradoDisplay <= 0) {
    return null
  }

  const etiqueta = `${gradoDisplay}${letra}`

  if (gradoDisplay >= 7 && gradoDisplay <= 9) {
    return {
      etiqueta,
      gradoDisplay,
      letra,
      grupoNum,
      filtros: [{ nivel: 4, grado: gradoDisplay - 6 }],
    }
  }

  if (gradoDisplay >= 1 && gradoDisplay <= 6) {
    return {
      etiqueta,
      gradoDisplay,
      letra,
      grupoNum,
      filtros: [
        { nivel: 3, grado: gradoDisplay },
        { nivel: 2, grado: gradoDisplay },
      ],
    }
  }

  return null
}

function plantelDeNivel(nivel: number): {
  plantel: RevisionInscripcionPlantel
  label: string
} {
  if (nivel === 1 || nivel === 2) {
    return { plantel: 'educativo', label: 'Educativo' }
  }
  return { plantel: 'winston', label: 'Winston' }
}

function nombreCompleto(row: {
  alumno_app?: string | null
  alumno_apm?: string | null
  alumno_nombre?: string | null
}): string {
  return [row.alumno_app, row.alumno_apm, row.alumno_nombre]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

type AlumnoGrupoRow = {
  alumno_id: number
  alumno_ref: string | number
  alumno_nombre: string | null
  alumno_app: string | null
  alumno_apm: string | null
  alumno_nivel: number
  alumno_grado: number
  alumno_grupo: number
}

async function cargarPagosPorAlumnos(
  alumnoIds: number[],
  cen: number
): Promise<Map<number, PagoDetalleRegistro[]>> {
  const map = new Map<number, PagoDetalleRegistro[]>()
  for (const id of alumnoIds) map.set(id, [])
  if (alumnoIds.length === 0) return map

  const supabase = createSupabaseAdmin()
  const CHUNK = 100
  for (let i = 0; i < alumnoIds.length; i += CHUNK) {
    const slice = alumnoIds.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from('pago_detalle')
      .select(
        'pago_id, alumno_id, pago_nombre, pago_referencia, pago_importe, pago_recargo, pago_forma, pago_folio, pago_fecha, pago_hora, pago_emisora, pago_cancelado, pago_registro, facturo'
      )
      .in('alumno_id', slice)
      .limit(8000)

    if (error) {
      console.error('revision grupo pagos:', error)
      continue
    }

    for (const raw of data ?? []) {
      const r = raw as PagoDetalleRegistro
      const id = Number(r.alumno_id)
      if (!map.has(id)) continue
      const ref = String(r.pago_referencia ?? '').replace(/\D/g, '')
      if (ref.length !== 12) continue
      const ciclo = parseInt(ref.slice(7, 9), 10)
      if (ciclo !== cen) continue
      map.get(id)!.push({
        ...r,
        pago_importe: Number(r.pago_importe),
        pago_recargo: Number(r.pago_recargo),
      })
    }
  }
  return map
}

export async function revisarInscripcionPorGrupo(
  consultaGrupo: string
): Promise<
  RevisionGrupoResultado | { ok: false; error: string; status: number }
> {
  const parsed = parseGrupoEntrada(consultaGrupo)
  if (!parsed) {
    return {
      ok: false,
      error: 'Escribe el grupo como 2a, 5b o 7b (grado + letra).',
      status: 400,
    }
  }

  const cicloSistema = await obtenerCicloEscolarActual()
  if (!cicloSistema) {
    return {
      ok: false,
      error: 'No hay ciclo escolar vigente configurado.',
      status: 503,
    }
  }

  const cen = cicloSistema.valor
  const cicloLabel =
    cicloSistema.nombre ||
    (cicloSistema.anio_inicio && cicloSistema.anio_fin
      ? `${cicloSistema.anio_inicio}-${cicloSistema.anio_fin}`
      : `${cen + 2003}-${cen + 2004}`)

  const supabase = createSupabaseAdmin()
  const vistos = new Set<number>()
  const filas: AlumnoGrupoRow[] = []

  for (const f of parsed.filtros) {
    const { data, error } = await supabase
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo'
      )
      .eq('alumno_status', 1)
      .eq('alumno_ciclo_escolar', cen)
      .eq('alumno_nivel', f.nivel)
      .eq('alumno_grado', f.grado)
      .eq('alumno_grupo', parsed.grupoNum)
      .order('alumno_app', { ascending: true })
      .order('alumno_apm', { ascending: true })
      .order('alumno_nombre', { ascending: true })
      .limit(80)

    if (error) {
      console.error('revision grupo alumnos:', error)
      return { ok: false, error: 'No se pudo listar el grupo.', status: 500 }
    }

    for (const row of (data ?? []) as AlumnoGrupoRow[]) {
      const id = Number(row.alumno_id)
      if (vistos.has(id)) continue
      vistos.add(id)
      filas.push(row)
    }
  }
  const pagosMap = await cargarPagosPorAlumnos(
    filas.map((a) => Number(a.alumno_id)),
    cen
  )

  const alumnos: RevisionGrupoAlumnoItem[] = filas.map((a) => {
    const pagos = pagosMap.get(Number(a.alumno_id)) ?? []
    const ref = String(a.alumno_ref)
    const tiene13 = alumnoTienePagoSemiref(pagos, ref, '13', cen)
    const tiene12 = alumnoTienePagoSemiref(pagos, ref, '12', cen)
    const tiene11 = alumnoTienePagoSemiref(pagos, ref, '11', cen)
    const pagado = tiene13 || tiene12
    const plantel = plantelDeNivel(Number(a.alumno_nivel))
    return {
      alumno_id: Number(a.alumno_id),
      alumno_ref: ref,
      nombre_completo: nombreCompleto(a),
      nivel: Number(a.alumno_nivel),
      nivel_label: etiquetaNivelEscolar(a.alumno_nivel),
      grado: Number(a.alumno_grado),
      grado_label: etiquetaGradoEscolar(a.alumno_nivel, a.alumno_grado),
      grupo_letra: letraDesdeGrupoNum(Number(a.alumno_grupo)) || parsed.letra,
      plantel: plantel.plantel,
      plantel_label: plantel.label,
      pagado,
      completa_por: tiene13 ? '13' : tiene12 ? '12' : null,
      tiene_dif1: tiene11,
    }
  })

  // Orden: pendientes primero (rojo arriba) ayuda en la entrada.
  alumnos.sort((a, b) => {
    if (a.pagado !== b.pagado) return a.pagado ? 1 : -1
    return a.nombre_completo.localeCompare(b.nombre_completo, 'es')
  })

  const pagados = alumnos.filter((a) => a.pagado).length

  return {
    ok: true,
    consulta: String(consultaGrupo).trim(),
    grupo_etiqueta: parsed.etiqueta.toUpperCase(),
    ciclo_inscripcion: cen,
    ciclo_label: cicloLabel,
    total: alumnos.length,
    pagados,
    pendientes: alumnos.length - pagados,
    alumnos,
  }
}

/** Solo para mensajes / depuración. */
export function plantelRazon(nivel: number): string {
  return getClient(nivel)
}

export type GrupoEntradaOpcion = {
  codigo: string
  etiqueta: string
  alumnos: number
  niveles: string[]
}

function codigoGrupoDisplay(nivel: number, grado: number, grupoNum: number): string | null {
  const letra = letraDesdeGrupoNum(grupoNum)
  if (!letra) return null
  if (nivel === 4 && grado >= 1 && grado <= 3) {
    return `${grado + 6}${letra}`
  }
  if ((nivel === 2 || nivel === 3) && grado >= 1 && grado <= 6) {
    return `${grado}${letra}`
  }
  return null
}

/**
 * Grupos con alumnos activos en el ciclo vigente (para autocomplete).
 */
export async function listarGruposDisponiblesEntrada(): Promise<
  | { ok: true; ciclo: number; ciclo_label: string; grupos: GrupoEntradaOpcion[] }
  | { ok: false; error: string; status: number }
> {
  const cicloSistema = await obtenerCicloEscolarActual()
  if (!cicloSistema) {
    return {
      ok: false,
      error: 'No hay ciclo escolar vigente configurado.',
      status: 503,
    }
  }

  const cen = cicloSistema.valor
  const cicloLabel =
    cicloSistema.nombre ||
    (cicloSistema.anio_inicio && cicloSistema.anio_fin
      ? `${cicloSistema.anio_inicio}-${cicloSistema.anio_fin}`
      : `${cen + 2003}-${cen + 2004}`)

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('alumno')
    .select('alumno_nivel, alumno_grado, alumno_grupo')
    .eq('alumno_status', 1)
    .eq('alumno_ciclo_escolar', cen)
    .gt('alumno_grupo', 0)
    .limit(5000)

  if (error) {
    console.error('listar grupos entrada:', error)
    return { ok: false, error: 'No se pudieron cargar los grupos.', status: 500 }
  }

  type Acc = { alumnos: number; niveles: Set<string> }
  const mapa = new Map<string, Acc>()

  for (const row of data ?? []) {
    const nivel = Number(row.alumno_nivel)
    const grado = Number(row.alumno_grado)
    const grupoNum = Number(row.alumno_grupo)
    const codigo = codigoGrupoDisplay(nivel, grado, grupoNum)
    if (!codigo) continue
    const key = codigo.toUpperCase()
    const prev = mapa.get(key) ?? { alumnos: 0, niveles: new Set<string>() }
    prev.alumnos += 1
    prev.niveles.add(etiquetaNivelEscolar(nivel))
    mapa.set(key, prev)
  }

  const grupos: GrupoEntradaOpcion[] = [...mapa.entries()]
    .map(([codigo, acc]) => ({
      codigo,
      etiqueta: codigo,
      alumnos: acc.alumnos,
      niveles: [...acc.niveles].sort((a, b) => a.localeCompare(b, 'es')),
    }))
    .sort((a, b) => {
      const na = parseInt(a.codigo, 10)
      const nb = parseInt(b.codigo, 10)
      if (na !== nb) return na - nb
      return a.codigo.localeCompare(b.codigo, 'es')
    })

  return { ok: true, ciclo: cen, ciclo_label: cicloLabel, grupos }
}
