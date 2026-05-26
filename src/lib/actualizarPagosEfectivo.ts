import type { SupabaseClient } from '@supabase/supabase-js'
import { numeroCicloEscolarAdmin } from './cicloEscolarAdmin'

export const ARCHIVOS_PAGO_EFECTIVO = ['colegiaturas.txt', 'inscripciones.txt'] as const
export type ArchivoPagoEfectivo = (typeof ARCHIVOS_PAGO_EFECTIVO)[number]

export type TipoArchivoPagoEfectivo = 'colegiaturas' | 'inscripciones'

export type AccionFilaPago =
  | 'insertado'
  | 'actualizado'
  | 'omitido'
  | 'error'

export type MotivoOmision =
  | 'encabezado_exportar'
  | 'encabezado_factura'
  | 'encabezado_num_factura'
  | 'fila_vacia'
  | 'referencia_tipo_3'
  | 'cargo_cuenta_cheques'
  | 'duplicado'
  | 'alumno_no_encontrado'
  | 'columnas_insuficientes'
  | 'fecha_invalida'
  | 'referencia_invalida'

export interface MuestraFilaPago {
  linea: number
  alumnoRef: string
  referencia: string
  nombre: string
  accion: AccionFilaPago
  motivo?: MotivoOmision | string
  detalle?: string
}

export interface ResumenArchivoPagoEfectivo {
  archivo: ArchivoPagoEfectivo
  tipo: TipoArchivoPagoEfectivo
  lineasLeidas: number
  filasProcesables: number
  insertados: number
  actualizados: number
  omitidos: number
  errores: number
  alumnosActivados: number
  omisionesPorMotivo: Partial<Record<MotivoOmision, number>>
  muestras: MuestraFilaPago[]
  mensaje?: string
}

export interface ResultadoCargaPagosEfectivo {
  ok: boolean
  cicloActivo: number
  cicloSiguiente: number
  archivos: ResumenArchivoPagoEfectivo[]
  erroresGlobales: string[]
  duracionMs: number
}

const MAX_MUESTRAS = 80
const ENCABEZADOS_OMITIR = new Set(['Exportar a', 'FACTURA', 'NumFactura'])

function normalizarNombreArchivo(nombre: string): string {
  return nombre.trim().toLowerCase()
}

export function esArchivoPagoEfectivoPermitido(nombre: string): nombre is ArchivoPagoEfectivo {
  return (ARCHIVOS_PAGO_EFECTIVO as readonly string[]).includes(normalizarNombreArchivo(nombre))
}

export function tipoDesdeArchivo(archivo: ArchivoPagoEfectivo): TipoArchivoPagoEfectivo {
  return archivo === 'inscripciones.txt' ? 'inscripciones' : 'colegiaturas'
}

function limpiarMonto(valor: string | undefined): string {
  return String(valor ?? '').replace(/[$,]/g, '')
}

function normalizarNombre(nombre: string | undefined): string {
  return String(nombre ?? '')
    .replace(/±/g, 'Ñ')
    .trim()
}

function parsearFechaCol14(col14: string | undefined): string | null {
  const raw = String(col14 ?? '')
  if (raw.length < 10) return null
  const dtd = raw.slice(0, 2)
  const dtm = raw.slice(3, 5)
  const dty = raw.slice(6, 10)
  if (!/^\d{2}$/.test(dtd) || !/^\d{2}$/.test(dtm) || !/^\d{4}$/.test(dty)) return null
  return `${dty}-${dtm}-${dtd}`
}

function esConceptoInscripcionAlta(
  referencia: string,
  ceActivo: number,
  ceSiguiente: number
): boolean {
  const bloque = referencia.slice(5, 9)
  return (
    bloque === `13${ceActivo}` ||
    bloque === `12${ceActivo}` ||
    bloque === `13${ceSiguiente}` ||
    bloque === `12${ceSiguiente}`
  )
}

function parsearLineasPipe(contenido: string): string[][] {
  const lineas = contenido.split(/\r?\n/)
  const filas: string[][] = []
  for (const linea of lineas) {
    if (!linea.trim()) continue
    filas.push(linea.split('|'))
  }
  return filas
}

