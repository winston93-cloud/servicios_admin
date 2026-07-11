import type { AppDatabaseClient } from '@/lib/dbTypes'
import type { PrecioBoucherRow } from './boucherService'
import { obtenerPrecioFila } from './boucherService'

export type CostoBoucherInput = {
  precio_inscripcion: number
  precio_agosto: number
  precio_colegiatura: number
  precio_colegiatura2: number
  /** Evaluación y Herramientas Tecnológicas (concepto 17). */
  precio_material: number
  precio_cuota_padres: number
  precio_cambridge: number
  precio_dtitulacion: number
  descuento_cambio_nivel: number
  descuento_cambio_grado: number
}

function mapRow(data: Record<string, unknown>): PrecioBoucherRow {
  return {
    precio_id: Number(data.precio_id),
    alumno_nivel: Number(data.alumno_nivel),
    precio_inscripcion: Number(data.precio_inscripcion),
    precio_material: Number(data.precio_material),
    precio_seguro: Number(data.precio_seguro),
    precio_cuota_padres: Number(data.precio_cuota_padres),
    precio_agosto: Number(data.precio_agosto),
    precio_colegiatura: Number(data.precio_colegiatura),
    precio_colegiatura2: Number(data.precio_colegiatura2),
    precio_cambridge: Number(data.precio_cambridge),
    precio_dtitulacion: Number(data.precio_dtitulacion),
    descuento_cambio_nivel: Number(data.descuento_cambio_nivel),
    descuento_cambio_grado: Number(data.descuento_cambio_grado),
    precio_ciclo_escolar: Number(data.precio_ciclo_escolar),
  }
}

export async function listarPreciosCompletosPorCiclo(
  db: AppDatabaseClient,
  cicloEscolar: number
): Promise<PrecioBoucherRow[]> {
  const { data, error } = await db
    .from('pago_boucher_precio')
    .select('*')
    .eq('precio_ciclo_escolar', cicloEscolar)
    .order('alumno_nivel')

  if (error) {
    if (/does not exist|relation/i.test(error.message)) {
      throw new Error(
        'La tabla pago_boucher_precio no está disponible. Revisa migraciones / import.'
      )
    }
    throw new Error(error.message)
  }

  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>))
}

async function siguientePrecioId(db: AppDatabaseClient): Promise<number> {
  const { data, error } = await db
    .from('pago_boucher_precio')
    .select('precio_id')
    .order('precio_id', { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)
  const max = data?.[0]?.precio_id != null ? Number(data[0].precio_id) : 0
  return max + 1
}

function normalizarMontos(input: CostoBoucherInput): CostoBoucherInput {
  const n = (v: number) => {
    const x = Number(v)
    if (!Number.isFinite(x) || x < 0) {
      throw new Error('Los montos deben ser números ≥ 0')
    }
    return Math.round(x * 100) / 100
  }
  const pct = (v: number) => {
    const x = Number(v)
    if (!Number.isFinite(x) || x < 0 || x > 100) {
      throw new Error('Los descuentos deben estar entre 0 y 100')
    }
    return Math.round(x)
  }

  return {
    precio_inscripcion: n(input.precio_inscripcion),
    precio_agosto: n(input.precio_agosto),
    precio_colegiatura: n(input.precio_colegiatura),
    precio_colegiatura2: n(input.precio_colegiatura2),
    precio_material: n(input.precio_material),
    precio_cuota_padres: n(input.precio_cuota_padres),
    precio_cambridge: n(input.precio_cambridge),
    precio_dtitulacion: n(input.precio_dtitulacion),
    descuento_cambio_nivel: pct(input.descuento_cambio_nivel),
    descuento_cambio_grado: pct(input.descuento_cambio_grado),
  }
}

export async function upsertPrecioBoucher(
  db: AppDatabaseClient,
  cicloEscolar: number,
  nivel: number,
  input: CostoBoucherInput
): Promise<PrecioBoucherRow> {
  if (!nivel || nivel < 1 || nivel > 4) {
    throw new Error('nivel 1-4 requerido')
  }
  if (!Number.isFinite(cicloEscolar) || cicloEscolar <= 0) {
    throw new Error('ciclo escolar requerido')
  }

  const montos = normalizarMontos(input)
  const existente = await obtenerPrecioFila(db, nivel, cicloEscolar)

  const payload = {
    alumno_nivel: nivel,
    precio_ciclo_escolar: cicloEscolar,
    precio_inscripcion: montos.precio_inscripcion,
    precio_agosto: montos.precio_agosto,
    precio_colegiatura: montos.precio_colegiatura,
    precio_colegiatura2: montos.precio_colegiatura2,
    precio_material: montos.precio_material,
    // Concepto 17 = material + seguro; un solo monto en UI → seguro en 0
    precio_seguro: 0,
    precio_cuota_padres: montos.precio_cuota_padres,
    precio_cambridge: montos.precio_cambridge,
    precio_dtitulacion: montos.precio_dtitulacion,
    descuento_cambio_nivel: montos.descuento_cambio_nivel,
    descuento_cambio_grado: montos.descuento_cambio_grado,
  }

  if (existente) {
    const { data, error } = await db
      .from('pago_boucher_precio')
      .update(payload)
      .eq('precio_id', existente.precio_id)
      .select('*')
      .single()

    if (error || !data) {
      throw new Error(error?.message ?? 'No se pudo actualizar el precio')
    }
    return mapRow(data as Record<string, unknown>)
  }

  const precio_id = await siguientePrecioId(db)
  const { data, error } = await db
    .from('pago_boucher_precio')
    .insert({ precio_id, ...payload })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'No se pudo crear el precio')
  }
  return mapRow(data as Record<string, unknown>)
}

export async function copiarPreciosCiclo(
  db: AppDatabaseClient,
  cicloOrigen: number,
  cicloDestino: number
): Promise<{ copiados: number }> {
  if (cicloOrigen === cicloDestino) {
    throw new Error('El ciclo origen y destino deben ser distintos')
  }
  if (!cicloOrigen || !cicloDestino) {
    throw new Error('cicloOrigen y cicloDestino requeridos')
  }

  const origen = await listarPreciosCompletosPorCiclo(db, cicloOrigen)
  if (origen.length === 0) {
    throw new Error(`No hay precios en el ciclo ${cicloOrigen}`)
  }

  let copiados = 0
  for (const fila of origen) {
    await upsertPrecioBoucher(db, cicloDestino, fila.alumno_nivel, {
      precio_inscripcion: fila.precio_inscripcion,
      precio_agosto: fila.precio_agosto,
      precio_colegiatura: fila.precio_colegiatura,
      precio_colegiatura2: fila.precio_colegiatura2,
      precio_material: fila.precio_material + fila.precio_seguro,
      precio_cuota_padres: fila.precio_cuota_padres,
      precio_cambridge: fila.precio_cambridge,
      precio_dtitulacion: fila.precio_dtitulacion,
      descuento_cambio_nivel: fila.descuento_cambio_nivel,
      descuento_cambio_grado: fila.descuento_cambio_grado,
    })
    copiados += 1
  }

  return { copiados }
}
