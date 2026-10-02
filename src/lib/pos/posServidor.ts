import { createDbAdmin } from '@/lib/insforgeAdmin'
import { buscarAlumnosServicios, construirNombreCompleto, escaparIlike } from '@/lib/alumnoBusquedaServicios'
import { numeroCicloEscolarAdmin } from '@/lib/cicloEscolarAdmin'
import {
  esFechaIso,
  fechaMx,
  sumarDias,
  tipoClienteDeRef,
  type PosCliente,
  type PosExterno,
  type PosExternoInput,
  type PosPago,
  type PosProducto,
  type PosProductoInput,
  type PosReporteContable,
  type PosResumenDia,
  type PosResumenServicio,
  type PosVentaRequest,
  type PosVentaResultado,
} from './posTipos'

export class PosError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

/** Pagado en caja y servicio de emergencia; 2 = reservado (portal), 0 = cancelado. */
const ESTATUS_VIGENTES = [1, 3]
const ESTATUS_CANCELADO = 0

const MAX_PARTIDAS = 120
const MAX_CANTIDAD = 20

function db() {
  return createDbAdmin()
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

function texto(v: unknown, max = 200): string {
  return String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function fechaDeColumna(v: unknown): string {
  return String(v ?? '').slice(0, 10)
}

function lanzar(error: { message?: string } | null, contexto: string): void {
  if (error) throw new PosError(`${contexto}: ${error.message ?? 'error de base de datos'}`, 500)
}

/* ───────────────────────── Catálogo ───────────────────────── */

type FilaConcepto = {
  id: number
  desayuno_nombre: string
  desayuno_abreviatura: string
  costo: number | string
  monto_ludi: number | string | null
  codigo_reporte: string | null
  orden: number | null
  activo: boolean | null
}

function mapProducto(r: FilaConcepto): PosProducto {
  return {
    id: Number(r.id),
    nombre: String(r.desayuno_nombre ?? '').trim(),
    abreviatura: String(r.desayuno_abreviatura ?? '').trim().toLowerCase(),
    costo: num(r.costo),
    montoLudi: num(r.monto_ludi),
    codigoReporte: r.codigo_reporte ? String(r.codigo_reporte).trim() : null,
    orden: Number(r.orden ?? 0),
    activo: r.activo !== false,
  }
}

export async function listarProductos(incluirInactivos = false): Promise<PosProducto[]> {
  const { data, error } = await db()
    .from('concepto_desayunos')
    .select('id, desayuno_nombre, desayuno_abreviatura, costo, monto_ludi, codigo_reporte, orden, activo')
    .order('orden', { ascending: true })
    .order('id', { ascending: true })
  lanzar(error, 'No se pudo leer el catálogo')
  const productos = ((data ?? []) as FilaConcepto[]).map(mapProducto)
  return incluirInactivos ? productos : productos.filter((p) => p.activo)
}

export async function guardarProducto(input: PosProductoInput): Promise<PosProducto> {
  const nombre = texto(input.nombre, 80)
  const abreviatura = texto(input.abreviatura, 10).toLowerCase().replace(/\s+/g, '')
  const costo = Math.round(num(input.costo) * 100) / 100
  const montoLudi = Math.round(num(input.montoLudi) * 100) / 100
  const codigoReporte = texto(input.codigoReporte, 20).toUpperCase() || null

  if (!nombre) throw new PosError('El nombre es obligatorio.')
  if (!abreviatura) throw new PosError('El código rápido es obligatorio.')
  if (costo <= 0) throw new PosError('El precio debe ser mayor a cero.')
  if (montoLudi < 0 || montoLudi > costo) {
    throw new PosError('El monto de Ludy debe estar entre 0 y el precio.')
  }

  const todos = await listarProductos(true)
  const duplicado = todos.find(
    (p) => p.abreviatura === abreviatura && p.id !== input.id && p.activo
  )
  if (duplicado) {
    throw new PosError(`El código «${abreviatura}» ya lo usa ${duplicado.nombre}.`)
  }

  const fila = {
    desayuno_nombre: nombre,
    desayuno_abreviatura: abreviatura,
    costo,
    monto_ludi: montoLudi,
    codigo_reporte: codigoReporte,
    activo: input.activo !== false,
  }

  if (input.id) {
    const { data, error } = await db()
      .from('concepto_desayunos')
      .update(fila)
      .eq('id', input.id)
      .select()
      .single()
    lanzar(error, 'No se pudo actualizar el producto')
    return mapProducto(data as FilaConcepto)
  }

  const orden = todos.reduce((m, p) => Math.max(m, p.orden), 0) + 1
  const { data, error } = await db()
    .from('concepto_desayunos')
    .insert([{ ...fila, orden }])
    .select()
    .single()
  lanzar(error, 'No se pudo crear el producto')
  return mapProducto(data as FilaConcepto)
}

/* ───────────────────────── Externos ───────────────────────── */

type FilaPersonal = {
  id: number
  personal_nombre: string | null
  personal_app: string | null
  personal_apm: string | null
  personal_nombre_completo: string | null
}

function mapExterno(r: FilaPersonal): PosExterno {
  const nombre = String(r.personal_nombre ?? '').trim()
  const app = String(r.personal_app ?? '').trim()
  const apm = String(r.personal_apm ?? '').trim()
  return {
    id: Number(r.id),
    nombre,
    app,
    apm,
    nombreCompleto:
      String(r.personal_nombre_completo ?? '').trim() || construirNombreCompleto(nombre, app, apm),
  }
}

export async function listarExternos(): Promise<PosExterno[]> {
  const { data, error } = await db()
    .from('personal')
    .select('id, personal_nombre, personal_app, personal_apm, personal_nombre_completo')
    .order('personal_nombre_completo', { ascending: true })
  lanzar(error, 'No se pudo leer la lista de externos')
  return ((data ?? []) as FilaPersonal[]).map(mapExterno)
}

export async function guardarExterno(input: PosExternoInput): Promise<PosExterno> {
  const nombre = texto(input.nombre, 60)
  const app = texto(input.app, 60)
  const apm = texto(input.apm, 60)
  if (!nombre || !app) throw new PosError('Nombre y apellido paterno son obligatorios.')
  const fila = {
    personal_nombre: nombre,
    personal_app: app,
    personal_apm: apm,
    personal_nombre_completo: construirNombreCompleto(nombre, app, apm),
  }
  const q = input.id
    ? db().from('personal').update(fila).eq('id', input.id)
    : db().from('personal').insert([fila])
  const { data, error } = await q.select().single()
  lanzar(error, 'No se pudo guardar el externo')
  return mapExterno(data as FilaPersonal)
}

export async function eliminarExterno(id: number): Promise<void> {
  const { error } = await db().from('personal').delete().eq('id', id)
  lanzar(error, 'No se pudo eliminar el externo')
}

/* ───────────────────────── Clientes ───────────────────────── */

type FilaMaestro = {
  maestro_id: number
  maestro_nombre: string | null
  maestro_app: string | null
  maestro_apm: string | null
}

function mapMaestro(m: FilaMaestro): PosCliente {
  return {
    ref: `P${m.maestro_id}`,
    nombre: construirNombreCompleto(
      String(m.maestro_nombre ?? '').trim(),
      String(m.maestro_app ?? '').trim(),
      String(m.maestro_apm ?? '').trim()
    ),
    tipo: 'maestro',
    nivel: null,
    grado: null,
    grupo: null,
  }
}

function mapExternoCliente(e: PosExterno): PosCliente {
  return { ref: `E${e.id}`, nombre: e.nombreCompleto, tipo: 'externo', nivel: null, grado: null, grupo: null }
}

export async function buscarClientes(consulta: string): Promise<PosCliente[]> {
  const q = texto(consulta, 80)
  if (q.length < 2) return []

  const tokens = q.split(' ').filter((t) => t.length >= 2)
  const orMaestro = new Set<string>()
  const orExterno = new Set<string>()
  for (const t of [q, ...tokens]) {
    const p = `%${escaparIlike(t)}%`
    orMaestro.add(`maestro_nombre.ilike.${p}`)
    orMaestro.add(`maestro_app.ilike.${p}`)
    orMaestro.add(`maestro_apm.ilike.${p}`)
    orExterno.add(`personal_nombre_completo.ilike.${p}`)
  }
  const refMaestro = /^p(\d+)$/i.exec(q)
  const refExterno = /^e(\d+)$/i.exec(q)

  const [alumnos, maestros, externos] = await Promise.all([
    buscarAlumnosServicios(q, numeroCicloEscolarAdmin(), { db: db() }),
    db()
      .from('boleta_maestro')
      .select('maestro_id, maestro_nombre, maestro_app, maestro_apm')
      .or(refMaestro ? `maestro_id.eq.${refMaestro[1]}` : [...orMaestro].join(','))
      .order('maestro_app', { ascending: true })
      .limit(6),
    db()
      .from('personal')
      .select('id, personal_nombre, personal_app, personal_apm, personal_nombre_completo')
      .or(refExterno ? `id.eq.${refExterno[1]}` : [...orExterno].join(','))
      .limit(4),
  ])

  const tokensNorm = tokens.map((t) => t.toLowerCase())
  const coincideTodo = (nombre: string) => {
    const n = nombre.toLowerCase()
    return tokensNorm.every((t) => n.includes(t))
  }

  const resultado: PosCliente[] = alumnos.slice(0, 8).map((a) => ({
    ref: String(a.alumno_ref ?? ''),
    nombre: a.nombre_completo,
    tipo: 'alumno',
    nivel: a.alumno_nivel != null ? Number(a.alumno_nivel) : null,
    grado: a.alumno_grado != null ? String(a.alumno_grado) : null,
    grupo: a.alumno_grupo != null ? String(a.alumno_grupo) : null,
  }))

  const vistos = new Set<number>()
  for (const m of (maestros.data ?? []) as FilaMaestro[]) {
    if (vistos.has(m.maestro_id)) continue
    vistos.add(m.maestro_id)
    const c = mapMaestro(m)
    if (refMaestro || coincideTodo(c.nombre)) resultado.push(c)
  }
  for (const e of (externos.data ?? []) as FilaPersonal[]) {
    const c = mapExternoCliente(mapExterno(e))
    if (refExterno || coincideTodo(c.nombre)) resultado.push(c)
  }
  return resultado.slice(0, 12)
}

type FilaAlumnoRef = {
  alumno_ref: string
  alumno_nombre: string | null
  alumno_app: string | null
  alumno_apm: string | null
  alumno_nivel: number | null
  alumno_grado: string | number | null
  alumno_grupo: string | null
  alumno_ciclo_escolar: number | string | null
}

/** Resuelve nombre y nivel de cada referencia (alumno, `P…` maestro, `E…` externo). */
async function resolverClientes(refs: string[]): Promise<Map<string, PosCliente>> {
  const mapa = new Map<string, PosCliente>()
  const unicos = [...new Set(refs.map((r) => String(r ?? '').trim()).filter(Boolean))]
  const alumnoRefs = unicos.filter((r) => tipoClienteDeRef(r) === 'alumno')
  const maestroIds = unicos.filter((r) => tipoClienteDeRef(r) === 'maestro').map((r) => Number(r.slice(1)))
  const externoIds = unicos.filter((r) => tipoClienteDeRef(r) === 'externo').map((r) => Number(r.slice(1)))

  const [alumnos, maestros, externos] = await Promise.all([
    alumnoRefs.length
      ? db()
          .from('alumno')
          .select(
            'alumno_ref, alumno_nombre, alumno_app, alumno_apm, alumno_nivel, alumno_grado, alumno_grupo, alumno_ciclo_escolar'
          )
          .in('alumno_ref', alumnoRefs)
      : Promise.resolve({ data: [] as FilaAlumnoRef[] }),
    maestroIds.length
      ? db()
          .from('boleta_maestro')
          .select('maestro_id, maestro_nombre, maestro_app, maestro_apm')
          .in('maestro_id', maestroIds)
      : Promise.resolve({ data: [] as FilaMaestro[] }),
    externoIds.length
      ? db()
          .from('personal')
          .select('id, personal_nombre, personal_app, personal_apm, personal_nombre_completo')
          .in('id', externoIds)
      : Promise.resolve({ data: [] as FilaPersonal[] }),
  ])

  const cicloDe = new Map<string, number>()
  for (const a of (alumnos.data ?? []) as FilaAlumnoRef[]) {
    const ref = String(a.alumno_ref).trim()
    const ciclo = num(a.alumno_ciclo_escolar)
    if ((cicloDe.get(ref) ?? -1) > ciclo) continue
    cicloDe.set(ref, ciclo)
    mapa.set(ref, {
      ref,
      nombre: construirNombreCompleto(
        String(a.alumno_nombre ?? '').trim(),
        String(a.alumno_app ?? '').trim(),
        String(a.alumno_apm ?? '').trim()
      ),
      tipo: 'alumno',
      nivel: a.alumno_nivel != null ? Number(a.alumno_nivel) : null,
      grado: a.alumno_grado != null ? String(a.alumno_grado) : null,
      grupo: a.alumno_grupo != null ? String(a.alumno_grupo) : null,
    })
  }
  for (const m of (maestros.data ?? []) as FilaMaestro[]) {
    const c = mapMaestro(m)
    mapa.set(c.ref, c)
  }
  for (const e of (externos.data ?? []) as FilaPersonal[]) {
    const c = mapExternoCliente(mapExterno(e))
    mapa.set(c.ref, c)
  }
  return mapa
}

/* ───────────────────────── Pagos ───────────────────────── */

type FilaPago = {
  id: number
  pago_ref: string
  pago_descripcion: string
  pago_costo: number | string
  pago_fecha: string
  pago_cantidad: number | null
  pago_orden: string | null
  pago_estatus: number | null
  pago_concepto_id: number | null
  pago_ludi: number | string | null
  pago_cliente: string | null
  pago_entregado: boolean | null
}

const COLUMNAS_PAGO =
  'id, pago_ref, pago_descripcion, pago_costo, pago_fecha, pago_cantidad, pago_orden, pago_estatus, pago_concepto_id, pago_ludi, pago_cliente, pago_entregado'

function productoDePago(p: FilaPago, catalogo: PosProducto[]): PosProducto | undefined {
  if (p.pago_concepto_id) {
    const porId = catalogo.find((c) => c.id === Number(p.pago_concepto_id))
    if (porId) return porId
  }
  const desc = String(p.pago_descripcion ?? '').trim().toLowerCase()
  return catalogo.find((c) => c.nombre.toLowerCase() === desc)
}

async function enriquecerPagos(filas: FilaPago[]): Promise<PosPago[]> {
  const [catalogo, clientes] = await Promise.all([
    listarProductos(true),
    resolverClientes(filas.map((f) => f.pago_ref)),
  ])
  return filas.map((p) => {
    const ref = String(p.pago_ref ?? '').trim()
    const cliente = clientes.get(ref)
    const producto = productoDePago(p, catalogo)
    return {
      id: Number(p.id),
      ref,
      cliente: cliente?.nombre || String(p.pago_cliente ?? '').trim() || `Ref. ${ref}`,
      tipo: cliente?.tipo ?? tipoClienteDeRef(ref),
      nivel: cliente?.nivel ?? null,
      grado: cliente?.grado ?? null,
      grupo: cliente?.grupo ?? null,
      descripcion: String(p.pago_descripcion ?? '').trim(),
      productoId: producto?.id ?? null,
      codigo: producto?.codigoReporte ?? null,
      costo: num(p.pago_costo),
      ludi: p.pago_ludi != null ? num(p.pago_ludi) : producto?.montoLudi ?? 0,
      cantidad: Math.max(1, Number(p.pago_cantidad ?? 1)),
      fecha: fechaDeColumna(p.pago_fecha),
      orden: String(p.pago_orden ?? ''),
      estatus: Number(p.pago_estatus ?? 1),
      entregado: p.pago_entregado === true,
    }
  })
}

export async function pagosDelDia(fecha: string): Promise<PosPago[]> {
  if (!esFechaIso(fecha)) throw new PosError('Fecha inválida.')
  const { data, error } = await db()
    .from('pago_desayunos')
    .select(COLUMNAS_PAGO)
    .eq('pago_fecha', fecha)
    .in('pago_estatus', ESTATUS_VIGENTES)
    .order('id', { ascending: true })
  lanzar(error, 'No se pudieron leer los servicios del día')
  return enriquecerPagos((data ?? []) as FilaPago[])
}

/** Servicios del cliente: próximos (desde hoy) y los últimos 15 días. */
export async function historialCliente(ref: string): Promise<PosPago[]> {
  const r = texto(ref, 30)
  if (!r) throw new PosError('Referencia inválida.')
  const desde = sumarDias(fechaMx(), -15)
  const { data, error } = await db()
    .from('pago_desayunos')
    .select(COLUMNAS_PAGO)
    .eq('pago_ref', r)
    .gte('pago_fecha', desde)
    .in('pago_estatus', ESTATUS_VIGENTES)
    .order('pago_fecha', { ascending: true })
    .limit(200)
  lanzar(error, 'No se pudo leer el historial')
  return enriquecerPagos((data ?? []) as FilaPago[])
}

export async function registrarVenta(req: PosVentaRequest): Promise<PosVentaResultado> {
  const ref = texto(req.ref, 30)
  if (!ref) throw new PosError('Selecciona primero al alumno o persona.')
  const lineas = Array.isArray(req.lineas) ? req.lineas : []
  if (!lineas.length) throw new PosError('Agrega al menos un producto.')
  if (lineas.length > MAX_PARTIDAS) throw new PosError('Demasiadas partidas en una sola venta.')

  const [catalogo, clientes] = await Promise.all([listarProductos(false), resolverClientes([ref])])
  const cliente = clientes.get(ref)
  if (!cliente) throw new PosError('No se encontró al alumno o persona seleccionada.', 404)

  const orden = String(Date.now())
  const filas = lineas.map((l) => {
    const producto = catalogo.find((p) => p.id === Number(l.productoId))
    if (!producto) throw new PosError('Uno de los productos ya no está disponible. Recarga el catálogo.')
    if (!esFechaIso(l.fecha)) throw new PosError(`Fecha inválida para ${producto.nombre}.`)
    const cantidad = Math.trunc(num(l.cantidad))
    if (cantidad < 1 || cantidad > MAX_CANTIDAD) {
      throw new PosError(`Cantidad inválida para ${producto.nombre}.`)
    }
    return {
      pago_ref: ref,
      pago_descripcion: producto.nombre,
      pago_costo: producto.costo,
      pago_fecha: l.fecha,
      pago_cantidad: cantidad,
      pago_orden: orden,
      pago_estatus: 1,
      pago_concepto_id: producto.id,
      pago_ludi: producto.montoLudi,
      pago_cliente: cliente.nombre.slice(0, 200),
    }
  })

  const total = Math.round(filas.reduce((s, f) => s + f.pago_costo * f.pago_cantidad, 0) * 100) / 100
  const recibido = Math.round(num(req.recibido) * 100) / 100
  if (recibido < total) {
    throw new PosError(`El pago recibido (${recibido.toFixed(2)}) no cubre el total (${total.toFixed(2)}).`)
  }

  const { error } = await db()
    .from('pago_desayunos')
    .insert(filas.map((f) => ({ ...f, pago_recibido: recibido })))
  lanzar(error, 'No se pudo registrar la venta')

  return {
    orden,
    total,
    recibido,
    cambio: Math.round((recibido - total) * 100) / 100,
    partidas: filas.length,
  }
}

export async function marcarEntrega(ids: number[], entregado: boolean): Promise<void> {
  const limpios = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
  if (!limpios.length) throw new PosError('Sin servicios para actualizar.')
  const { error } = await db()
    .from('pago_desayunos')
    .update({
      pago_entregado: entregado,
      pago_entregado_at: entregado ? new Date().toISOString() : null,
    })
    .in('id', limpios)
  lanzar(error, 'No se pudo actualizar la entrega')
}

/** Cancela partidas no entregadas (errores de captura en caja). */
export async function cancelarPartidas(ids: number[]): Promise<number> {
  const limpios = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))]
  if (!limpios.length) throw new PosError('Sin partidas para cancelar.')
  const { data, error } = await db()
    .from('pago_desayunos')
    .update({ pago_estatus: ESTATUS_CANCELADO })
    .in('id', limpios)
    .eq('pago_entregado', false)
    .select('id')
  lanzar(error, 'No se pudo cancelar')
  return (data ?? []).length
}

