'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, FileDown, RefreshCw, Search } from 'lucide-react'
import { posApi } from '@/lib/pos/posApi'
import { generarReporteDiarioPdf } from '@/lib/pos/reporteDiarioPdf'
import {
  NIVEL_ETIQUETA,
  fechaLarga,
  fechaMx,
  sumarDias,
  type PosPago,
  type PosProducto,
} from '@/lib/pos/posTipos'
import { useToast } from './Toast'

type Filtro = 'todos' | 'desayunos' | 'comida' | 'estancias' | 'tareas'

const FILTROS: { id: Filtro; etiqueta: string }[] = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'desayunos', etiqueta: 'Desayunos' },
  { id: 'comida', etiqueta: 'Comida' },
  { id: 'estancias', etiqueta: 'Estancias' },
  { id: 'tareas', etiqueta: 'Tareas y media' },
]

function categoria(p: PosPago): Exclude<Filtro, 'todos'> {
  const c = (p.codigo || p.descripcion).toUpperCase()
  if (c === 'DCH' || c === 'DG' || c.includes('DESAYUNO')) return 'desayunos'
  if (c.includes('COMIDA')) return 'comida'
  if (c.includes('EST')) return 'estancias'
  return 'tareas'
}

function seccion(p: PosPago): { clave: string; etiqueta: string; orden: number } {
  if (p.tipo === 'maestro') return { clave: 'maestros', etiqueta: 'Personal docente', orden: 900 }
  if (p.tipo === 'externo') return { clave: 'externos', etiqueta: 'Externos', orden: 950 }
  const nivel = p.nivel ?? 0
  const grado = parseInt(String(p.grado ?? ''), 10) || 0
  const nombre = NIVEL_ETIQUETA[nivel] ?? 'Sin nivel'
  return {
    clave: `${nivel}-${grado}`,
    etiqueta: grado ? `${nombre} · ${grado}°` : nombre,
    orden: nivel * 10 + grado,
  }
}

