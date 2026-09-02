/**
 * Lista de inscripción por grupo (entrada al colegio).
 * Códigos: K2A (Kinder), 2A (Primaria), 7B (Secundaria).
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
  /** null = no filtrar por alumno_grupo (p. ej. Maternal A/B). */
  grupoNum: number | null
  filtros: Array<{ nivel: number; grado: number }>
  nivel_forzado: number | null
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
  nivel_label: string | null
  ciclo_inscripcion: number
  ciclo_label: string
  total: number
  pagados: number
  pendientes: number
  alumnos: RevisionGrupoAlumnoItem[]
}


/**
 * Guía de códigos para la entrada (Maternal → 9°).
 */
export const GUIA_CODIGOS_GRUPO_ENTRADA: Array<{
  nivel: string
  plantel: string
  ejemplos: string[]
  nota: string
}> = [
  {
    nivel: 'Maternal',
    plantel: 'Educativo',
    ejemplos: ['MA', 'MB'],
    nota: 'Maternal A y Maternal B (salón completo).',
  },
  {
    nivel: 'Kinder',
    plantel: 'Educativo',
    ejemplos: ['K1A', 'K1B', 'K2A', 'K2B', 'K3A', 'K3B'],
    nota: 'K + grado (1–3) + letra del grupo.',
  },
  {
    nivel: 'Primaria',
    plantel: 'Winston',
    ejemplos: ['1A', '1B', '1C', '2A', '3A', '4A', '5A', '6A', '6B', '6C'],
    nota: 'Grado (1–6) + letra. Sin K.',
  },
  {
    nivel: 'Secundaria',
    plantel: 'Winston',
    ejemplos: ['7A', '7B', '8A', '8B', '9A', '9B'],
    nota: '7 = 7mo, 8 = 8vo, 9 = 9no + letra.',
  },
]

/**
 * Interpreta "MA", "K2A", "2a", "7b", etc.
 */
