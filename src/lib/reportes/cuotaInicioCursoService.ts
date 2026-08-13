/**
 * 2026-08-13 - Reporte adeudo / liquidación de cuota de inicio de curso (concepto 00).
 */
import { createDbAdmin } from '@/lib/insforgeAdmin'
import { construirNombreCompleto } from '@/lib/alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import {
  formatearAlumnoRefParaReferencia,
  normalizarConceptoNo,
  parsearReferenciaPago,
} from '@/lib/pagoReferenciaColegiatura'
import { etiquetaCicloReporte } from '@/lib/reportes/renderDocument'
import { formatearFechaPago, pagoVigente } from '@/lib/reportes/pagoReporteHelpers'

const CONCEPTO_CUOTA_INICIO = '00'
const PAGE_ALUMNOS = 500

export type FilaCuotaInicioPagado = {
  no: number
  noCtrl: string
  nombre: string
  grado: string
  grupo: string
  fechaPago: string
  monto: number
  recargo: number
  total: number
  conRecargo: boolean
}

export type FilaCuotaInicioDeudor = {
  no: number
  noCtrl: string
  nombre: string
  grado: string
  grupo: string
  tipoIngreso: string
}

export type ResumenCuotaInicioCurso = {
  titulo: string
  ciclo: number
  cicloLabel: string
  nivel: number
  nivelLabel: string
  pagados: FilaCuotaInicioPagado[]
  deudores: FilaCuotaInicioDeudor[]
  totales: {
    alumnos: number
    pagados: number
    conRecargo: number
    deudores: number
    montoPagado: number
    recargoPagado: number
    pctLiquidado: number
  }
}

type AlumnoRow = {
  alumno_id: number
  alumno_ref: string
  nombre: string
  alumno_grado: number
  alumno_grupo: number
  alumno_nuevo_ingreso: number
}

type Pago00 = {
  alumno_id: number
  pago_referencia: string | null
  pago_fecha: string | null
  pago_importe: number
  pago_recargo: number
  pago_cancelado: number | null
}

async function fetchAlumnosActivosNivelCiclo(
  nivel: number,
  ciclo: number
): Promise<AlumnoRow[]> {
  const db = createDbAdmin()
  const out: AlumnoRow[] = []
  let offset = 0
  while (true) {
    const { data, error } = await db
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo, alumno_nuevo_ingreso'
      )
      .eq('alumno_nivel', nivel)
      .eq('alumno_ciclo_escolar', ciclo)
      .not('alumno_status', 'in', '(0,2)')
      .order('alumno_grado', { ascending: true })
      .order('alumno_grupo', { ascending: true })
      .order('alumno_app', { ascending: true })
      .range(offset, offset + PAGE_ALUMNOS - 1)
    if (error) throw new Error(error.message)
    const chunk = data ?? []
    for (const r of chunk) {
      out.push({
        alumno_id: Number(r.alumno_id),
        alumno_ref: String(r.alumno_ref ?? '').trim(),
        nombre: construirNombreCompleto(r.alumno_nombre, r.alumno_app, r.alumno_apm),
        alumno_grado: Number(r.alumno_grado),
        alumno_grupo: Number(r.alumno_grupo),
        alumno_nuevo_ingreso: Number(r.alumno_nuevo_ingreso ?? 0),
      })
    }
    if (chunk.length < PAGE_ALUMNOS) break
    offset += PAGE_ALUMNOS
  }
  return out
}

async function fetchPagosCuotaInicioCiclo(ciclo: number): Promise<Pago00[]> {
  const ciclo2 = String(ciclo).padStart(2, '0').slice(-2)
  const patron = `_____${CONCEPTO_CUOTA_INICIO}${ciclo2}%`
  const db = createDbAdmin()
  const out: Pago00[] = []
  let offset = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await db
      .from('pago_detalle')
      .select(
        'alumno_id, pago_referencia, pago_fecha, pago_importe, pago_recargo, pago_cancelado'
      )
      .like('pago_referencia', patron)
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(error.message)
    const chunk = data ?? []
    for (const r of chunk) {
      out.push({
        alumno_id: Number(r.alumno_id),
        pago_referencia: (r.pago_referencia as string | null) ?? null,
        pago_fecha: (r.pago_fecha as string | null) ?? null,
        pago_importe: Number(r.pago_importe ?? 0),
        pago_recargo: Number(r.pago_recargo ?? 0),
        pago_cancelado: r.pago_cancelado == null ? null : Number(r.pago_cancelado),
      })
    }
    if (chunk.length < pageSize) break
    offset += pageSize
  }
  return out
}