function debeOmitirFila(col: string[]): { omitir: true; motivo: MotivoOmision } | { omitir: false } {
  const c0 = col[0] ?? ''
  if (!c0.length) return { omitir: true, motivo: 'fila_vacia' }
  if (ENCABEZADOS_OMITIR.has(c0)) {
    if (c0 === 'Exportar a') return { omitir: true, motivo: 'encabezado_exportar' }
    if (c0 === 'FACTURA') return { omitir: true, motivo: 'encabezado_factura' }
    return { omitir: true, motivo: 'encabezado_num_factura' }
  }
  const col1 = col[1] ?? ''
  if (col1.length > 28 && col1.charAt(28) === '3') {
    return { omitir: true, motivo: 'referencia_tipo_3' }
  }
  return { omitir: false }
}

export interface FilaPagoEfectivoParseada {
  linea: number
  alumnoRef: string
  referencia: string
  referenciaParcial9: string
  nombre: string
  importe: number
  recargo: number
  forma: string
  folio: string
  fecha: string
  hora: string
  emisora: string
}

function parsearFilaPago(
  col: string[],
  numeroLinea: number
):
  | { ok: true; fila: FilaPagoEfectivoParseada }
  | { ok: false; motivo: MotivoOmision; detalle?: string } {
  const omision = debeOmitirFila(col)
  if (omision.omitir) {
    return { ok: false, motivo: omision.motivo }
  }

  const col1 = col[1] ?? ''
  if (col1.length < 29) {
    return { ok: false, motivo: 'referencia_invalida', detalle: 'Columna de referencia demasiado corta' }
  }

  const referencia = col1.slice(28)
  const alumnoRef = referencia.slice(0, 5)
  if (!/^\d{5}$/.test(alumnoRef)) {
    return { ok: false, motivo: 'referencia_invalida', detalle: `Ref. alumno inválida: ${alumnoRef}` }
  }

  const fecha = parsearFechaCol14(col[14])
  if (!fecha) {
    return { ok: false, motivo: 'fecha_invalida', detalle: col[14] ?? '(vacía)' }
  }

  const importe = Number(limpiarMonto(col[5]))
  const recargo = Number(limpiarMonto(col[6]))
  if (Number.isNaN(importe) || Number.isNaN(recargo)) {
    return { ok: false, motivo: 'columnas_insuficientes', detalle: 'Importe o recargo no numérico' }
  }

  return {
    ok: true,
    fila: {
      linea: numeroLinea,
      alumnoRef,
      referencia,
      referenciaParcial9: referencia.slice(0, 9),
      nombre: normalizarNombre(col[2]),
      importe,
      recargo,
      forma: String(col[9] ?? '').trim(),
      folio: String(col[10] ?? '').trim(),
      fecha,
      hora: String(col[12] ?? '').trim(),
      emisora: String(col[0] ?? '').trim(),
    },
  }
}

async function obtenerAlumnoId(
  supabase: SupabaseClient,
  alumnoRef: string
): Promise<number | null> {
  const refNum = parseInt(alumnoRef, 10)
  const { data, error } = await supabase
    .from('alumno')
    .select('alumno_id')
    .eq('alumno_ref', refNum)
    .maybeSingle()

  if (error || !data?.alumno_id) return null
  return data.alumno_id as number
}

async function existePagoConFolio(
  supabase: SupabaseClient,
  alumnoId: number,
  referencia: string,
  fecha: string,
  folio: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('pago_detalle')
    .select('pago_id', { count: 'exact', head: true })
    .eq('alumno_id', alumnoId)
    .eq('pago_referencia', referencia)
    .eq('pago_fecha', fecha)
    .eq('pago_folio', folio)
    .not('pago_folio', 'is', null)

  if (error) {
    console.error('existePagoConFolio:', error)
    return true
  }
  return (count ?? 0) > 0
}

async function existePagoManual(
  supabase: SupabaseClient,
  alumnoId: number,
  referenciaParcial9: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('pago_detalle')
    .select('pago_id', { count: 'exact', head: true })
    .eq('alumno_id', alumnoId)
    .like('pago_referencia', `%${referenciaParcial9}%`)
    .is('pago_folio', null)

  if (error) {
    console.error('existePagoManual:', error)
    return false
  }
  return (count ?? 0) > 0
}

