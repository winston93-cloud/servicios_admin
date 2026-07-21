import { createDbAdmin } from '@/lib/insforgeAdmin'
import { construirNombreCompleto } from '@/lib/alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaGrupoEscolar } from '@/lib/grupoEscolar'
import { parsearReferenciaPago } from '@/lib/pagoReferenciaColegiatura'
import { CHUNK_ALUMNO_ID_GENERAL, chunkArray, PAGE_ALUMNO } from './dbChunks'
import { fetchPagosPorAlumnos, fetchPagosPorConceptosCiclo } from './fetchDb'
import {
  pagoVigente,
  pagosConceptoBloque,
  tieneConceptoEnCiclo,
} from './pagoReporteHelpers'
import { etiquetaCicloReporte } from './renderDocument'

export type FilaCambridge = {
  no: number
  grado: string
  grupo: string
  noCtrl: string
  nombre: string
  pagosCambridge: string
}

export async function cargarReporteCambridge(cicloEscolar: number) {
  const db = createDbAdmin()
  const { data, error } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_grado, alumno_grupo')
    .eq('alumno_ciclo_escolar', cicloEscolar)
    .eq('alumno_nivel', 4)
    .lt('alumno_grado', 4)
    .not('alumno_status', 'in', '(0,2)')

  if (error) throw new Error(error.message)

  const alumnos = data ?? []

  const ids = alumnos.map((r) => Number(r.alumno_id))
  const pagos = await fetchPagosPorAlumnos(ids)
  const pagosPorAlumno = new Map<number, typeof pagos>()
  for (const p of pagos) {
    const list = pagosPorAlumno.get(p.alumno_id) ?? []
    list.push(p)
    pagosPorAlumno.set(p.alumno_id, list)
  }

  const filas: FilaCambridge[] = []
  for (const r of alumnos) {
    const ref = String(r.alumno_ref ?? '').trim()
    const vigentes = pagosPorAlumno.get(Number(r.alumno_id)) ?? []
    const inscrito = tieneConceptoEnCiclo(vigentes, ref, ['12', '13'], cicloEscolar)
    if (!inscrito) continue

    const hits = pagosConceptoBloque(vigentes, ref, ['19', '20', '22'], cicloEscolar)
    const pagosTxt = hits.map((h) => `${h.concepto} ${h.fecha} $${h.importe}`).join('; ')

    filas.push({
      no: filas.length + 1,
      grado: etiquetaGradoEscolar(4, Number(r.alumno_grado)),
      grupo: etiquetaGrupoEscolar(Number(r.alumno_grupo)),
      noCtrl: ref,
      nombre: construirNombreCompleto(
        String(r.alumno_nombre ?? ''),
        String(r.alumno_app ?? ''),
        String(r.alumno_apm ?? '')
      ),
      pagosCambridge: pagosTxt,
    })
  }

  return {
    titulo: 'Reporte Cambridge',
    cicloLabel: etiquetaCicloReporte(cicloEscolar),
    filas,
  }
}

