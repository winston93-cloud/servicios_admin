/**
 * Lista de inscripción por grupo (entrada al colegio).
 * Códigos: K2A (Kinder), 2A (Primaria), 7B (Secundaria).
 */
import { createSupabaseAdmin } from '@/lib/supabaseAdmin'
import { grupoNumDesdeLetra, letraDesdeGrupoNum } from '@/lib/boletasCiclo'
import {
  cicloFichaAlumnosParaInscripcion,
  cicloInscripcionDesdeTemporada,
} from '@/lib/ciclosEscolares'
import { obtenerCicloEscolarActual } from '@/lib/ciclosEscolaresService'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import { getClient } from '@/lib/boucherCore'
import type { PagoDetalleRegistro } from '@/lib/pagoColegiaturaService'
import { alumnoTienePagoSemiref } from '@/lib/portalAdmisionesColegiatura'
import type { RevisionInscripcionPlantel } from '@/lib/revisionPagadosInscripcion'

/** Ciclo de inscripción (cen) + ficha de alumnos activos a listar. */
async function resolverCiclosEntrada(): Promise<
  | {
      ok: true
      cea: number
      cen: number
      cicloFicha: number
      cicloLabel: string
    }
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
  const cea = Number(cicloSistema.valor)
  const cen = cicloInscripcionDesdeTemporada(cea)
  const cicloFicha = cicloFichaAlumnosParaInscripcion(cen, cea)
  const cicloLabel =
    cen === cea && cicloSistema.nombre
      ? cicloSistema.nombre
      : cen === cea && cicloSistema.anio_inicio && cicloSistema.anio_fin
        ? `${cicloSistema.anio_inicio}-${cicloSistema.anio_fin}`
        : `${cen + 2003}-${cen + 2004}`
  return { ok: true, cea, cen, cicloFicha, cicloLabel }
}

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
 * Guía de códigos para la entrada (Maternal → 9° C).
 */
