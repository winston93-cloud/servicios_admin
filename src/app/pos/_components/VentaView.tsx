'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Minus,
  Plus,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Trash2,
  UserRound,
  UtensilsCrossed,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { posApi } from '@/lib/pos/posApi'
import {
  diaHabilDesde,
  esFinDeSemana,
  etiquetaCliente,
  fechaCorta,
  fechaIsoADate,
  fechaLarga,
  fechaMx,
  moneda,
  sumarDias,
  type PosCliente,
  type PosPago,
  type PosProducto,
  type PosVentaResultado,
} from '@/lib/pos/posTipos'
import ClienteBuscador, { iniciales, type ClienteBuscadorRef } from './ClienteBuscador'
import Calendario from './Calendario'
import { useToast } from './Toast'

type Linea = { key: string; productoId: number; fecha: string; cantidad: number }

const lineaKey = (productoId: number, fecha: string) => `${productoId}|${fecha}`

/** 0 = lunes … 6 = domingo */
const diaSemana = (iso: string) => (fechaIsoADate(iso).getDay() + 6) % 7

/** Días hábiles desde `desde` (o el siguiente hábil) hasta el viernes de esa semana. */
function semanaHabil(desde: string): string[] {
  const inicio = diaHabilDesde(desde)
  return Array.from({ length: 5 - diaSemana(inicio) }, (_, i) => sumarDias(inicio, i))
}

type Categoria = 'desayuno' | 'comida' | 'estancia' | 'tarea' | 'otro'

/** Color de la tecla según el tipo de servicio (se deduce del nombre del catálogo). */
function categoriaProducto(p: PosProducto): Categoria {
  const n = p.nombre.toLowerCase()
  if (n.includes('desayuno') || n.includes('media')) return 'desayuno'
  if (n.includes('comida')) return 'comida'
  if (n.includes('est')) return 'estancia'
  if (n.includes('tarea')) return 'tarea'
  return 'otro'
}

function StepHead({
  id,
  icono: Icono,
  titulo,
  detalle,
  listo,
  children,
}: {
  id: string
  icono: LucideIcon
  titulo: string
  detalle?: string
  listo?: boolean
  children?: ReactNode
}) {
  return (
    <header className="cj-step-head">
      <span className={`cj-step-icon${listo ? ' is-done' : ''}`} aria-hidden>
        {listo ? <Check size={18} strokeWidth={2.5} /> : <Icono size={18} strokeWidth={2.25} />}
      </span>
      <div className="cj-step-title">
        <h2 id={id}>{titulo}</h2>
        {detalle ? <p>{detalle}</p> : null}
      </div>
      {children}
    </header>
  )
}

function billetesSugeridos(total: number): number[] {
  if (total <= 0) return []
  const set = new Set<number>()
  for (const paso of [10, 50, 100, 200, 500, 1000]) {
    const v = Math.ceil(total / paso) * paso
    if (v > total) set.add(v)
  }
  return [...set].sort((a, b) => a - b).slice(0, 4)
}