export function cambridgeATabla(resumen: Awaited<ReturnType<typeof cargarReporteCambridge>>) {
  return {
    headers: ['#', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre', 'Pagos Cambridge'],
    rows: resumen.filas.map((f) => [
      String(f.no),
      f.grado,
      f.grupo,
      f.noCtrl,
      f.nombre,
      f.pagosCambridge,
    ]),
  }
}

type AlumnoDobleRow = {
  alumno_id: number
  alumno_ref: string
  alumno_app: string
  alumno_apm: string
  alumno_nombre: string
  alumno_nivel: number
  alumno_grado: number
  alumno_grupo: number
  alumno_status: number
}

async function fetchAlumnosPorIds(ids: number[]): Promise<AlumnoDobleRow[]> {
  if (!ids.length) return []
  const db = createDbAdmin()
  const out: AlumnoDobleRow[] = []

  for (const slice of chunkArray(ids, CHUNK_ALUMNO_ID_GENERAL)) {
    let offset = 0
    while (true) {
      const { data, error } = await db
        .from('alumno')
        .select(
          'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status'
        )
        .in('alumno_id', slice)
        .range(offset, offset + PAGE_ALUMNO - 1)
      if (error) throw new Error(error.message)
      const chunk = data ?? []
      for (const r of chunk) {
        out.push({
          alumno_id: Number(r.alumno_id),
          alumno_ref: String(r.alumno_ref ?? '').trim(),
          alumno_app: String(r.alumno_app ?? ''),
          alumno_apm: String(r.alumno_apm ?? ''),
          alumno_nombre: String(r.alumno_nombre ?? ''),
          alumno_nivel: Number(r.alumno_nivel),
          alumno_grado: Number(r.alumno_grado),
          alumno_grupo: Number(r.alumno_grupo),
          alumno_status: Number(r.alumno_status),
        })
      }
      if (chunk.length < PAGE_ALUMNO) break
      offset += PAGE_ALUMNO
    }
  }

  return out
}

/**
 * Port de reportes/doble.php.
 * Fuente de verdad: pagos 23/24/25 del ciclo en la referencia (no la ficha actual).
 * Tras el cambio de ciclo las fichas ya están en el destino; filtrar por
 * alumno_ciclo_escolar dejaba el ciclo anterior en blanco.
 */
export async function cargarReporteDoble(cicloEscolar: number) {
  const pagosDoble = await fetchPagosPorConceptosCiclo(
    ['23', '24', '25'],
    cicloEscolar
  )

  const pagosPorAlumno = new Map<number, typeof pagosDoble>()
  for (const p of pagosDoble) {
    if (!pagoVigente(p.pago_cancelado)) continue
    const parsed = parsearReferenciaPago(p.pago_referencia)
    if (!parsed) continue
    if (parsed.cicloEscolar !== cicloEscolar) continue
    if (!['23', '24', '25'].includes(parsed.conceptoNo)) continue
    const list = pagosPorAlumno.get(p.alumno_id) ?? []
    list.push(p)
    pagosPorAlumno.set(p.alumno_id, list)
  }

  const ids = [...pagosPorAlumno.keys()]
  if (!ids.length) {
    return {
      titulo: 'Doble titulación',
      cicloLabel: etiquetaCicloReporte(cicloEscolar),
      filas: [] as {
        no: number
        nivel: string
        grado: string
        grupo: string
        noCtrl: string
        nombre: string
        pagos: string
      }[],
    }
  }

  const alumnos = (await fetchAlumnosPorIds(ids))
    .filter(
      (a) =>
        a.alumno_nivel >= 2 &&
        a.alumno_status !== 0 &&
        a.alumno_status !== 2
    )
    .sort((a, b) => {
      if (a.alumno_nivel !== b.alumno_nivel) return a.alumno_nivel - b.alumno_nivel
      if (a.alumno_grado !== b.alumno_grado) return a.alumno_grado - b.alumno_grado
      if (a.alumno_grupo !== b.alumno_grupo) return a.alumno_grupo - b.alumno_grupo
      const na = construirNombreCompleto(a.alumno_nombre, a.alumno_app, a.alumno_apm)
      const nb = construirNombreCompleto(b.alumno_nombre, b.alumno_app, b.alumno_apm)
      return na.localeCompare(nb, 'es')
    })

  const filas: {
    no: number
    nivel: string
    grado: string
    grupo: string
    noCtrl: string
    nombre: string
    pagos: string
  }[] = []

  for (const r of alumnos) {
    const vigentes = pagosPorAlumno.get(r.alumno_id) ?? []
    const hits = pagosConceptoBloque(
      vigentes,
      r.alumno_ref,
      ['23', '24', '25'],
      cicloEscolar
    )
    if (!hits.length) continue

    const nivel = r.alumno_nivel
    filas.push({
      no: filas.length + 1,
      nivel:
        nivel === 2
          ? 'Kinder'
          : nivel === 3
            ? 'Primaria'
            : nivel === 4
              ? 'Secundaria'
              : String(nivel),
      grado: etiquetaGradoEscolar(nivel, r.alumno_grado),
      grupo: etiquetaGrupoEscolar(r.alumno_grupo),
      noCtrl: r.alumno_ref,
      nombre: construirNombreCompleto(r.alumno_nombre, r.alumno_app, r.alumno_apm),
      pagos: hits
        .map((h) => `${h.fecha} ${h.concepto}${h.importe ? ` $${h.importe}` : ''}`)
        .join('; '),
    })
  }

  return {
    titulo: 'Doble titulación',
    cicloLabel: etiquetaCicloReporte(cicloEscolar),
    filas,
  }
}

export function dobleATabla(resumen: Awaited<ReturnType<typeof cargarReporteDoble>>) {
  return {
    headers: ['#', 'Nivel', 'Grado', 'Grupo', 'No. Ctrl', 'Nombre', 'Pagos'],
    rows: resumen.filas.map((f) => [
      String(f.no),
      f.nivel,
      f.grado,
      f.grupo,
      f.noCtrl,
      f.nombre,
      f.pagos,
    ]),
  }
}