export const GUIA_CODIGOS_GRUPO_ENTRADA: Array<{
  id: 'maternal' | 'kinder' | 'primaria' | 'secundaria'
  nivel: string
  plantel: string
  /** Coincide con alumno_nivel (1–4). */
  nivel_num: number
  ejemplos: string[]
  nota: string
}> = [
  {
    id: 'maternal',
    nivel: 'Maternal',
    plantel: 'Educativo',
    nivel_num: 1,
    ejemplos: ['MA', 'MB'],
    nota: 'Maternal A y Maternal B (salón completo).',
  },
  {
    id: 'kinder',
    nivel: 'Kinder',
    plantel: 'Educativo',
    nivel_num: 2,
    ejemplos: ['K1A', 'K1B', 'K2A', 'K2B', 'K3A', 'K3B'],
    nota: 'K + grado (1–3) + letra del grupo.',
  },
  {
    id: 'primaria',
    nivel: 'Primaria',
    plantel: 'Winston',
    nivel_num: 3,
    ejemplos: [
      '1A',
      '1B',
      '1C',
      '2A',
      '2B',
      '2C',
      '3A',
      '3B',
      '3C',
      '4A',
      '4B',
      '4C',
      '5A',
      '5B',
      '5C',
      '6A',
      '6B',
      '6C',
    ],
    nota: 'Grado (1–6) + letra. Sin K.',
  },
  {
    id: 'secundaria',
    nivel: 'Secundaria',
    plantel: 'Winston',
    nivel_num: 4,
    ejemplos: [
      '7A',
      '7B',
      '7C',
      '8A',
      '8B',
      '8C',
      '9A',
      '9B',
      '9C',
    ],
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

  const ciclos = await resolverCiclosEntrada()
  if (!ciclos.ok) return ciclos

  const { cen, cicloFicha, cicloLabel } = ciclos

  const supabase = createSupabaseAdmin()
  const vistos = new Set<number>()
  const filas: AlumnoGrupoRow[] = []

  for (const f of parsed.filtros) {
    let query = supabase
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo'
      )
      // Solo activos del ciclo de ficha de la inscripción vigente (ej. 22→23, 23→24…).
      .eq('alumno_status', 1)
      .eq('alumno_ciclo_escolar', cicloFicha)
      .eq('alumno_nivel', f.nivel)
      .eq('alumno_grado', f.grado)
      .order('alumno_app', { ascending: true })
      .order('alumno_apm', { ascending: true })
      .order('alumno_nombre', { ascending: true })
      .limit(120)

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
    // Verde = inscripción completa (13 único o 12 2º diferido); rojo = pendiente.
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

export type NivelEntradaClave = 'maternal_kinder' | 'primaria' | 'secundaria'

function filtrosEntradaPorNivel(nivelEntrada: NivelEntradaClave): {
  filtros: Array<{ nivel: number; grado: number }>
  grupoEtiqueta: string
  nivelLabel: string
} {
  if (nivelEntrada === 'maternal_kinder') {
    return {
      filtros: [
        // Maternal: grados 1-2 (A-B)
        { nivel: 1, grado: 1 },
        { nivel: 1, grado: 2 },
        // Kinder: grados 1-3
        { nivel: 2, grado: 1 },
        { nivel: 2, grado: 2 },
        { nivel: 2, grado: 3 },
      ],
      grupoEtiqueta: 'Maternal/Kinder',
      nivelLabel: 'Maternal/Kinder',
    }
  }

  if (nivelEntrada === 'primaria') {
    return {
      filtros: [
        { nivel: 3, grado: 1 },
        { nivel: 3, grado: 2 },
        { nivel: 3, grado: 3 },
        { nivel: 3, grado: 4 },
        { nivel: 3, grado: 5 },
        { nivel: 3, grado: 6 },
      ],
      grupoEtiqueta: 'Primaria',
      nivelLabel: 'Primaria',
    }
  }

  return {
    filtros: [
      // Secundaria: 7-9 -> alumno_grado 1-3 (BOLETAS)
      { nivel: 4, grado: 1 },
      { nivel: 4, grado: 2 },
      { nivel: 4, grado: 3 },
    ],
    grupoEtiqueta: 'Secundaria',
    nivelLabel: 'Secundaria',
  }
}

/**
 * Pendientes por nivel completo (sin filtrar por grado/grupo específico).
 * Mantiene el mismo criterio de "inscripción completa" que el flujo de grupo:
 * - Verde = concepto 13 (pago único)
 * - Verde también si tiene concepto 12 (2º diferido)
 * - Rojo = no tiene 13 y no tiene 12 en el ciclo de inscripción vigente
 */
export async function revisarInscripcionPorNivelEntrada(
  nivelEntrada: NivelEntradaClave
): Promise<
  RevisionGrupoResultado | { ok: false; error: string; status: number }
> {
  const ciclos = await resolverCiclosEntrada()
  if (!ciclos.ok) return ciclos

  const { cen, cicloLabel } = ciclos
  const { filtros, grupoEtiqueta, nivelLabel } = filtrosEntradaPorNivel(
    nivelEntrada
  )

  const supabase = createSupabaseAdmin()
  const vistos = new Set<number>()
  const filas: AlumnoGrupoRow[] = []

  // Regla operativa solicitada:
  // - Reincripción: activos que "vienen" del ciclo anterior.
  // - Nuevo ingreso: activos cuyo ciclo corresponde al ciclo de inscripción.
  const cicloReinscritos = cen - 1
  const cicloNuevos = cen
  if (cicloReinscritos <= 0) {
    return {
      ok: false,
      error: 'No se pudo resolver el ciclo anterior para reincritos.',
      status: 400,
    }
  }

  for (const f of filtros) {
    // 1) Reincritos desde ciclo anterior
    const queryReinscritos = supabase
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_nuevo_ingreso'
      )
      .eq('alumno_status', 1)
      .eq('alumno_nuevo_ingreso', 0)
      .eq('alumno_ciclo_escolar', cicloReinscritos)
      .eq('alumno_nivel', f.nivel)
      .eq('alumno_grado', f.grado)
      .order('alumno_app', { ascending: true })
      .order('alumno_apm', { ascending: true })
      .order('alumno_nombre', { ascending: true })
      .limit(2000)

    const { data: dataReinscritos, error: errorReinscritos } =
      await queryReinscritos
    if (errorReinscritos) {
      console.error('revision nivel entrada alumnos (reinscritos):', errorReinscritos)
      return {
        ok: false,
        error: 'No se pudo listar reincritos del nivel.',
        status: 500,
      }
    }

    // 2) Nuevos ingresos hacia ciclo de inscripción
    const queryNuevos = supabase
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_nuevo_ingreso'
      )
      .eq('alumno_status', 1)
      .eq('alumno_nuevo_ingreso', 1)
      .eq('alumno_ciclo_escolar', cicloNuevos)
      .eq('alumno_nivel', f.nivel)
      .eq('alumno_grado', f.grado)
      .order('alumno_app', { ascending: true })
      .order('alumno_apm', { ascending: true })
      .order('alumno_nombre', { ascending: true })
      .limit(2000)

    const { data: dataNuevos, error: errorNuevos } = await queryNuevos
    if (errorNuevos) {
      console.error('revision nivel entrada alumnos (nuevos):', errorNuevos)
      return {
        ok: false,
        error: 'No se pudo listar nuevos del nivel.',
        status: 500,
      }
    }

    const juntas = [...(dataReinscritos ?? []), ...(dataNuevos ?? [])] as AlumnoGrupoRow[]
    for (const row of juntas) {
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
    // Verde = inscripción completa (13 único o 12 2º diferido); rojo = pendiente.
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
      grupo_letra: letraDesdeGrupoNum(Number(a.alumno_grupo)) || '',
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

  return {
    ok: true,
    consulta: `nivel:${nivelEntrada}`,
    grupo_etiqueta: grupoEtiqueta,
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
 * Grupos con alumnos activos del ciclo de ficha de inscripción vigente
 * (para autocomplete). Kinder = K1A…; Primaria 1A–6C; Secundaria 7A–9C.
 */
export async function listarGruposDisponiblesEntrada(): Promise<
  | { ok: true; ciclo: number; ciclo_label: string; grupos: GrupoEntradaOpcion[] }
  | { ok: false; error: string; status: number }
> {
  const ciclos = await resolverCiclosEntrada()
  if (!ciclos.ok) return ciclos

  const { cen, cicloFicha, cicloLabel } = ciclos

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('alumno')
    .select('alumno_nivel, alumno_grado, alumno_grupo')
    .eq('alumno_status', 1)
    .eq('alumno_ciclo_escolar', cicloFicha)
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
