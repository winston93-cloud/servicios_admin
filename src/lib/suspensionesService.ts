import type { AppDatabaseClient } from '@/lib/dbTypes'
import { resolverCicloEscolarSistemaValor } from '@/lib/ciclosEscolaresService'
import {
  CHUNK_ALUMNO_ID_GENERAL,
  CHUNK_ALUMNO_ID_PAGO,
  PAGE_ALUMNO,
  chunkArray,
} from '@/lib/reportes/dbChunks'
import { pagoVigente } from '@/lib/reportes/pagoReporteHelpers'
import {
  calcularAdeudosAlumno,
  cicloLargoDesdeValorCiclo,
  nivelesPorPlantel,
  type TipoReporteSuspension,
} from './suspensionesAdeudos'
import { etiquetaNivelGrado } from './suspensionesEtiquetas'

export interface AlumnoDeudorSuspension {
  alumnoId: number
  alumnoRef: string
  nombre: string
  nivel: number
  grado: number
  grupo: number
  gradoEtiqueta: string
  adeudos: string
  prorroga: string | null
  planMes: number | null
  emails: string[]
}

export interface GenerarSuspensionesInput {
  plantel: 1 | 2
  tipo: TipoReporteSuspension
  cicloEscolar: number
  fechaCartas: string
}

export interface GenerarSuspensionesResultado {
  cicloEscolar: number
  cicloLargo: number
  tipo: TipoReporteSuspension
  plantel: 1 | 2
  fechaCartas: string
  deudores: AlumnoDeudorSuspension[]
  totalAlumnosRevisados: number
}

function conceptoDesdeReferencia(ref: string | null): string | null {
  const r = String(ref ?? '').replace(/\D/g, '')
  if (r.length < 8) return null
  return r.slice(5, 7)
}

function cicloDesdeReferencia(ref: string | null): number | null {
  const r = String(ref ?? '').replace(/\D/g, '')
  if (r.length < 8) return null
  const c = parseInt(r.slice(7, 9), 10)
  return Number.isNaN(c) ? null : c
}

function bloqueInscripcionCiclo(ciclo: number): string[] {
  const c = String(ciclo).padStart(2, '0')
  return [`12${c}`, `13${c}`]
}

const PAGOS_PAGE_SIZE = 1000

async function cargarPagosDetalleAlumnos(
  supabase: AppDatabaseClient,
  alumnoIds: number[]
): Promise<
  Array<{
    alumno_id: number
    pago_referencia: string | null
    pago_fecha: string | null
    pago_cancelado: number | null
  }>
> {
  const filas: Array<{
    alumno_id: number
    pago_referencia: string | null
    pago_fecha: string | null
    pago_cancelado: number | null
  }> = []

  for (const slice of chunkArray(alumnoIds, CHUNK_ALUMNO_ID_PAGO)) {
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('pago_detalle')
        .select('alumno_id, pago_referencia, pago_fecha, pago_cancelado')
        .in('alumno_id', slice)
        // Vigentes: 0 normal, 3 beca/$0 (mismo criterio que portal).
        // Excluir solo cancelados 1 y 2.
        .not('pago_cancelado', 'in', '(1,2)')
        .range(from, from + PAGOS_PAGE_SIZE - 1)

      if (error) throw new Error(error.message)
      const chunk = data ?? []
      for (const row of chunk) {
        const cancelado =
          row.pago_cancelado == null ? null : Number(row.pago_cancelado)
        if (!pagoVigente(cancelado)) continue
        filas.push({
          alumno_id: Number(row.alumno_id),
          pago_referencia: (row.pago_referencia as string | null) ?? null,
          pago_fecha: (row.pago_fecha as string | null) ?? null,
          pago_cancelado: cancelado,
        })
      }
      if (chunk.length < PAGOS_PAGE_SIZE) break
      from += PAGOS_PAGE_SIZE
    }
  }

  return filas
}