export default function VentaView({ productos, activa }: { productos: PosProducto[]; activa: boolean }) {
  const toast = useToast()
  const hoy = fechaMx()
  const buscadorRef = useRef<ClienteBuscadorRef>(null)
  const codigoRef = useRef<HTMLInputElement>(null)
  const recibidoRef = useRef<HTMLInputElement>(null)
  const nuevaVentaRef = useRef<HTMLButtonElement>(null)

  const [cliente, setCliente] = useState<PosCliente | null>(null)
  const [historial, setHistorial] = useState<PosPago[]>([])
  const [cargandoHist, setCargandoHist] = useState(false)
  const [fechas, setFechas] = useState<string[]>(() => [diaHabilDesde(hoy)])
  const [calAbierto, setCalAbierto] = useState(false)
  const [productoFechas, setProductoFechas] = useState<number | null>(null)
  const [carrito, setCarrito] = useState<Linea[]>([])
  const [codigo, setCodigo] = useState('')
  const [recibido, setRecibido] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const [resultado, setResultado] = useState<PosVentaResultado | null>(null)
  const [cancelando, setCancelando] = useState<number | null>(null)

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])

  const cargarHistorial = useCallback(async (ref: string) => {
    setCargandoHist(true)
    try {
      setHistorial(await posApi.historial(ref))
    } catch {
      setHistorial([])
    } finally {
      setCargandoHist(false)
    }
  }, [])

  const seleccionarCliente = (c: PosCliente) => {
    setCliente(c)
    void cargarHistorial(c.ref)
    setTimeout(() => codigoRef.current?.focus(), 60)
  }

  const agregar = useCallback(
    (p: PosProducto) => {
      const destino = fechas.length ? fechas : [diaHabilDesde(hoy)]
      setCarrito((prev) => {
        const next = [...prev]
        for (const fecha of destino) {
          const key = lineaKey(p.id, fecha)
          const i = next.findIndex((l) => l.key === key)
          if (i >= 0) next[i] = { ...next[i], cantidad: Math.min(20, next[i].cantidad + 1) }
          else next.push({ key, productoId: p.id, fecha, cantidad: 1 })
        }
        return next
      })
      setCodigo('')
      codigoRef.current?.focus()
    },
    [fechas, hoy]
  )

  const coincidencias = useMemo(() => {
    const c = codigo.trim().toLowerCase()
    if (!c) return []
    return productos.filter((p) => p.abreviatura.startsWith(c) || p.nombre.toLowerCase().includes(c))
  }, [codigo, productos])

  const onCodigo = (valor: string) => {
    const c = valor.trim().toLowerCase()
    const exacto = productos.find((p) => p.abreviatura === c)
    const ambiguo = productos.some((p) => p.abreviatura !== c && p.abreviatura.startsWith(c))
    if (exacto && !ambiguo) {
      agregar(exacto)
      return
    }
    setCodigo(valor)
  }

  const cambiarCantidad = (key: string, delta: number) =>
    setCarrito((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, cantidad: Math.min(20, l.cantidad + delta) } : l))
        .filter((l) => l.cantidad > 0)
    )

  const fechasDeProducto = (productoId: number) =>
    carrito.filter((l) => l.productoId === productoId).map((l) => l.fecha).sort()

  /** Igual que el calendario original: cada día marcado es una partida del producto; desmarcar la quita. */
  const cambiarFechasProducto = (productoId: number, nuevas: string[]) => {
    if (!nuevas.length) return
    setCarrito((prev) => {
      const actuales = prev.filter((l) => l.productoId === productoId)
      const cantidadBase = actuales[0]?.cantidad ?? 1
      const conservadas = prev.filter((l) => l.productoId !== productoId || nuevas.includes(l.fecha))
      const existentes = new Set(actuales.map((l) => l.fecha))
      const agregadas = nuevas
        .filter((f) => !existentes.has(f))
        .map((fecha) => ({ key: lineaKey(productoId, fecha), productoId, fecha, cantidad: cantidadBase }))
      return [...conservadas, ...agregadas]
    })
  }

  const total = useMemo(
    () => carrito.reduce((s, l) => s + (porId.get(l.productoId)?.costo ?? 0) * l.cantidad, 0),
    [carrito, porId]
  )
  const piezas = carrito.reduce((s, l) => s + l.cantidad, 0)
  const recibidoNum = parseFloat(recibido.replace(/[^\d.]/g, '')) || 0
  const cambio = recibidoNum - total
  const puedeCobrar = !!cliente && carrito.length > 0 && recibidoNum >= total && total > 0 && !cobrando

  const grupos = useMemo(() => {
    const m = new Map<string, Linea[]>()
    for (const l of [...carrito].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
      m.set(l.fecha, [...(m.get(l.fecha) ?? []), l])
    }
    return [...m.entries()]
  }, [carrito])

  const yaPagado = useMemo(() => {
    const s = new Set<string>()
    for (const p of historial) if (p.productoId) s.add(lineaKey(p.productoId, p.fecha))
    return s
  }, [historial])

  const proximos = useMemo(() => {
    const m = new Map<string, PosPago[]>()
    for (const p of historial.filter((h) => h.fecha >= hoy)) m.set(p.fecha, [...(m.get(p.fecha) ?? []), p])
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [historial, hoy])

  const reiniciar = useCallback(() => {
    setCliente(null)
    setHistorial([])
    setCarrito([])
    setRecibido('')
    setCodigo('')
    setResultado(null)
    setFechas([diaHabilDesde(fechaMx())])
    setTimeout(() => buscadorRef.current?.focus(), 60)
  }, [])

  const cobrar = useCallback(async () => {
    if (!cliente) {
      toast('Selecciona primero al alumno o persona.', 'error')
      buscadorRef.current?.focus()
      return
    }
    if (!carrito.length) {
      toast('Agrega al menos un producto.', 'error')
      codigoRef.current?.focus()
      return
    }
    if (recibidoNum < total) {
      toast(`El pago no cubre el total: faltan ${moneda(total - recibidoNum)}.`, 'error')
      recibidoRef.current?.focus()
      return
    }
    setCobrando(true)
    try {
      const r = await posApi.venta({
        ref: cliente.ref,
        cliente: cliente.nombre,
        recibido: recibidoNum,
        lineas: carrito.map(({ productoId, fecha, cantidad }) => ({ productoId, fecha, cantidad })),
      })
      setResultado(r)
      setTimeout(() => nuevaVentaRef.current?.focus(), 60)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo registrar la venta.', 'error')
    } finally {
      setCobrando(false)
    }
  }, [cliente, carrito, recibidoNum, total, toast])

  const cancelarPartida = async (id: number) => {
    try {
      const n = await posApi.cancelar([id])
      toast(n ? 'Partida cancelada.' : 'No se canceló: ya estaba entregada.', n ? 'ok' : 'error')
      if (cliente) await cargarHistorial(cliente.ref)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cancelar.', 'error')
    } finally {
      setCancelando(null)
    }
  }

  useEffect(() => {
    if (!activa) return
    const onKey = (e: KeyboardEvent) => {
      if (resultado) {
        if (e.key === 'Escape') reiniciar()
        return
      }
      if (e.key === 'F2') {
        e.preventDefault()
        buscadorRef.current?.focus()
      } else if (e.key === 'F4') {
        e.preventDefault()
        codigoRef.current?.focus()
      } else if (e.key === 'F9') {
        e.preventDefault()
        recibidoRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activa, resultado, reiniciar])

  useEffect(() => {
    if (activa && !cliente) buscadorRef.current?.focus()
  }, [activa, cliente])

  const atajosFecha = [
    { etiqueta: 'Hoy', fechas: [diaHabilDesde(hoy)], deshabilitado: esFinDeSemana(hoy) },
    { etiqueta: 'Mañana', fechas: [diaHabilDesde(sumarDias(hoy, 1))] },
    { etiqueta: 'Esta semana', fechas: semanaHabil(hoy) },
    { etiqueta: 'Próx. semana', fechas: semanaHabil(sumarDias(hoy, 7 - diaSemana(hoy))) },
  ]
  const mismaSeleccion = (a: string[]) => a.length === fechas.length && a.every((f, i) => f === fechas[i])

  return (
    <div className="cj-venta">
      <div className="cj-venta-main">
        {/* Paso 1 */}
        <section className="cj-card cj-step cj-area-cliente" aria-labelledby="cj-paso1">
          <StepHead
            id="cj-paso1"
            icono={UserRound}
            titulo="¿Para quién es?"
            detalle="Alumno, docente o externo"
            listo={!!cliente}
          />

          {cliente ? (
            <div className="cj-cliente">
              <span className={`cj-avatar cj-avatar--lg cj-avatar--${cliente.tipo}`} aria-hidden>
                {iniciales(cliente.nombre)}
              </span>
              <div className="cj-cliente-info">
                <p className="cj-cliente-nombre">{cliente.nombre}</p>
                <p className="cj-cliente-meta">
                  {etiquetaCliente(cliente)}
                  <span className="cj-dot" aria-hidden />
                  Ref. {cliente.ref}
                </p>
              </div>
              <button
                type="button"
                className="cj-btn cj-btn--ghost"
                onClick={() => {
                  setCliente(null)
                  setHistorial([])
                }}
              >
                <RotateCcw size={16} aria-hidden /> Cambiar
              </button>
            </div>
          ) : (
            <>
              <ClienteBuscador ref={buscadorRef} onSeleccion={seleccionarCliente} />
              <div className="cj-cliente-vacio">
                <span className="cj-cliente-vacio-icon" aria-hidden>
                  <UserRound size={30} strokeWidth={1.75} />
                </span>
                <p className="cj-cliente-vacio-titulo">Empieza por la persona</p>
                <p className="cj-cliente-vacio-texto">
                  Escribe nombre, apellidos o número de control. Usa las flechas y Enter para elegir.
                </p>
                <div className="cj-cliente-vacio-keys">
                  <span><kbd className="cj-kbd">F2</kbd> Buscar</span>
                  <span><kbd className="cj-kbd">F4</kbd> Código</span>
                  <span><kbd className="cj-kbd">F9</kbd> Pago</span>
                </div>
              </div>
            </>
          )}

          {cliente ? (
            <div className="cj-pagados">
              <p className="cj-label">
                Servicios ya pagados
                {cargandoHist ? <span className="cj-muted"> · cargando…</span> : null}
              </p>
              {!cargandoHist && proximos.length === 0 ? (
                <p className="cj-muted cj-small">No tiene servicios pagados de hoy en adelante.</p>
              ) : (
                <ul className="cj-pagados-list">
                  {proximos.map(([fecha, pagos]) => (
                    <li key={fecha} className="cj-pagado-dia">
                      <span className="cj-pagado-fecha">{fecha === hoy ? 'Hoy' : fechaCorta(fecha)}</span>
                      <span className="cj-pagado-items">
                        {pagos.map((p) => (
                          <span key={p.id} className={`cj-pill${p.entregado ? ' is-ok' : ''}`}>
                            {p.cantidad > 1 ? `${p.cantidad}× ` : ''}
                            {p.descripcion}
                            {p.entregado ? (
                              <Check size={13} aria-label="Entregado" />
                            ) : cancelando === p.id ? (
                              <span className="cj-pill-confirm">
                                <button type="button" onClick={() => void cancelarPartida(p.id)}>
                                  Cancelar
                                </button>
                                <button type="button" onClick={() => setCancelando(null)} aria-label="No cancelar">
                                  <X size={13} />
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="cj-pill-x"
                                onClick={() => setCancelando(p.id)}
                                aria-label={`Cancelar ${p.descripcion} del ${fechaCorta(fecha)}`}
                                title="Cancelar partida (error de captura)"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </span>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>

        {/* Paso 2 */}
        <section className="cj-card cj-step cj-area-productos" aria-labelledby="cj-paso2">
          <StepHead
            id="cj-paso2"
            icono={UtensilsCrossed}
            titulo="Productos y días"
            detalle="Toca un producto o escribe su código"
            listo={carrito.length > 0}
          />

          <div className="cj-fechas">
            <p className="cj-label">
              <CalendarDays size={15} aria-hidden /> Se agregan para:
              <strong className="cj-fechas-resumen">
                {fechas.length === 1 ? fechaLarga(fechas[0]) : `${fechas.length} días`}
              </strong>
            </p>
            <div className="cj-chips">
              {atajosFecha.map((a) => (
                <button
                  key={a.etiqueta}
                  type="button"
                  className={`cj-chip${mismaSeleccion(a.fechas) ? ' is-on' : ''}`}
                  disabled={a.deshabilitado}
                  onClick={() => setFechas(a.fechas)}
                >
                  {a.etiqueta}
                </button>
              ))}
              <button
                type="button"
                className={`cj-chip${calAbierto ? ' is-on' : ''}`}
                onClick={() => setCalAbierto((v) => !v)}
                aria-expanded={calAbierto}
              >
                <CalendarDays size={15} aria-hidden /> Elegir días
              </button>
            </div>
            {fechas.length > 1 ? (
              <div className="cj-fechas-list">
                {fechas.map((f) => (
                  <span key={f} className="cj-pill">
                    {fechaCorta(f)}
                    <button
                      type="button"
                      className="cj-pill-x"
                      onClick={() => setFechas(fechas.filter((x) => x !== f))}
                      aria-label={`Quitar ${fechaCorta(f)}`}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {calAbierto ? (
              <div className="cj-cal-pop">
                <Calendario seleccion={fechas} onCambio={setFechas} />
                <button type="button" className="cj-btn cj-btn--primary cj-btn--block" onClick={() => setCalAbierto(false)}>
                  Listo
                </button>
              </div>
            ) : null}
          </div>

          <div className="cj-codigo">
            <div className="cj-input-wrap">
              <ShoppingCart size={18} className="cj-input-icon" aria-hidden />
              <input
                ref={codigoRef}
                className="cj-input cj-input--lg cj-input--mono"
                placeholder="Código rápido (dc, dg, cc…) y Enter"
                value={codigo}
                onChange={(e) => onCodigo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (coincidencias[0]) agregar(coincidencias[0])
                    else if (!codigo.trim() && carrito.length) recibidoRef.current?.focus()
                  } else if (e.key === 'Escape') setCodigo('')
                }}
                autoComplete="off"
                spellCheck={false}
                aria-label="Código del producto"
              />
              <kbd className="cj-input-trail cj-kbd">F4</kbd>
            </div>
            {codigo.trim() && coincidencias.length === 0 ? (
              <p className="cj-field-error">No hay producto con «{codigo.trim()}».</p>
            ) : null}
          </div>

          <div className="cj-productos" role="list">
            {productos.map((p) => {
              const resaltado = codigo.trim() && coincidencias.includes(p)
              return (
                <button
                  key={p.id}
                  type="button"
                  role="listitem"
                  className={`cj-prod cj-prod--${categoriaProducto(p)}${resaltado ? ' is-match' : ''}`}
                  onClick={() => agregar(p)}
                  title={`Agregar ${p.nombre}`}
                >
                  <span className="cj-prod-code">{p.abreviatura}</span>
                  <span className="cj-prod-name">{p.nombre}</span>
                  <span className="cj-prod-price">{moneda(p.costo)}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Carrito */}
        <section className="cj-card cj-area-orden" aria-labelledby="cj-carrito">
          <StepHead
            id="cj-carrito"
            icono={Receipt}
            titulo="Orden"
            detalle={carrito.length ? `${piezas} ${piezas === 1 ? 'servicio' : 'servicios'} agrupados por día` : 'Aún sin productos'}
          >
            {carrito.length ? (
              <button type="button" className="cj-btn cj-btn--ghost cj-btn--sm cj-step-action" onClick={() => setCarrito([])}>
                <Trash2 size={15} aria-hidden /> Vaciar
              </button>
            ) : null}
          </StepHead>

          {carrito.length === 0 ? (
            <div className="cj-empty">
              <ShoppingCart size={28} aria-hidden />
              <p>Escribe un código o toca un producto para agregarlo.</p>
            </div>
          ) : (
            <div className="cj-orden">
              {grupos.map(([fecha, lineas]) => {
                const subtotal = lineas.reduce((s, l) => s + (porId.get(l.productoId)?.costo ?? 0) * l.cantidad, 0)
                return (
                  <div key={fecha} className="cj-orden-dia">
                    <div className="cj-orden-dia-head">
                      <span className="cj-orden-fecha">
                        {fecha === hoy ? 'Hoy · ' : ''}
                        {fechaLarga(fecha)}
                      </span>
                      <span className="cj-orden-subtotal">{moneda(subtotal)}</span>
                    </div>
                    <ul>
                      {lineas.map((l) => {
                        const p = porId.get(l.productoId)
                        if (!p) return null
                        const duplicado = yaPagado.has(l.key)
                        return (
                          <li key={l.key} className={`cj-linea${duplicado ? ' is-warn' : ''}`}>
                            <div className="cj-linea-info">
                              <span className="cj-linea-nombre">
                                <span className="cj-prod-code cj-prod-code--sm">{p.abreviatura}</span>
                                {p.nombre}
                              </span>
                              <span className="cj-linea-meta">
                                {moneda(p.costo)} c/u
                                {duplicado ? <strong className="cj-warn-text"> · Ya pagado ese día</strong> : null}
                              </span>
                            </div>
                            <div className="cj-stepper" aria-label={`Cantidad de ${p.nombre}`}>
                              <button type="button" onClick={() => cambiarCantidad(l.key, -1)} aria-label="Quitar uno">
                                <Minus size={16} />
                              </button>
                              <span aria-live="polite">{l.cantidad}</span>
                              <button type="button" onClick={() => cambiarCantidad(l.key, 1)} aria-label="Agregar uno">
                                <Plus size={16} />
                              </button>
                            </div>
                            <span className="cj-linea-total">{moneda(p.costo * l.cantidad)}</span>
                            <div className="cj-linea-acciones">
                              <button
                                type="button"
                                className="cj-icon-btn cj-icon-btn--sm"
                                onClick={() => setProductoFechas(l.productoId)}
                                aria-label={`Días de ${p.nombre}`}
                                title="Elegir días (cada día marcado agrega una partida)"
                              >
                                <CalendarDays size={16} />
                              </button>
                              <button
                                type="button"
                                className="cj-icon-btn cj-icon-btn--sm cj-icon-btn--danger"
                                onClick={() => setCarrito((prev) => prev.filter((x) => x.key !== l.key))}
                                aria-label={`Quitar ${p.nombre}`}
                                title="Quitar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Cobro */}
      <aside className="cj-venta-side">
        <section className="cj-card cj-cobro cj-area-cobro" aria-labelledby="cj-cobro">
          <StepHead id="cj-cobro" icono={Wallet} titulo="Cobrar" detalle="Captura el pago y presiona P" />

          <div className="cj-cobro-body">
            <div className="cj-cobro-resumen">
              <div className="cj-total">
                <span className="cj-total-label">Total</span>
                <span className="cj-total-value">{moneda(total)}</span>
                <span className="cj-total-meta">
                  {piezas} {piezas === 1 ? 'servicio' : 'servicios'} · {grupos.length}{' '}
                  {grupos.length === 1 ? 'día' : 'días'}
                </span>
              </div>

              <div
                className={`cj-cambio${recibido === '' ? '' : cambio >= 0 ? ' is-ok' : ' is-bad'}`}
                aria-live="polite"
              >
                <span>{recibido !== '' && cambio < 0 ? 'Faltan' : 'Cambio'}</span>
                <strong>{recibido === '' ? '$0.00' : moneda(Math.abs(cambio))}</strong>
              </div>
            </div>

            <div className="cj-cobro-pago">
              <label className="cj-label" htmlFor="cj-recibido">
                Pago recibido
              </label>
              <div className="cj-input-wrap">
                <span className="cj-input-icon cj-input-icon--text" aria-hidden>
                  $
                </span>
                <input
                  id="cj-recibido"
                  ref={recibidoRef}
                  className="cj-input cj-input--xl"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={recibido}
                  onChange={(e) => setRecibido(e.target.value.replace(/[^\d.]/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'p' || e.key === 'P' || e.key === 'Enter') {
                      e.preventDefault()
                      void cobrar()
                    }
                  }}
                  autoComplete="off"
                />
                <kbd className="cj-input-trail cj-kbd">F9</kbd>
              </div>

              <div className="cj-chips cj-chips--cash">
                <button
                  type="button"
                  className="cj-chip"
                  disabled={total <= 0}
                  onClick={() => setRecibido(total.toFixed(2))}
                >
                  Exacto
                </button>
                {billetesSugeridos(total).map((b) => (
                  <button key={b} type="button" className="cj-chip" onClick={() => setRecibido(String(b))}>
                    {moneda(b).replace('.00', '')}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="cj-btn cj-btn--primary cj-btn--xl cj-btn--block"
                onClick={() => void cobrar()}
                disabled={!puedeCobrar}
              >
                {cobrando ? 'Registrando…' : `Cobrar ${total > 0 ? moneda(total) : ''}`}
                {!cobrando ? <kbd className="cj-kbd cj-kbd--btn">P</kbd> : null}
              </button>

              {!cliente ? (
                <p className="cj-hint">
                  <UserRound size={14} aria-hidden /> Falta elegir alumno o persona.
                </p>
              ) : null}

              <details className="cj-atajos">
                <summary>Atajos de teclado</summary>
                <ul>
                  <li><kbd className="cj-kbd">F2</kbd> Buscar alumno</li>
                  <li><kbd className="cj-kbd">F4</kbd> Código de producto</li>
                  <li><kbd className="cj-kbd">F9</kbd> Pago recibido</li>
                  <li><kbd className="cj-kbd">P</kbd> / <kbd className="cj-kbd">Enter</kbd> en el pago: cobrar</li>
                </ul>
              </details>
            </div>
          </div>
        </section>
      </aside>

      {/* Días de un producto (calendario de selección múltiple) */}
      {productoFechas != null && porId.get(productoFechas) ? (
        <div
          className="cj-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cj-dias-title"
          onClick={() => setProductoFechas(null)}
          onKeyDown={(e) => e.key === 'Escape' && setProductoFechas(null)}
        >
          <div className="cj-dialog cj-dialog--sm" onClick={(e) => e.stopPropagation()}>
            <header className="cj-dialog-head">
              <div>
                <h3 id="cj-dias-title">{porId.get(productoFechas)?.nombre}</h3>
                <p className="cj-muted cj-small">
                  {fechasDeProducto(productoFechas).length} {fechasDeProducto(productoFechas).length === 1 ? 'día seleccionado' : 'días seleccionados'} · cada día es una partida
                </p>
              </div>
              <button type="button" className="cj-icon-btn cj-icon-btn--sm" onClick={() => setProductoFechas(null)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>
            <Calendario
              seleccion={fechasDeProducto(productoFechas)}
              onCambio={(fs) => cambiarFechasProducto(productoFechas, fs)}
              conHoy
            />
            <button
              type="button"
              className="cj-btn cj-btn--primary cj-btn--block cj-dialog-listo"
              onClick={() => setProductoFechas(null)}
              autoFocus
            >
              Listo
            </button>
          </div>
        </div>
      ) : null}

      {/* Venta registrada */}
      {resultado ? (
        <div className="cj-overlay" role="dialog" aria-modal="true" aria-labelledby="cj-ok-title">
          <div className="cj-dialog cj-dialog--ok">
            <span className="cj-ok-icon" aria-hidden>
              <CheckCircle2 size={44} strokeWidth={1.6} />
            </span>
            <h3 id="cj-ok-title">Venta registrada</h3>
            <p className="cj-muted">
              {cliente?.nombre} · Orden {resultado.orden}
            </p>
            <dl className="cj-ok-grid">
              <div>
                <dt>Total</dt>
                <dd>{moneda(resultado.total)}</dd>
              </div>
              <div>
                <dt>Recibido</dt>
                <dd>{moneda(resultado.recibido)}</dd>
              </div>
              <div className="is-cambio">
                <dt>Cambio</dt>
                <dd>{moneda(resultado.cambio)}</dd>
              </div>
            </dl>
            <button ref={nuevaVentaRef} type="button" className="cj-btn cj-btn--primary cj-btn--xl cj-btn--block" onClick={reiniciar}>
              Nueva venta
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
