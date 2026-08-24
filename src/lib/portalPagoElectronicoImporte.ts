/**
 * Importe para cobro electrónico (SPEI / OpenPay).
 * Debe coincidir con lo que muestra la matriz del portal (diferidos, prórrogas, etc.).
 * `calcularBoucher` solo no basta para 11/12: usa inscripción completa.
 */
import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { AlumnoRegistro } from '@/lib/alumnoDatosService'
import { parseImporteBoucher } from '@/lib/boucherCore'
import { calcularBoucher } from '@/lib/boucherService'
import { normalizarConceptoNo } from '@/lib/pagoReferenciaColegiatura'
import { esConceptoInscripcionReinscripcion } from '@/lib/nivelCobroElectronico'
import { calcularReinscripcionDiferido } from '@/lib/portalReinscripcionService'
import { omitirRecargosAdeudoEgresado } from '@/lib/adeudosEgresadosService'

export type ImporteElectronico = {
  importe: number
  importeLinea: number
  recargo: number
  /** Monto a cobrar en SPEI/tarjeta. */
  montoCobro: number
}

export async function resolverImportePagoElectronico(opts: {
  db: AppDatabaseClient
  alumno: AlumnoRegistro
  conceptoNo: string
  cicloEscolar: number
  cicloTemporada?: number | null
  planMeses: number
  /** Importe que ya vio el padre en la matriz/modal (validado en servidor). */
  importeCliente?: number | string | null
}): Promise<ImporteElectronico> {
  const conceptoNo = normalizarConceptoNo(opts.conceptoNo)
  const omitirRecargos = await omitirRecargosAdeudoEgresado(
    opts.db,
    opts.alumno.alumno_id,
    opts.cicloEscolar
  )

  const cliente =
    opts.importeCliente != null && opts.importeCliente !== ''
      ? parseImporteBoucher(opts.importeCliente)
      : null

  // Pago anual: la matriz ya trae plan − 5%; confiar si viene > 0.
  if (conceptoNo === '30' && cliente != null && cliente > 0) {
    return {
      importe: cliente,
      importeLinea: cliente,
      recargo: 0,
      montoCobro: cliente,
    }
  }

  // Paquete de colegiaturas (31): boucher lo deja en 0; el monto vive en alumno_pago_colegiaturas.
  if (conceptoNo === '31') {
    const { obtenerRegistroPagoColegiaturas } = await import(
      '@/lib/pagoColegiaturasPaqueteService'
    )
    const reg = await obtenerRegistroPagoColegiaturas(
      opts.db,
      opts.alumno.alumno_id,
      opts.cicloEscolar
    )
    const montoPaquete =
      reg?.activo && !reg.pagado ? Math.round((Number(reg.monto) || 0) * 100) / 100 : 0
    const monto = montoPaquete > 0 ? montoPaquete : cliente != null && cliente > 0 ? cliente : 0
    if (monto > 0) {
      return {
        importe: monto,
        importeLinea: monto,
        recargo: 0,
        montoCobro: monto,
      }
    }
  }

  // Reinscripción / diferidos: mismo motor que el portal (no lista completa).
  if (esConceptoInscripcionReinscripcion(conceptoNo)) {
    const cicloTemp =
      opts.cicloTemporada != null && Number.isFinite(Number(opts.cicloTemporada))
        ? Number(opts.cicloTemporada)
        : opts.cicloEscolar

    const dif = await calcularReinscripcionDiferido(opts.db, opts.alumno, cicloTemp)
    if (
      dif?.pagable &&
      dif.monto > 0 &&
      normalizarConceptoNo(dif.concepto) === conceptoNo
    ) {
      const monto = Math.round(dif.monto * 100) / 100
      return {
        importe: monto,
        importeLinea: monto,
        recargo: 0,
        montoCobro: monto,
      }
    }

    // Nuevo ingreso / sin fase pagable: boucher (acepta importe de matriz si viene).
    const calc = await calcularBoucher(opts.db, {
      alumnoId: opts.alumno.alumno_id,
      alumnoRef: opts.alumno.alumno_ref,
      alumnoNivel: opts.alumno.alumno_nivel,
      alumnoGrado: Number(opts.alumno.alumno_grado) || 0,
      conceptoNo,
      cicloEscolar: opts.cicloEscolar,
      planMeses: opts.planMeses,
      omitirRecargos,
      importeManual: cliente != null && cliente > 0 ? cliente : null,
      alumnoNuevoIngreso: opts.alumno.alumno_nuevo_ingreso,
      alumnoAlta: opts.alumno.alumno_alta ?? null,
    })
    const montoCobro = calc.importeLinea > 0 ? calc.importeLinea : calc.importe
    return { ...calc, montoCobro }
  }

  const calc = await calcularBoucher(opts.db, {
    alumnoId: opts.alumno.alumno_id,
    alumnoRef: opts.alumno.alumno_ref,
    alumnoNivel: opts.alumno.alumno_nivel,
    alumnoGrado: Number(opts.alumno.alumno_grado) || 0,
    conceptoNo,
    cicloEscolar: opts.cicloEscolar,
    planMeses: opts.planMeses,
    omitirRecargos,
    importeManual: null,
    alumnoNuevoIngreso: opts.alumno.alumno_nuevo_ingreso,
    alumnoAlta: opts.alumno.alumno_alta ?? null,
  })
  const montoCobro = calc.importeLinea > 0 ? calc.importeLinea : calc.importe
  return { ...calc, montoCobro }
}