async function resolverCicloFichaDeudores(
  supabase: AppDatabaseClient,
  cicloReporte: number
): Promise<number> {
  // Tras el cambio de ciclo las fichas ya están en es_actual; el select del
  // reporte sigue siendo el ciclo de pagos (p. ej. 22) y no debe quedar vacío.
  const { count, error } = await supabase
    .from('alumno')
    .select('alumno_id', { count: 'exact', head: true })
    .eq('alumno_ciclo_escolar', cicloReporte)
    .not('alumno_status', 'in', '(0,2)')

  if (!error && (count ?? 0) > 0) return cicloReporte

  try {
    const cea = await resolverCicloEscolarSistemaValor()
    if (cea > 0 && cea !== cicloReporte) return cea
  } catch {
    // Sin catálogo: quedarse con el ciclo pedido.
  }
  return cicloReporte
}

export async function generarListaDeudoresSuspension(
  supabase: AppDatabaseClient,
  input: GenerarSuspensionesInput
): Promise<GenerarSuspensionesResultado> {
  const { plantel, tipo, cicloEscolar, fechaCartas } = input
  const cicloLargo = cicloLargoDesdeValorCiclo(cicloEscolar)
  const niveles = nivelesPorPlantel(plantel)
  const inscripcionBloques = bloqueInscripcionCiclo(cicloEscolar)
  const cicloFicha = await resolverCicloFichaDeudores(supabase, cicloEscolar)

  type AlumnoSuspRow = {
    alumno_id: number
    alumno_ref: string | null
    alumno_nombre: string | null
    alumno_app: string | null
    alumno_apm: string | null
    alumno_nivel: number
    alumno_grado: number
    alumno_grupo: number
    mes: number | null
  }

  const listaAlumnos: AlumnoSuspRow[] = []
  let offset = 0

  while (true) {
    const { data, error: errAlumnos } = await supabase
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, mes'
      )
      .eq('alumno_ciclo_escolar', cicloFicha)
      // Solo reinscritos: nuevo ingreso empieza en agosto con cuota 00.
      .eq('alumno_nuevo_ingreso', 0)
      .in('alumno_nivel', niveles)
      .not('alumno_status', 'in', '(0,2)')
      .range(offset, offset + PAGE_ALUMNO - 1)

    if (errAlumnos) throw new Error(errAlumnos.message)
    const chunk = (data ?? []) as AlumnoSuspRow[]
    listaAlumnos.push(...chunk)
    if (chunk.length < PAGE_ALUMNO) break
    offset += PAGE_ALUMNO
  }

  const ids = listaAlumnos.map((a) => a.alumno_id)
  if (!ids.length) {
    return {
      cicloEscolar,
      cicloLargo,
      tipo,
      plantel,
      fechaCartas,
      deudores: [],
      totalAlumnosRevisados: 0,
    }
  }

  const becados100 = new Set<number>()
  for (const slice of chunkArray(ids, CHUNK_ALUMNO_ID_GENERAL)) {
    const { data: becas100 } = await supabase
      .from('alumno_beca')
      .select('alumno_id')
      .eq('beca_ciclo_escolar', cicloEscolar)
      .eq('beca_estatus', 1)
      .eq('beca_porcentaje', 100)
      .in('alumno_id', slice)

    for (const b of becas100 ?? []) {
      becados100.add(b.alumno_id as number)
    }
  }

  const pagos = await cargarPagosDetalleAlumnos(supabase, ids)

  const pagosPorAlumno = new Map<number, { conceptos: Set<string>; fechaInscripcion: string | null }>()
  for (const id of ids) {
    pagosPorAlumno.set(id, { conceptos: new Set(), fechaInscripcion: null })
  }

  for (const p of pagos) {
    const alumnoId = p.alumno_id as number
    if (!alumnoId) continue
    const ref = p.pago_referencia as string | null
    const cicloRef = cicloDesdeReferencia(ref)
    if (cicloRef !== cicloEscolar) continue

    const bucket = pagosPorAlumno.get(alumnoId)
    if (!bucket) continue

    const concepto = conceptoDesdeReferencia(ref)
    if (concepto) bucket.conceptos.add(concepto)

    const bloque = ref?.replace(/\D/g, '').slice(5, 9) ?? ''
    if (inscripcionBloques.includes(bloque) && p.pago_fecha) {
      const actual = bucket.fechaInscripcion
      if (!actual || String(p.pago_fecha) < actual) {
        bucket.fechaInscripcion = String(p.pago_fecha)
      }
    }
  }

  const prorrogas = await cargarProrrogasVigentes(supabase, ids)
  const emailsPorAlumno = await cargarEmailsPadres(supabase, ids)

  const deudores: AlumnoDeudorSuspension[] = []

  for (const a of listaAlumnos) {
    const alumnoId = a.alumno_id as number
    const esBecado100 = becados100.has(alumnoId)

    const bucket = pagosPorAlumno.get(alumnoId)
    if (!bucket) continue

    if (tipo === 1) {
      if (!esBecado100) continue
      if (bucket.fechaInscripcion) continue
    } else {
      if (esBecado100) continue
      if (!bucket.fechaInscripcion) continue
    }

    const planMes = a.mes != null ? Number(a.mes) : null
    const adeudos = calcularAdeudosAlumno(
      tipo,
      [...bucket.conceptos],
      bucket.fechaInscripcion,
      cicloLargo,
      planMes
    )

    if (!adeudos) continue

    deudores.push({
      alumnoId,
      alumnoRef: String(a.alumno_ref).padStart(5, '0'),
      nombre: [a.alumno_app, a.alumno_apm, a.alumno_nombre].filter(Boolean).join(' ').trim(),
      nivel: Number(a.alumno_nivel),
      grado: Number(a.alumno_grado),
      grupo: Number(a.alumno_grupo),
      gradoEtiqueta: etiquetaNivelGrado(
        Number(a.alumno_nivel),
        Number(a.alumno_grado),
        Number(a.alumno_grupo)
      ),
      adeudos,
      prorroga: prorrogas.get(alumnoId) ?? null,
      planMes,
      emails: emailsPorAlumno.get(alumnoId) ?? [],
    })
  }

  deudores.sort((x, y) => {
    if (x.nivel !== y.nivel) return x.nivel - y.nivel
    if (x.grado !== y.grado) return x.grado - y.grado
    return x.nombre.localeCompare(y.nombre, 'es')
  })

  return {
    cicloEscolar,
    cicloLargo,
    tipo,
    plantel,
    fechaCartas,
    deudores,
    totalAlumnosRevisados: listaAlumnos.length,
  }
}