/* ───────────────────────── Reporte contable ───────────────────────── */

export async function reporteContable(inicio: string, fin: string): Promise<PosReporteContable> {
  if (!esFechaIso(inicio) || !esFechaIso(fin) || inicio > fin) {
    throw new PosError('Rango de fechas inválido.')
  }
  const [catalogo, ventas] = await Promise.all([
    listarProductos(true),
    db()
      .from('pago_desayunos')
      .select(COLUMNAS_PAGO)
      .gte('pago_fecha', inicio)
      .lte('pago_fecha', fin)
      .eq('pago_estatus', 1)
      .order('pago_fecha', { ascending: true })
      .limit(20000),
  ])
  lanzar(ventas.error, 'No se pudieron leer las ventas')

  const porDia = new Map<string, FilaPago[]>()
  for (const v of (ventas.data ?? []) as FilaPago[]) {
    const f = fechaDeColumna(v.pago_fecha)
    const lista = porDia.get(f) ?? []
    lista.push(v)
    porDia.set(f, lista)
  }

  const dias: PosResumenDia[] = [...porDia.keys()].sort().map((fecha) => {
    const servicios = new Map<string, PosResumenServicio>()
    const clientes = new Set<string>()
    for (const v of porDia.get(fecha) ?? []) {
      const producto = productoDePago(v, catalogo)
      const codigo = producto?.codigoReporte || String(v.pago_descripcion ?? '').trim().toUpperCase()
      const cantidad = Math.max(1, Number(v.pago_cantidad ?? 1))
      const costo = num(v.pago_costo)
      const ludiUnit = v.pago_ludi != null ? num(v.pago_ludi) : producto?.montoLudi ?? 0
      const s =
        servicios.get(codigo) ??
        ({
          codigo,
          servicio: producto?.nombre ?? String(v.pago_descripcion ?? ''),
          precio: producto?.costo ?? costo,
          ludiUnitario: producto?.montoLudi ?? ludiUnit,
          cantidad: 0,
          total: 0,
          ludi: 0,
          caja: 0,
        } satisfies PosResumenServicio)
      s.cantidad += cantidad
      s.total += costo * cantidad
      s.ludi += ludiUnit * cantidad
      s.caja += (costo - ludiUnit) * cantidad
      servicios.set(codigo, s)
      clientes.add(String(v.pago_ref))
    }
    const lista = [...servicios.values()]
    return {
      fecha,
      servicios: lista,
      totalVendido: lista.reduce((a, s) => a + s.total, 0),
      totalLudi: lista.reduce((a, s) => a + s.ludi, 0),
      totalCaja: lista.reduce((a, s) => a + s.caja, 0),
      totalClientes: clientes.size,
    }
  })

  return {
    inicio,
    fin,
    catalogo,
    dias,
    totalVendido: dias.reduce((a, d) => a + d.totalVendido, 0),
    totalLudi: dias.reduce((a, d) => a + d.totalLudi, 0),
    totalCaja: dias.reduce((a, d) => a + d.totalCaja, 0),
    totalClientes: new Set(((ventas.data ?? []) as FilaPago[]).map((v) => String(v.pago_ref))).size,
  }
}