export default function ConsultaDiariaView({ productos }: { productos: PosProducto[] }) {
  const toast = useToast()
  const [fecha, setFecha] = useState(fechaMx())
  const [pagos, setPagos] = useState<PosPago[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [ocultarEntregados, setOcultarEntregados] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setPagos(await posApi.dia(fecha))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la consulta.')
      setPagos([])
    } finally {
      setCargando(false)
    }
  }, [fecha])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const resumen = useMemo(() => {
    const m = new Map<string, { nombre: string; total: number; entregados: number; orden: number }>()
    for (const p of pagos) {
      const clave = p.codigo || p.descripcion.toUpperCase()
      const prod = productos.find((x) => x.id === p.productoId)
      const r = m.get(clave) ?? { nombre: p.descripcion, total: 0, entregados: 0, orden: prod?.orden ?? 99 }
      r.total += p.cantidad
      if (p.entregado) r.entregados += p.cantidad
      m.set(clave, r)
    }
    return [...m.values()].sort((a, b) => a.orden - b.orden)
  }, [pagos, productos])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return pagos.filter(
      (p) =>
        (filtro === 'todos' || categoria(p) === filtro) &&
        (!ocultarEntregados || !p.entregado) &&
        (!q || p.cliente.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q))
    )
  }, [pagos, filtro, busqueda, ocultarEntregados])

  const secciones = useMemo(() => {
    const m = new Map<string, { etiqueta: string; orden: number; pagos: PosPago[] }>()
    for (const p of visibles) {
      const s = seccion(p)
      const actual = m.get(s.clave) ?? { etiqueta: s.etiqueta, orden: s.orden, pagos: [] }
      actual.pagos.push(p)
      m.set(s.clave, actual)
    }
    return [...m.values()]
      .sort((a, b) => a.orden - b.orden)
      .map((s) => ({ ...s, pagos: s.pagos.sort((a, b) => a.cliente.localeCompare(b.cliente, 'es')) }))
  }, [visibles])

  const marcar = async (ids: number[], entregado: boolean) => {
    const previo = pagos
    setPagos((ps) => ps.map((p) => (ids.includes(p.id) ? { ...p, entregado } : p)))
    try {
      await posApi.entrega(ids, entregado)
    } catch (e) {
      setPagos(previo)
      toast(e instanceof Error ? e.message : 'No se pudo guardar la entrega.', 'error')
    }
  }

  const imprimir = () => {
    const ventana = window.open('', '_blank')
    try {
      generarReporteDiarioPdf(fecha, pagos, productos, ventana)
    } catch {
      ventana?.close()
      toast('No se pudo generar el PDF.', 'error')
    }
  }

  const totalEntregados = pagos.filter((p) => p.entregado).length

  return (
    <div className="cj-page">
      <header className="cj-page-head">
        <div>
          <h1 className="cj-h1">Consulta diaria</h1>
          <p className="cj-muted">Marca lo que se va entregando en cocina, estancia y tareas.</p>
        </div>
        <div className="cj-page-actions">
          <div className="cj-daynav">
            <button type="button" className="cj-icon-btn" onClick={() => setFecha(sumarDias(fecha, -1))} aria-label="Día anterior">
              <ChevronLeft size={18} />
            </button>
            <input
              type="date"
              className="cj-input cj-input--date"
              value={fecha}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
              aria-label="Fecha"
            />
            <button type="button" className="cj-icon-btn" onClick={() => setFecha(sumarDias(fecha, 1))} aria-label="Día siguiente">
              <ChevronRight size={18} />
            </button>
            {fecha !== fechaMx() ? (
              <button type="button" className="cj-chip" onClick={() => setFecha(fechaMx())}>
                Hoy
              </button>
            ) : null}
          </div>
          <button type="button" className="cj-btn cj-btn--ghost" onClick={() => void cargar()} disabled={cargando}>
            <RefreshCw size={16} className={cargando ? 'cj-spin' : ''} aria-hidden /> Actualizar
          </button>
          <button type="button" className="cj-btn cj-btn--primary" onClick={imprimir} disabled={cargando}>
            <FileDown size={16} aria-hidden /> Reporte Ludy
          </button>
        </div>
      </header>

      <p className="cj-page-date">{fechaLarga(fecha)}</p>

      {error ? (
        <div className="cj-banner cj-banner--error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="cj-kpis">
        <div className="cj-kpi cj-kpi--accent">
          <span className="cj-kpi-label">Entregados</span>
          <span className="cj-kpi-value">
            {totalEntregados}
            <small>/ {pagos.length}</small>
          </span>
          <span className="cj-progress" aria-hidden>
            <span style={{ width: `${pagos.length ? (totalEntregados / pagos.length) * 100 : 0}%` }} />
          </span>
        </div>
        {resumen.map((r) => (
          <div key={r.nombre} className="cj-kpi">
            <span className="cj-kpi-label">{r.nombre}</span>
            <span className="cj-kpi-value">
              {r.total}
              {r.entregados ? <small>· {r.entregados} ✓</small> : null}
            </span>
          </div>
        ))}
      </div>

      <div className="cj-toolbar">
        <div className="cj-chips" role="tablist" aria-label="Filtrar por servicio">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filtro === f.id}
              className={`cj-chip${filtro === f.id ? ' is-on' : ''}`}
              onClick={() => setFiltro(f.id)}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
        <div className="cj-toolbar-right">
          <div className="cj-input-wrap cj-input-wrap--sm">
            <Search size={16} className="cj-input-icon" aria-hidden />
            <input
              className="cj-input"
              placeholder="Buscar nombre…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar por nombre"
            />
          </div>
          <label className="cj-switch">
            <input type="checkbox" checked={ocultarEntregados} onChange={(e) => setOcultarEntregados(e.target.checked)} />
            <span>Ocultar entregados</span>
          </label>
        </div>
      </div>

      {cargando ? (
        <div className="cj-skeleton-list" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="cj-skeleton" />
          ))}
        </div>
      ) : secciones.length === 0 ? (
        <div className="cj-card cj-empty">
          <p>{pagos.length ? 'Nada coincide con el filtro.' : 'No hay servicios pagados para este día.'}</p>
        </div>
      ) : (
        <div className="cj-secciones">
          {secciones.map((s) => {
            const pendientes = s.pagos.filter((p) => !p.entregado)
            return (
              <section key={s.etiqueta} className="cj-card cj-seccion">
                <header className="cj-seccion-head">
                  <h2>
                    {s.etiqueta}
                    <span className="cj-count">{s.pagos.length}</span>
                  </h2>
                  {pendientes.length ? (
                    <button
                      type="button"
                      className="cj-btn cj-btn--ghost cj-btn--sm"
                      onClick={() => void marcar(pendientes.map((p) => p.id), true)}
                    >
                      <Check size={15} aria-hidden /> Entregar todos
                    </button>
                  ) : (
                    <span className="cj-badge cj-badge--ok">Completo</span>
                  )}
                </header>
                <ul className="cj-entregas">
                  {s.pagos.map((p) => (
                    <li key={p.id} className={`cj-entrega${p.entregado ? ' is-done' : ''}`}>
                      <div className="cj-entrega-info">
                        <span className="cj-entrega-nombre">{p.cliente}</span>
                        <span className="cj-entrega-meta">
                          <span className={`cj-pill cj-pill--${categoria(p)}`}>
                            {p.cantidad > 1 ? `${p.cantidad}× ` : ''}
                            {p.descripcion}
                          </span>
                          {p.grupo && p.tipo === 'alumno' ? <span className="cj-muted">Grupo {p.grupo}</span> : null}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`cj-toggle${p.entregado ? ' is-on' : ''}`}
                        aria-pressed={p.entregado}
                        onClick={() => void marcar([p.id], !p.entregado)}
                      >
                        <Check size={16} aria-hidden />
                        {p.entregado ? 'Entregado' : 'Entregar'}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