async function cargarProrrogasVigentes(
  supabase: AppDatabaseClient,
  alumnoIds: number[]
): Promise<Map<number, string>> {
  const mapa = new Map<number, string>()
  const hoy = new Date().toISOString().slice(0, 10)

  for (const slice of chunkArray(alumnoIds, CHUNK_ALUMNO_ID_GENERAL)) {
    const { data, error } = await supabase
      .from('pago_prorroga')
      .select('alumno_id, prorroga_fecha')
      .in('alumno_id', slice)
      .gte('prorroga_fecha', hoy)
      .eq('correccion', 0)
      .order('prorroga_fecha', { ascending: false })

    if (error) {
      console.warn('pago_prorroga no disponible:', error.message)
      continue
    }

    for (const row of data ?? []) {
      const id = row.alumno_id as number
      if (!mapa.has(id) && row.prorroga_fecha) {
        mapa.set(id, String(row.prorroga_fecha))
      }
    }
  }
  return mapa
}

async function cargarEmailsPadres(
  supabase: AppDatabaseClient,
  alumnoIds: number[]
): Promise<Map<number, string[]>> {
  const mapa = new Map<number, Set<string>>()
  for (const id of alumnoIds) mapa.set(id, new Set())

  for (const slice of chunkArray(alumnoIds, CHUNK_ALUMNO_ID_GENERAL)) {
    const { data, error } = await supabase
      .from('alumno_familiar')
      .select('alumno_id, familiar_email')
      .in('alumno_id', slice)
      .in('tutor_id', [1, 2])
      .eq('familiar_recibir_email', 1)

    if (error) continue

    for (const row of data ?? []) {
      const id = row.alumno_id as number
      const e = String(row.familiar_email ?? '')
        .trim()
        .toLowerCase()
      if (e.includes('@')) mapa.get(id)?.add(e)
    }
  }

  const out = new Map<number, string[]>()
  for (const [id, set] of mapa) out.set(id, [...set])
  return out
}
