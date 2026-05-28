import type { SupabaseClient } from '@supabase/supabase-js'
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

export async function generarListaDeudoresSuspension(
  supabase: SupabaseClient,
  input: GenerarSuspensionesInput
): Promise<GenerarSuspensionesResultado> {
  const { plantel, tipo, cicloEscolar, fechaCartas } = input
  const cicloLargo = cicloLargoDesdeValorCiclo(cicloEscolar)
  const niveles = nivelesPorPlantel(plantel)
  const inscripcionBloques = bloqueInscripcionCiclo(cicloEscolar)

  const { data: alumnos, error: errAlumnos } = await supabase
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, mes'
    )
    .eq('alumno_ciclo_escolar', cicloEscolar)
    .in('alumno_nivel', niveles)
    .not('alumno_status', 'in', '(0,2)')

  if (errAlumnos) throw new Error(errAlumnos.message)

  const listaAlumnos = alumnos ?? []
  const ids = listaAlumnos.map((a) => a.alumno_id as number)
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

  const { data: becas100 } = await supabase
    .from('alumno_beca')
    .select('alumno_id')
    .eq('beca_ciclo_escolar', cicloEscolar)
    .eq('beca_estatus', 1)
    .eq('beca_porcentaje', 100)
    .in('alumno_id', ids)

  const becados100 = new Set((becas100 ?? []).map((b) => b.alumno_id as number))

  const { data: pagos, error: errPagos } = await supabase
    .from('pago_detalle')
    .select('alumno_id, pago_referencia, pago_fecha')
    .in('alumno_id', ids)
    .eq('pago_cancelado', 0)

  if (errPagos) throw new Error(errPagos.message)

  const pagosPorAlumno = new Map<number, { conceptos: Set<string>; fechaInscripcion: string | null }>()
  for (const id of ids) {
    pagosPorAlumno.set(id, { conceptos: new Set(), fechaInscripcion: null })
  }

  for (const p of pagos ?? []) {
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
  supabase: SupabaseClient,
  alumnoIds: number[]
): Promise<Map<number, string>> {
  const mapa = new Map<number, string>()
  const hoy = new Date().toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('pago_prorroga')
    .select('alumno_id, prorroga_fecha')
    .in('alumno_id', alumnoIds)
    .gte('prorroga_fecha', hoy)
    .eq('correccion', 0)
    .order('prorroga_fecha', { ascending: false })

  if (error) {
    console.warn('pago_prorroga no disponible:', error.message)
    return mapa
  }

  for (const row of data ?? []) {
    const id = row.alumno_id as number
    if (!mapa.has(id) && row.prorroga_fecha) {
      mapa.set(id, String(row.prorroga_fecha))
    }
  }
  return mapa
}

async function cargarEmailsPadres(
  supabase: SupabaseClient,
  alumnoIds: number[]
): Promise<Map<number, string[]>> {
  const mapa = new Map<number, Set<string>>()
  for (const id of alumnoIds) mapa.set(id, new Set())

  const { data, error } = await supabase
    .from('alumno_familiar')
    .select('alumno_id, familiar_email')
    .in('alumno_id', alumnoIds)
    .in('tutor_id', [1, 2])
    .eq('familiar_recibir_email', 1)

  if (error) return new Map()

  for (const row of data ?? []) {
    const id = row.alumno_id as number
    const e = String(row.familiar_email ?? '')
      .trim()
      .toLowerCase()
    if (e.includes('@')) mapa.get(id)?.add(e)
  }

  const out = new Map<number, string[]>()
  for (const [id, set] of mapa) out.set(id, [...set])
  return out
}
