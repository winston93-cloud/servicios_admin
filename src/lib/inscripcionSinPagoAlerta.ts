import { createDbAdmin } from '@/lib/insforgeAdmin'
import { resolverCicloEscolarSistemaValor } from '@/lib/ciclosEscolaresService'
import { fetchPagosPorConceptosCiclo } from '@/lib/reportes/fetchDb'
import { pagoVigente } from '@/lib/reportes/pagoReporteHelpers'
import { construirNombreCompleto, grupoALetra } from '@/lib/alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'

export const DIAS_SIN_PAGO_INSCRIPCION = 30

/** Referencias dadas desde la temporada de admisiones del ciclo anterior (1 de enero de su año de inicio). */
function inicioVentanaReferencia(ciclo: number): string {
  return `${ciclo - 1 + 2003}-01-01`
}

export type AlumnoSinPagoInscripcion = {
  alumno_id: number
  alumno_ref: number
  nombre: string
  nivel: string
  nivel_num: number
  grado: string
  /** `YYYY-MM-DD` en que se le dio referencia (`alumno_registro`). */
  referencia_desde: string
  dias: number
  /** Pagó solo un diferido (11 o 12) de la inscripción. */
  pago_parcial: boolean
}

function hoyMonterrey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Monterrey' }).format(new Date())
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000)
}

/**
 * Alumnos activos del ciclo actual (referencia dada desde el ciclo anterior), con más de 30 días desde que se les dio referencia
 * y sin inscripción pagada (concepto 13, o los dos diferidos 11 y 12).
 */
export async function alumnosSinPagoInscripcion(niveles: number[]): Promise<AlumnoSinPagoInscripcion[]> {
  if (!niveles.length) return []
  const ciclo = await resolverCicloEscolarSistemaValor()
  const db = createDbAdmin()

  const alumnos: Record<string, unknown>[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_registro')
      .eq('alumno_ciclo_escolar', ciclo)
      // 1 activo; 2 inactivo = nuevo ingreso que aún no paga inscripción (pasa a 1 al pagarla).
      .in('alumno_status', [1, 2])
      .in('alumno_nivel', niveles)
      .order('alumno_id')
      .range(desde, desde + 999)
    if (error) throw new Error(error.message)
    alumnos.push(...((data ?? []) as Record<string, unknown>[]))
    if ((data ?? []).length < 1000) break
  }
  if (!alumnos.length) return []

  const conceptosPorRef = new Map<string, Set<string>>()
  for (const p of await fetchPagosPorConceptosCiclo(['11', '12', '13'], ciclo)) {
    if (!pagoVigente(p.pago_cancelado)) continue
    const ref = String(p.pago_referencia ?? '').replace(/\D/g, '')
    if (ref.length !== 12) continue
    const set = conceptosPorRef.get(ref.slice(0, 5)) ?? new Set<string>()
    set.add(ref.slice(5, 7))
    conceptosPorRef.set(ref.slice(0, 5), set)
  }

  const hoy = hoyMonterrey()
  const desdeVentana = inicioVentanaReferencia(ciclo)
  const out: (AlumnoSinPagoInscripcion & { orden: number[] })[] = []
  for (const a of alumnos) {
    const ref = Number(a.alumno_ref)
    if (!(ref > 0)) continue
    const conceptos = conceptosPorRef.get(String(ref).padStart(5, '0')) ?? new Set<string>()
    if (conceptos.has('13') || (conceptos.has('11') && conceptos.has('12'))) continue

    const registro = a.alumno_registro ? String(a.alumno_registro).slice(0, 10) : null
    if (!registro || registro < desdeVentana) continue
    const dias = diasEntre(registro, hoy)
    if (dias <= DIAS_SIN_PAGO_INSCRIPCION) continue

    const nivelNum = Number(a.alumno_nivel)
    const grupo = grupoALetra(a.alumno_grupo as string | number | null)
    const grado = etiquetaGradoEscolar(nivelNum, a.alumno_grado as string | number | null) || String(a.alumno_grado ?? '')
    out.push({
      alumno_id: Number(a.alumno_id),
      alumno_ref: ref,
      nombre: construirNombreCompleto(
        String(a.alumno_nombre ?? ''),
        String(a.alumno_app ?? ''),
        String(a.alumno_apm ?? '')
      ),
      nivel: etiquetaNivelEscolar(nivelNum) || '',
      nivel_num: nivelNum,
      grado: grupo ? `${grado} ${grupo}` : grado,
      referencia_desde: registro,
      dias,
      pago_parcial: conceptos.size > 0,
      orden: [nivelNum, Number(a.alumno_grado) || 0, Number(a.alumno_grupo) || 0],
    })
  }

  return out
    .sort(
      (x, y) =>
        x.orden[0] - y.orden[0] ||
        x.orden[1] - y.orden[1] ||
        x.orden[2] - y.orden[2] ||
        x.nombre.localeCompare(y.nombre, 'es')
    )
    .map((a) => {
      const { orden, ...resto } = a
      void orden
      return resto
    })
}
