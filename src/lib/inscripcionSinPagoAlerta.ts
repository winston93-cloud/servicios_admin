import { createDbAdmin } from '@/lib/insforgeAdmin'
import { resolverCicloEscolarSistemaValor } from '@/lib/ciclosEscolaresService'
import { fetchPagosPorConceptosCiclo } from '@/lib/reportes/fetchDb'
import { pagoVigente } from '@/lib/reportes/pagoReporteHelpers'
import { construirNombreCompleto, grupoALetra } from '@/lib/alumnoBusquedaServicios'
import { etiquetaGradoEscolar } from '@/lib/gradoEscolar'
import { etiquetaNivelEscolar } from '@/lib/nivelEscolar'

export const DIAS_SIN_PAGO_INSCRIPCION = 30

export type CicloAlertaInscripcion = {
  valor: number
  /** `2026-2027` */
  nombre: string
  /** `YYYY-MM-DD` del cambio de ciclo (`inicio_ciclo`); si falta, inicio de clases o 1 de julio. */
  inicio: string
}

/** Ciclo marcado como actual (`es_actual`) con su fecha de inicio. */
export async function cicloActualAlertaInscripcion(): Promise<CicloAlertaInscripcion> {
  const { data, error } = await createDbAdmin()
    .from('ciclos_escolares')
    .select('valor, nombre, inicio_ciclo, inicio_clases')
    .eq('es_actual', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const fila = data as Record<string, unknown> | null
  const valor =
    fila?.valor != null && Number.isFinite(Number(fila.valor))
      ? Number(fila.valor)
      : await resolverCicloEscolarSistemaValor()
  const nombre = String(fila?.nombre ?? '').trim() || `${valor + 2003}-${valor + 2004}`
  const inicio =
    String(fila?.inicio_ciclo ?? '').slice(0, 10) ||
    String(fila?.inicio_clases ?? '').slice(0, 10) ||
    `${valor + 2003}-07-01`
  return { valor, nombre, inicio }
}

export type AlumnoSinPagoInscripcion = {
  alumno_id: number
  alumno_ref: number
  nombre: string
  nivel: string
  nivel_num: number
  grado: string
  /** `YYYY-MM-DD` desde el que corren los días: inicio de ciclo o referencia, la más reciente. */
  cuenta_desde: string
  /** `ciclo` = reinscrito o referencia previa al ciclo; `referencia` = nuevo ingreso ya iniciado el ciclo. */
  cuenta_por: 'ciclo' | 'referencia'
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
 * Alumnos activos del ciclo actual sin inscripción pagada (concepto 13, o los dos diferidos 11 y 12) con más de
 * 30 días contados desde la más reciente entre el inicio del ciclo y el día en que se les dio referencia
 * (`alumno_registro`). Sin fecha de referencia no entran.
 */
export async function alumnosSinPagoInscripcion(
  niveles: number[],
  ciclo: CicloAlertaInscripcion
): Promise<AlumnoSinPagoInscripcion[]> {
  if (!niveles.length) return []
  const db = createDbAdmin()

  const alumnos: Record<string, unknown>[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_registro')
      .eq('alumno_ciclo_escolar', ciclo.valor)
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
  for (const p of await fetchPagosPorConceptosCiclo(['11', '12', '13'], ciclo.valor)) {
    if (!pagoVigente(p.pago_cancelado)) continue
    const ref = String(p.pago_referencia ?? '').replace(/\D/g, '')
    if (ref.length !== 12) continue
    const set = conceptosPorRef.get(ref.slice(0, 5)) ?? new Set<string>()
    set.add(ref.slice(5, 7))
    conceptosPorRef.set(ref.slice(0, 5), set)
  }

  const hoy = hoyMonterrey()
  const out: (AlumnoSinPagoInscripcion & { orden: number[] })[] = []
  for (const a of alumnos) {
    const ref = Number(a.alumno_ref)
    if (!(ref > 0)) continue
    const conceptos = conceptosPorRef.get(String(ref).padStart(5, '0')) ?? new Set<string>()
    if (conceptos.has('13') || (conceptos.has('11') && conceptos.has('12'))) continue

    const registro = a.alumno_registro ? String(a.alumno_registro).slice(0, 10) : null
    if (!registro) continue
    const cuentaPor = registro > ciclo.inicio ? 'referencia' : 'ciclo'
    const cuentaDesde = cuentaPor === 'referencia' ? registro : ciclo.inicio
    const dias = diasEntre(cuentaDesde, hoy)
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
      cuenta_desde: cuentaDesde,
      cuenta_por: cuentaPor,
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
