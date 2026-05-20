'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { gradoOpcionesPorNivel, type GradoEscolarOpcion } from '@/lib/gradoEscolar'
import { NIVELES_ESCOLARES_OPCIONES, etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import {
  eliminarConceptoInterno,
  eliminarPrecioInterno,
  guardarConceptoInterno,
  guardarPrecioInterno,
  listarConceptosInternos,
  listarPreciosInternos,
  type ConceptoInterno,
  type ConceptoInternoInput,
  type PagoInternoPrecio,
  type PagoInternoPrecioInput,
} from '@/lib/pagoInternoService'

type TabCatalogo = 'conceptos' | 'precios'

interface Props {
  abierto: boolean
  onCerrar: () => void
  onActualizado?: () => void
  tabInicial?: TabCatalogo
}

const CONCEPTO_VACIO: ConceptoInternoInput = {
  concepto_id: 0,
  concepto_clase: '',
  visible: 1,
  orden_visible: 0,
}

const PRECIO_VACIO: PagoInternoPrecioInput = {
  alumno_nivel: 0,
  alumno_grado: 0,
  concepto_id: 0,
  precio_interno: 0,
  precio_ciclo_escolar: 0,
}

export default function PagosInternosCatalogoModal({
  abierto,
  onCerrar,
  onActualizado,
  tabInicial = 'conceptos',
}: Props) {
  const { cicloSeleccionado, opcionesCatalogo } = useCicloEscolar()
  const [tab, setTab] = useState<TabCatalogo>(tabInicial)
  const [conceptos, setConceptos] = useState<ConceptoInterno[]>([])
  const [precios, setPrecios] = useState<PagoInternoPrecio[]>([])
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [formConcepto, setFormConcepto] = useState<ConceptoInternoInput>(CONCEPTO_VACIO)
  const [editandoConcepto, setEditandoConcepto] = useState(false)

  const [formPrecio, setFormPrecio] = useState<PagoInternoPrecioInput>({
    ...PRECIO_VACIO,
    precio_ciclo_escolar: cicloSeleccionado,
  })
  const [editandoPrecioId, setEditandoPrecioId] = useState<number | null>(null)
  const [filtroCicloPrecio, setFiltroCicloPrecio] = useState(cicloSeleccionado)

  const gradosOpciones: GradoEscolarOpcion[] =
    formPrecio.alumno_nivel > 0
      ? [
          ...gradoOpcionesPorNivel(formPrecio.alumno_nivel),
          { valor: 0, etiqueta: 'Todo el nivel (0)' },
        ]
      : [{ valor: 0, etiqueta: 'Todo el nivel (0)' }]

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    const [c, p] = await Promise.all([
      listarConceptosInternos(),
      listarPreciosInternos(filtroCicloPrecio),
    ])
    setConceptos(c)
    setPrecios(p)
    setCargando(false)
  }, [filtroCicloPrecio])

  useEffect(() => {
    if (!abierto) return
    setTab(tabInicial)
    setFiltroCicloPrecio(cicloSeleccionado)
    setFormPrecio((f) => ({ ...f, precio_ciclo_escolar: cicloSeleccionado }))
    cargar()
  }, [abierto, tabInicial, cicloSeleccionado, cargar])

  useEffect(() => {
    if (abierto) cargar()
  }, [filtroCicloPrecio, abierto, cargar])

  if (!abierto) return null

  const resetConcepto = () => {
    setEditandoConcepto(false)
    const maxId = conceptos.reduce((m, c) => Math.max(m, c.concepto_id), 0)
    setFormConcepto({ ...CONCEPTO_VACIO, concepto_id: maxId + 1 })
  }

  const onEditarConcepto = (c: ConceptoInterno) => {
    setEditandoConcepto(true)
    setFormConcepto({
      concepto_id: c.concepto_id,
      concepto_clase: c.concepto_clase ?? '',
      visible: c.visible,
      orden_visible: c.orden_visible,
    })
  }

  const onGuardarConcepto = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)
    setError(null)
    const res = await guardarConceptoInterno(formConcepto, !editandoConcepto)
    setGuardando(false)
    if (!res.ok) {
      setError(res.mensaje)
      return
    }
    setMensaje(editandoConcepto ? 'Concepto actualizado.' : 'Concepto creado.')
    resetConcepto()
    await cargar()
    onActualizado?.()
  }

  const onEliminarConcepto = async (c: ConceptoInterno) => {
    if (!window.confirm(`¿Eliminar el concepto «${c.concepto_clase}»?`)) return
    setGuardando(true)
    const res = await eliminarConceptoInterno(c.concepto_id)
    setGuardando(false)
    if (!res.ok) {
      setError(res.mensaje)
      return
    }
    setMensaje('Concepto eliminado.')
    if (editandoConcepto && formConcepto.concepto_id === c.concepto_id) resetConcepto()
    await cargar()
    onActualizado?.()
  }

  const resetPrecio = () => {
    setEditandoPrecioId(null)
    setFormPrecio({
      ...PRECIO_VACIO,
      precio_ciclo_escolar: filtroCicloPrecio,
      concepto_id: conceptos[0]?.concepto_id ?? 0,
    })
  }

  const onEditarPrecio = (p: PagoInternoPrecio) => {
    setEditandoPrecioId(p.precio_interno_id)
    setFormPrecio({
      precio_interno_id: p.precio_interno_id,
      alumno_nivel: p.alumno_nivel,
      alumno_grado: p.alumno_grado,
      concepto_id: p.concepto_id,
      precio_interno: p.precio_interno,
      precio_ciclo_escolar: p.precio_ciclo_escolar,
    })
  }

  const onGuardarPrecio = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)
    setError(null)
    const res = await guardarPrecioInterno(formPrecio)
    setGuardando(false)
    if (!res.ok) {
      setError(res.mensaje)
      return
    }
    setMensaje(editandoPrecioId != null ? 'Precio actualizado.' : 'Precio creado.')
    resetPrecio()
    await cargar()
    onActualizado?.()
  }

  const onEliminarPrecio = async (p: PagoInternoPrecio) => {
    if (!window.confirm(`¿Eliminar precio #${p.precio_interno_id}?`)) return
    setGuardando(true)
    const res = await eliminarPrecioInterno(p.precio_interno_id)
    setGuardando(false)
    if (!res.ok) {
      setError(res.mensaje)
      return
    }
    setMensaje('Precio eliminado.')
    if (editandoPrecioId === p.precio_interno_id) resetPrecio()
    await cargar()
    onActualizado?.()
  }

  return (
    <div className="pi-modal-backdrop" role="presentation" onClick={onCerrar}>
      <div
        className="pi-modal"
        role="dialog"
        aria-labelledby="pi-modal-titulo"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pi-modal-header">
          <h2 id="pi-modal-titulo">Conceptos y precios de pagos internos</h2>
          <button type="button" className="pi-modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <X size={22} />
          </button>
        </header>

        <div className="pi-modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'conceptos'}
            className={tab === 'conceptos' ? 'active' : ''}
            onClick={() => setTab('conceptos')}
          >
            Conceptos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'precios'}
            className={tab === 'precios' ? 'active' : ''}
            onClick={() => setTab('precios')}
          >
            Precios por nivel
          </button>
        </div>

        {(mensaje || error) && (
          <p className={`pi-modal-msg ${error ? 'pi-modal-msg--error' : 'pi-modal-msg--ok'}`}>
            {error ?? mensaje}
          </p>
        )}

        {cargando ? (
          <div className="pi-modal-loading">
            <Loader2 size={24} className="pi-spin" aria-hidden />
            <span>Cargando catálogo…</span>
          </div>
        ) : tab === 'conceptos' ? (
          <div className="pi-modal-body pi-modal-body--split">
            <form className="pi-crud-form" onSubmit={onGuardarConcepto}>
              <h3>{editandoConcepto ? 'Editar concepto' : 'Nuevo concepto'}</h3>
              <label>
                ID
                <input
                  type="number"
                  required
                  min={1}
                  disabled={editandoConcepto}
                  value={formConcepto.concepto_id || ''}
                  onChange={(e) =>
                    setFormConcepto((f) => ({ ...f, concepto_id: Number(e.target.value) }))
                  }
                />
              </label>
              <label>
                Nombre del concepto
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={formConcepto.concepto_clase}
                  onChange={(e) =>
                    setFormConcepto((f) => ({ ...f, concepto_clase: e.target.value }))
                  }
                />
              </label>
              <label>
                Orden visible
                <input
                  type="number"
                  min={0}
                  value={formConcepto.orden_visible}
                  onChange={(e) =>
                    setFormConcepto((f) => ({ ...f, orden_visible: Number(e.target.value) }))
                  }
                />
              </label>
              <label className="pi-check">
                <input
                  type="checkbox"
                  checked={formConcepto.visible === 1}
                  onChange={(e) =>
                    setFormConcepto((f) => ({ ...f, visible: e.target.checked ? 1 : 0 }))
                  }
                />
                Visible en listados
              </label>
              <div className="pi-crud-acciones">
                <button type="submit" className="pi-btn pi-btn--primary" disabled={guardando}>
                  {editandoConcepto ? 'Guardar cambios' : 'Crear concepto'}
                </button>
                {editandoConcepto && (
                  <button type="button" className="pi-btn pi-btn--ghost" onClick={resetConcepto}>
                    Cancelar edición
                  </button>
                )}
              </div>
            </form>
            <div className="pi-crud-tabla-wrap">
              <table className="pi-crud-tabla">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Concepto</th>
                    <th>Visible</th>
                    <th>Orden</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {conceptos.map((c) => (
                    <tr key={c.concepto_id}>
                      <td>{c.concepto_id}</td>
                      <td>{c.concepto_clase}</td>
                      <td>{c.visible ? 'Sí' : 'No'}</td>
                      <td>{c.orden_visible}</td>
                      <td className="pi-crud-celda-acciones">
                        <button
                          type="button"
                          className="pi-icon-btn"
                          title="Editar"
                          onClick={() => onEditarConcepto(c)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="pi-icon-btn pi-icon-btn--danger"
                          title="Eliminar"
                          onClick={() => onEliminarConcepto(c)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="pi-modal-body pi-modal-body--split">
            <form className="pi-crud-form" onSubmit={onGuardarPrecio}>
              <h3>{editandoPrecioId != null ? 'Editar precio' : 'Nuevo precio'}</h3>
              <label>
                Ciclo escolar
                <select
                  value={String(formPrecio.precio_ciclo_escolar)}
                  onChange={(e) =>
                    setFormPrecio((f) => ({
                      ...f,
                      precio_ciclo_escolar: Number(e.target.value),
                    }))
                  }
                >
                  {opcionesCatalogo.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Concepto
                <select
                  required
                  value={formPrecio.concepto_id || ''}
                  onChange={(e) =>
                    setFormPrecio((f) => ({ ...f, concepto_id: Number(e.target.value) }))
                  }
                >
                  <option value="">Seleccionar</option>
                  {conceptos.map((c) => (
                    <option key={c.concepto_id} value={c.concepto_id}>
                      {c.concepto_clase}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nivel
                <select
                  value={formPrecio.alumno_nivel}
                  onChange={(e) =>
                    setFormPrecio((f) => ({
                      ...f,
                      alumno_nivel: Number(e.target.value),
                      alumno_grado: 0,
                    }))
                  }
                >
                  <option value={0}>Genérico (0)</option>
                  {NIVELES_ESCOLARES_OPCIONES.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Grado
                <select
                  value={formPrecio.alumno_grado}
                  onChange={(e) =>
                    setFormPrecio((f) => ({ ...f, alumno_grado: Number(e.target.value) }))
                  }
                >
                  {gradosOpciones.map((g) => (
                    <option key={g.valor} value={g.valor}>
                      {g.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Costo
                <input
                  type="number"
                  required
                  min={0}
                  step={0.01}
                  value={formPrecio.precio_interno || ''}
                  onChange={(e) =>
                    setFormPrecio((f) => ({ ...f, precio_interno: Number(e.target.value) }))
                  }
                />
              </label>
              <div className="pi-crud-acciones">
                <button type="submit" className="pi-btn pi-btn--primary" disabled={guardando}>
                  {editandoPrecioId != null ? 'Guardar cambios' : 'Añadir precio'}
                </button>
                {editandoPrecioId != null && (
                  <button type="button" className="pi-btn pi-btn--ghost" onClick={resetPrecio}>
                    Cancelar edición
                  </button>
                )}
              </div>
            </form>
            <div className="pi-crud-tabla-wrap">
              <label className="pi-filtro-ciclo">
                Filtrar ciclo:
                <select
                  value={String(filtroCicloPrecio)}
                  onChange={(e) => setFiltroCicloPrecio(Number(e.target.value))}
                >
                  {opcionesCatalogo.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <table className="pi-crud-tabla">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Nivel</th>
                    <th>Grado</th>
                    <th>Costo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {precios.map((p) => (
                    <tr key={p.precio_interno_id}>
                      <td>
                        {conceptos.find((c) => c.concepto_id === p.concepto_id)?.concepto_clase ??
                          p.concepto_id}
                      </td>
                      <td>
                        {p.alumno_nivel === 0
                          ? 'Genérico'
                          : etiquetaNivelEscolar(p.alumno_nivel)}
                      </td>
                      <td>{p.alumno_grado === 0 ? 'Todo' : p.alumno_grado}</td>
                      <td>${p.precio_interno.toFixed(2)}</td>
                      <td className="pi-crud-celda-acciones">
                        <button
                          type="button"
                          className="pi-icon-btn"
                          title="Editar"
                          onClick={() => onEditarPrecio(p)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="pi-icon-btn pi-icon-btn--danger"
                          title="Eliminar"
                          onClick={() => onEliminarPrecio(p)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