export function parseGrupoEntrada(
  raw: string,
  nivelOpcional?: number | null
): GrupoEntradaParseado | null {
  const limpio = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')

  const maternal = limpio.match(/^m([ab])$/i)
  if (maternal) {
    const letra = maternal[1].toUpperCase()
    const gradoDisplay = letra === 'A' ? 1 : 2
    return {
      etiqueta: `M${letra}`,
      gradoDisplay,
      letra,
      grupoNum: null,
      filtros: [{ nivel: 1, grado: gradoDisplay }],
      nivel_forzado: 1,
    }
  }

  const kinder = limpio.match(/^k(\d)([a-f])$/i)
  if (kinder) {
    const gradoDisplay = parseInt(kinder[1], 10)
    const letra = kinder[2].toUpperCase()
    const grupoNum = grupoNumDesdeLetra(letra)
    if (grupoNum == null || gradoDisplay < 1 || gradoDisplay > 3) return null
    return {
      etiqueta: `K${gradoDisplay}${letra}`,
      gradoDisplay,
      letra,
      grupoNum,
      filtros: [{ nivel: 2, grado: gradoDisplay }],
      nivel_forzado: 2,
    }
  }

  const m = limpio.match(/^(\d{1,2})([a-f])$/i)
  if (!m) return null

  const gradoDisplay = parseInt(m[1], 10)
  const letra = m[2].toUpperCase()
  const grupoNum = grupoNumDesdeLetra(letra)
  if (grupoNum == null || !Number.isFinite(gradoDisplay) || gradoDisplay <= 0) {
    return null
  }

  const etiqueta = `${gradoDisplay}${letra}`
  const nivel =
    nivelOpcional != null && Number.isFinite(nivelOpcional)
      ? Number(nivelOpcional)
      : null

  if (gradoDisplay >= 7 && gradoDisplay <= 9) {
    return {
      etiqueta,
      gradoDisplay,
      letra,
      grupoNum,
      filtros: [{ nivel: 4, grado: gradoDisplay - 6 }],
      nivel_forzado: 4,
    }
  }

  if (gradoDisplay >= 1 && gradoDisplay <= 6) {
    if (nivel === 2) {
      return {
        etiqueta: `K${gradoDisplay}${letra}`,
        gradoDisplay,
        letra,
        grupoNum,
        filtros: [{ nivel: 2, grado: gradoDisplay }],
        nivel_forzado: 2,
      }
    }
    // Por defecto Primaria; si mandan nivel 3, igual.
    return {
      etiqueta,
      gradoDisplay,
      letra,
      grupoNum,
      filtros: [{ nivel: 3, grado: gradoDisplay }],
      nivel_forzado: 3,
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
  consultaGrupo: string,
  nivelOpcional?: number | null
): Promise<
  RevisionGrupoResultado | { ok: false; error: string; status: number }
> {
  const parsed = parseGrupoEntrada(consultaGrupo, nivelOpcional)
  if (!parsed) {
    return {
      ok: false,
      error: 'Escribe el grupo como K2A, 2A o 7B (Kinder con K).',
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
    let query = supabase
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo'
      )
      .eq('alumno_status', 1)
      .eq('alumno_ciclo_escolar', cen)
      .eq('alumno_nivel', f.nivel)
      .eq('alumno_grado', f.grado)
      .order('alumno_app', { ascending: true })
      .order('alumno_apm', { ascending: true })
      .order('alumno_nombre', { ascending: true })
      .limit(80)

    if (parsed.grupoNum != null) {
      query = query.eq('alumno_grupo', parsed.grupoNum)
    }

    const { data, error } = await query

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

  alumnos.sort((a, b) =>
    a.nombre_completo.localeCompare(b.nombre_completo, 'es', {
      sensitivity: 'base',
    })
  )

  const pagados = alumnos.filter((a) => a.pagado).length
  const nivelLabel =
    parsed.nivel_forzado != null
      ? etiquetaNivelEscolar(parsed.nivel_forzado)
      : null

  return {
    ok: true,
    consulta: String(consultaGrupo).trim(),
    grupo_etiqueta: parsed.etiqueta.toUpperCase(),
    nivel_label: nivelLabel,
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
  /** Código a buscar: K2A, 2A, 7B */
  codigo: string
  etiqueta: string
  nivel: number
  nivel_label: string
  alumnos: number
}

function codigoGrupoDisplay(
  nivel: number,
  grado: number,
  grupoNum: number
): string | null {
  if (nivel === 1 && (grado === 1 || grado === 2)) {
    return grado === 1 ? 'MA' : 'MB'
  }
  const letra = letraDesdeGrupoNum(grupoNum)
  if (!letra) return null
  if (nivel === 4 && grado >= 1 && grado <= 3) {
    return `${grado + 6}${letra}`
  }
  if (nivel === 2 && grado >= 1 && grado <= 3) {
    return `K${grado}${letra}`
  }
  if (nivel === 3 && grado >= 1 && grado <= 6) {
    return `${grado}${letra}`
  }
  return null
}

/**
 * Grupos con alumnos activos en el ciclo vigente (para autocomplete).
 * Kinder sale como K1A / K2A / K3A; Primaria 1A–6C; Secundaria 7A–9C.
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
    .limit(5000)

  if (error) {
    console.error('listar grupos entrada:', error)
    return { ok: false, error: 'No se pudieron cargar los grupos.', status: 500 }
  }

  type Acc = { alumnos: number; nivel: number; codigo: string }
  const mapa = new Map<string, Acc>()

  for (const row of data ?? []) {
    const nivel = Number(row.alumno_nivel)
    const grado = Number(row.alumno_grado)
    const grupoNum = Number(row.alumno_grupo)
    const codigo = codigoGrupoDisplay(nivel, grado, grupoNum)
    if (!codigo) continue
    const key = `${codigo.toUpperCase()}|${nivel}`
    const prev = mapa.get(key) ?? { alumnos: 0, nivel, codigo: codigo.toUpperCase() }
    prev.alumnos += 1
    mapa.set(key, prev)
  }

  const grupos: GrupoEntradaOpcion[] = [...mapa.values()]
    .map((acc) => {
      const nivel_label = etiquetaNivelEscolar(acc.nivel)
      return {
        codigo: acc.codigo,
        etiqueta: `${acc.codigo} · ${nivel_label}`,
        nivel: acc.nivel,
        nivel_label,
        alumnos: acc.alumnos,
      }
    })
    .sort((a, b) => {
      if (a.nivel !== b.nivel) return a.nivel - b.nivel
      return a.codigo.localeCompare(b.codigo, 'es')
    })

  return { ok: true, ciclo: cen, ciclo_label: cicloLabel, grupos }
}