async function actualizarPagoManual(
  supabase: SupabaseClient,
  alumnoId: number,
  referenciaParcial9: string,
  fila: FilaPagoEfectivoParseada
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('pago_detalle')
    .update({
      pago_nombre: fila.nombre,
      pago_referencia: fila.referencia,
      pago_importe: fila.importe,
      pago_recargo: fila.recargo,
      pago_forma: fila.forma,
      pago_folio: fila.folio,
      pago_fecha: fila.fecha,
      pago_hora: fila.hora,
      pago_emisora: fila.emisora,
      pago_cancelado: 0,
    })
    .eq('alumno_id', alumnoId)
    .like('pago_referencia', `%${referenciaParcial9}%`)
    .is('pago_folio', null)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

async function insertarPago(
  supabase: SupabaseClient,
  alumnoId: number,
  fila: FilaPagoEfectivoParseada
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('pago_detalle').insert({
    alumno_id: alumnoId,
    pago_nombre: fila.nombre,
    pago_referencia: fila.referencia,
    pago_importe: fila.importe,
    pago_recargo: fila.recargo,
    pago_forma: fila.forma,
    pago_folio: fila.folio,
    pago_fecha: fila.fecha,
    pago_hora: fila.hora,
    pago_emisora: fila.emisora,
    pago_cancelado: 0,
    pago_registro: new Date().toISOString(),
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

async function activarAlumnoPorRef(
  supabase: SupabaseClient,
  alumnoRef: string
): Promise<boolean> {
  const refNum = parseInt(alumnoRef, 10)
  const { error } = await supabase
    .from('alumno')
    .update({ alumno_status: 1 })
    .eq('alumno_ref', refNum)

  if (error) {
    console.error('activarAlumnoPorRef:', error)
    return false
  }
  return true
}

function agregarMuestra(resumen: ResumenArchivoPagoEfectivo, muestra: MuestraFilaPago) {
  if (resumen.muestras.length >= MAX_MUESTRAS) return
  resumen.muestras.push(muestra)
}

function contarOmision(resumen: ResumenArchivoPagoEfectivo, motivo: MotivoOmision) {
  resumen.omisionesPorMotivo[motivo] = (resumen.omisionesPorMotivo[motivo] ?? 0) + 1
  resumen.omitidos += 1
}

export async function procesarArchivoPagoEfectivo(
  supabase: SupabaseClient,
  archivo: ArchivoPagoEfectivo,
  contenido: string,
  opciones?: { ceActivo?: number; ceSiguiente?: number }
): Promise<ResumenArchivoPagoEfectivo> {
  const ceActivo = opciones?.ceActivo ?? numeroCicloEscolarAdmin()
  const ceSiguiente = opciones?.ceSiguiente ?? ceActivo + 1

  const resumen: ResumenArchivoPagoEfectivo = {
    archivo,
    tipo: tipoDesdeArchivo(archivo),
    lineasLeidas: 0,
    filasProcesables: 0,
    insertados: 0,
    actualizados: 0,
    omitidos: 0,
    errores: 0,
    alumnosActivados: 0,
    omisionesPorMotivo: {},
    muestras: [],
  }

  const filas = parsearLineasPipe(contenido)
  resumen.lineasLeidas = filas.length

  let numeroLinea = 0
  for (const col of filas) {
    numeroLinea += 1
    const parsed = parsearFilaPago(col, numeroLinea)

    if (!parsed.ok) {
      if (
        parsed.motivo === 'encabezado_exportar' ||
        parsed.motivo === 'encabezado_factura' ||
        parsed.motivo === 'encabezado_num_factura' ||
        parsed.motivo === 'fila_vacia' ||
        parsed.motivo === 'referencia_tipo_3'
      ) {
        contarOmision(resumen, parsed.motivo)
        continue
      }
      contarOmision(resumen, parsed.motivo)
      agregarMuestra(resumen, {
        linea: numeroLinea,
        alumnoRef: col[1]?.slice(28, 33) ?? '—',
        referencia: '—',
        nombre: normalizarNombre(col[2]),
        accion: 'omitido',
        motivo: parsed.motivo,
        detalle: parsed.detalle,
      })
      continue
    }

    const fila = parsed.fila
    resumen.filasProcesables += 1

    if (fila.forma === 'CargoCuentaCheques') {
      contarOmision(resumen, 'cargo_cuenta_cheques')
      agregarMuestra(resumen, {
        linea: fila.linea,
        alumnoRef: fila.alumnoRef,
        referencia: fila.referencia,
        nombre: fila.nombre,
        accion: 'omitido',
        motivo: 'cargo_cuenta_cheques',
      })
      continue
    }

    const alumnoId = await obtenerAlumnoId(supabase, fila.alumnoRef)
    if (alumnoId == null) {
      contarOmision(resumen, 'alumno_no_encontrado')
      agregarMuestra(resumen, {
        linea: fila.linea,
        alumnoRef: fila.alumnoRef,
        referencia: fila.referencia,
        nombre: fila.nombre,
        accion: 'omitido',
        motivo: 'alumno_no_encontrado',
      })
      continue
    }

    const manual = await existePagoManual(supabase, alumnoId, fila.referenciaParcial9)
    if (manual) {
      const upd = await actualizarPagoManual(supabase, alumnoId, fila.referenciaParcial9, fila)
      if (upd.ok) {
        resumen.actualizados += 1
        agregarMuestra(resumen, {
          linea: fila.linea,
          alumnoRef: fila.alumnoRef,
          referencia: fila.referencia,
          nombre: fila.nombre,
          accion: 'actualizado',
          detalle: 'Pago manual (sin folio)',
        })
      } else {
        resumen.errores += 1
        agregarMuestra(resumen, {
          linea: fila.linea,
          alumnoRef: fila.alumnoRef,
          referencia: fila.referencia,
          nombre: fila.nombre,
          accion: 'error',
          detalle: upd.error ?? 'Error al actualizar',
        })
      }
      continue
    }

    const duplicado = await existePagoConFolio(
      supabase,
      alumnoId,
      fila.referencia,
      fila.fecha,
      fila.folio
    )
    if (duplicado) {
      contarOmision(resumen, 'duplicado')
      agregarMuestra(resumen, {
        linea: fila.linea,
        alumnoRef: fila.alumnoRef,
        referencia: fila.referencia,
        nombre: fila.nombre,
        accion: 'omitido',
        motivo: 'duplicado',
      })
      continue
    }

    const ins = await insertarPago(supabase, alumnoId, fila)
    if (ins.ok) {
      resumen.insertados += 1
      agregarMuestra(resumen, {
        linea: fila.linea,
        alumnoRef: fila.alumnoRef,
        referencia: fila.referencia,
        nombre: fila.nombre,
        accion: 'insertado',
      })

      if (esConceptoInscripcionAlta(fila.referencia, ceActivo, ceSiguiente)) {
        const activado = await activarAlumnoPorRef(supabase, fila.alumnoRef)
        if (activado) resumen.alumnosActivados += 1
      }
    } else {
      resumen.errores += 1
      agregarMuestra(resumen, {
        linea: fila.linea,
        alumnoRef: fila.alumnoRef,
        referencia: fila.referencia,
        nombre: fila.nombre,
        accion: 'error',
        detalle: ins.error ?? 'Error al insertar',
      })
    }
  }

  resumen.mensaje = `Procesado ${archivo}: ${resumen.insertados} insertados, ${resumen.actualizados} actualizados.`
  return resumen
}

export async function procesarCargaPagosEfectivo(
  supabase: SupabaseClient,
  archivos: { nombre: ArchivoPagoEfectivo; contenido: string }[]
): Promise<ResultadoCargaPagosEfectivo> {
  const inicio = Date.now()
  const ceActivo = numeroCicloEscolarAdmin()
  const ceSiguiente = ceActivo + 1
  const erroresGlobales: string[] = []
  const resultados: ResumenArchivoPagoEfectivo[] = []

  const orden: ArchivoPagoEfectivo[] = ['colegiaturas.txt', 'inscripciones.txt']
  const porNombre = new Map(archivos.map((a) => [a.nombre, a.contenido]))

  for (const nombre of orden) {
    const contenido = porNombre.get(nombre)
    if (!contenido) continue
    try {
      const res = await procesarArchivoPagoEfectivo(supabase, nombre, contenido, {
        ceActivo,
        ceSiguiente,
      })
      resultados.push(res)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      erroresGlobales.push(`${nombre}: ${msg}`)
      resultados.push({
        archivo: nombre,
        tipo: tipoDesdeArchivo(nombre),
        lineasLeidas: 0,
        filasProcesables: 0,
        insertados: 0,
        actualizados: 0,
        omitidos: 0,
        errores: 1,
        alumnosActivados: 0,
        omisionesPorMotivo: {},
        muestras: [],
        mensaje: `Falló el procesamiento: ${msg}`,
      })
    }
  }

  return {
    ok: erroresGlobales.length === 0 && resultados.every((r) => r.errores === 0),
    cicloActivo: ceActivo,
    cicloSiguiente: ceSiguiente,
    archivos: resultados,
    erroresGlobales,
    duracionMs: Date.now() - inicio,
  }
}