/** Mejor pago vigente de cuota 00 por alumno (mayor total; desempate fecha más reciente). */
function indexPagosPorAlumno(
  pagos: Pago00[],
  ciclo: number
): Map<number, Pago00> {
  const map = new Map<number, Pago00>()
  for (const p of pagos) {
    if (!pagoVigente(p.pago_cancelado)) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) continue
    if (normalizarConceptoNo(parsed.conceptoNo) !== CONCEPTO_CUOTA_INICIO) continue
    if (parsed.cicloEscolar !== ciclo) continue

    const prev = map.get(p.alumno_id)
    if (!prev) {
      map.set(p.alumno_id, p)
      continue
    }
    const totalPrev = prev.pago_importe + prev.pago_recargo
    const totalNew = p.pago_importe + p.pago_recargo
    if (totalNew > totalPrev) {
      map.set(p.alumno_id, p)
      continue
    }
    if (totalNew === totalPrev) {
      const fPrev = (prev.pago_fecha ?? '').slice(0, 10)
      const fNew = (p.pago_fecha ?? '').slice(0, 10)
      if (fNew > fPrev) map.set(p.alumno_id, p)
    }
  }
  return map
}

function fmtMoney(n: number): string {
  return n.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  })
}

export async function cargarCuotaInicioCurso(
  nivel: number,
  ciclo: number
): Promise<ResumenCuotaInicioCurso> {
  const alumnos = await fetchAlumnosActivosNivelCiclo(nivel, ciclo)
  const pagos = await fetchPagosCuotaInicioCiclo(ciclo)
  const pagoPorAlumno = indexPagosPorAlumno(pagos, ciclo)

  // Validar que el pago corresponda al alumno_ref (evita colisiones de like).
  const pagoValidado = new Map<number, Pago00>()
  for (const a of alumnos) {
    const p = pagoPorAlumno.get(a.alumno_id)
    if (!p) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) continue
    if (parsed.alumnoRef !== formatearAlumnoRefParaReferencia(a.alumno_ref)) continue
    pagoValidado.set(a.alumno_id, p)
  }

  const pagados: FilaCuotaInicioPagado[] = []
  const deudores: FilaCuotaInicioDeudor[] = []

  for (const a of alumnos) {
    const grado = etiquetaGradoEscolar(nivel, a.alumno_grado)
    const grupo = etiquetaGrupoEscolar(a.alumno_grupo) || '—'
    const p = pagoValidado.get(a.alumno_id)
    if (p) {
      const monto = Number.isFinite(p.pago_importe) ? p.pago_importe : 0
      const recargo = Number.isFinite(p.pago_recargo) ? p.pago_recargo : 0
      pagados.push({
        no: 0,
        noCtrl: a.alumno_ref,
        nombre: a.nombre,
        grado,
        grupo,
        fechaPago: formatearFechaPago(p.pago_fecha),
        monto,
        recargo,
        total: monto + recargo,
        conRecargo: recargo > 0,
      })
    } else {
      deudores.push({
        no: 0,
        noCtrl: a.alumno_ref,
        nombre: a.nombre,
        grado,
        grupo,
        tipoIngreso: a.alumno_nuevo_ingreso === 1 ? 'Nuevo ingreso' : 'Reinscrito',
      })
    }
  }

  pagados.sort(
    (a, b) =>
      a.grado.localeCompare(b.grado, 'es') ||
      a.grupo.localeCompare(b.grupo, 'es') ||
      a.nombre.localeCompare(b.nombre, 'es')
  )
  deudores.sort(
    (a, b) =>
      a.grado.localeCompare(b.grado, 'es') ||
      a.grupo.localeCompare(b.grupo, 'es') ||
      a.nombre.localeCompare(b.nombre, 'es')
  )
  pagados.forEach((f, i) => {
    f.no = i + 1
  })
  deudores.forEach((f, i) => {
    f.no = i + 1
  })

  const conRecargo = pagados.filter((p) => p.conRecargo).length
  const montoPagado = pagados.reduce((s, p) => s + p.monto, 0)
  const recargoPagado = pagados.reduce((s, p) => s + p.recargo, 0)
  const alumnosN = alumnos.length
  const pctLiquidado = alumnosN > 0 ? Math.round((pagados.length / alumnosN) * 1000) / 10 : 0

  return {
    titulo: 'Cuota de inicio de curso',
    ciclo,
    cicloLabel: etiquetaCicloReporte(ciclo),
    nivel,
    nivelLabel: etiquetaNivelEscolar(nivel),
    pagados,
    deudores,
    totales: {
      alumnos: alumnosN,
      pagados: pagados.length,
      conRecargo,
      deudores: deudores.length,
      montoPagado,
      recargoPagado,
      pctLiquidado,
    },
  }
}

export function fmtMontoCuotaInicio(n: number): string {
  return fmtMoney(n)
}
