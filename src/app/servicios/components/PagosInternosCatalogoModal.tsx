'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import { gradoOpcionesPorNivel, type GradoEscolarOpcion } from '@/lib/gradoEscolar'
import { NIVELES_ESCOLARES_OPCIONES, etiquetaNivelEscolar } from '@/lib/nivelEscolar'
import {
  compararTextoAz,
  eliminarConceptoInterno,
  eliminarPrecioInterno,
  guardarConceptoInterno,
  guardarPrecioInterno,
  listarConceptosInternos,
  listarPreciosInternos,
  nombreConceptoInterno,
  ordenarConceptosAz,
  ordenarPreciosPorConceptoAz,
  type ConceptoInterno,
  type ConceptoInternoInput,
  type PagoInternoPrecio,
  type PagoInternoPrecioInput,
} from '@/lib/pagoInternoService'

type TabCatalogo = 'conceptos' | 'precios'
type FormModal =
  | null
  | 'alta-completo'
  | 'editar-concepto'
  | 'editar-precio'

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
  const [busqueda, setBusqueda] = useState('')
  const [formModal, setFormModal] = useState<FormModal>(null)

  const [formConcepto, setFormConcepto] = useState<ConceptoInternoInput>(CONCEPTO_VACIO)
  const [formPrecio, setFormPrecio] = useState<PagoInternoPrecioInput>({
    ...PRECIO_VACIO,
    precio_ciclo_escolar: cicloSeleccionado,
  })
  const [filtroCicloPrecio, setFiltroCicloPrecio] = useState(cicloSeleccionado)

  const conceptosAz = useMemo(() => ordenarConceptosAz(conceptos), [conceptos])
  const preciosAz = useMemo(
    () => ordenarPreciosPorConceptoAz(precios, conceptosAz),
    [precios, conceptosAz]
  )

  const terminoBusqueda = busqueda.trim().toLowerCase()

  const sugerenciasBusqueda = useMemo(() => {
    const nombres = new Set<string>()
    for (const c of conceptosAz) {
      if (c.concepto_clase) nombres.add(c.concepto_clase)
    }
    return [...nombres].sort((a, b) => compararTextoAz(a, b))
  }, [conceptosAz])

  const conceptosFiltrados = useMemo(() => {
    if (!terminoBusqueda) return conceptosAz
    return conceptosAz.filter((c) =>
      (c.concepto_clase ?? '').toLowerCase().includes(terminoBusqueda)
    )
  }, [conceptosAz, terminoBusqueda])

  const preciosFiltrados = useMemo(() => {
    if (!terminoBusqueda) return preciosAz
    return preciosAz.filter((p) => {
      const nombre = nombreConceptoInterno(p.concepto_id, conceptosAz).toLowerCase()
      const nivel =
        p.alumno_nivel === 0 ? 'genérico' : etiquetaNivelEscolar(p.alumno_nivel).toLowerCase()
      return (
        nombre.includes(terminoBusqueda) ||
        nivel.includes(terminoBusqueda) ||
        String(p.alumno_grado).includes(terminoBusqueda) ||
        String(p.precio_interno).includes(terminoBusqueda)
      )
    })
  }, [preciosAz, conceptosAz, terminoBusqueda])

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
    setBusqueda('')
    setFormModal(null)
    setFiltroCicloPrecio(cicloSeleccionado)
    setFormPrecio((f) => ({ ...f, precio_ciclo_escolar: cicloSeleccionado }))
    cargar()
  }, [abierto, tabInicial, cicloSeleccionado, cargar])

  useEffect(() => {
    if (abierto) cargar()
  }, [filtroCicloPrecio, abierto, cargar])

  if (!abierto) return null

  const nuevoIdConcepto = () => conceptos.reduce((m, c) => Math.max(m, c.concepto_id), 0) + 1

  const abrirAltaCompleto = () => {
    const id = nuevoIdConcepto()
    setFormConcepto({ ...CONCEPTO_VACIO, concepto_id: id })
    setFormPrecio({
      ...PRECIO_VACIO,
      precio_ciclo_escolar: filtroCicloPrecio,
      concepto_id: id,
    })
    setFormModal('alta-completo')
    setError(null)
    setMensaje(null)
  }

  const abrirEditarConcepto = (c: ConceptoInterno) => {
    setFormConcepto({
      concepto_id: c.concepto_id,
      concepto_clase: c.concepto_clase ?? '',
      visible: c.visible,
      orden_visible: c.orden_visible,
    })
    setFormModal('editar-concepto')
    setError(null)
    setMensaje(null)
  }

  const abrirEditarPrecio = (p: PagoInternoPrecio) => {
    setFormPrecio({
      precio_interno_id: p.precio_interno_id,
      alumno_nivel: p.alumno_nivel,
      alumno_grado: p.alumno_grado,
      concepto_id: p.concepto_id,
      precio_interno: p.precio_interno,
      precio_ciclo_escolar: p.precio_ciclo_escolar,
    })
    setFormModal('editar-precio')
    setError(null)
    setMensaje(null)
  }

  const cerrarFormModal = () => setFormModal(null)

  const onGuardarConcepto = async (e: React.FormEvent, esNuevo: boolean) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)
    setError(null)
    const res = await guardarConceptoInterno(formConcepto, esNuevo)
    setGuardando(false)
    if (!res.ok) {
      setError(res.mensaje)
      return
    }
    setMensaje(esNuevo ? 'Concepto creado.' : 'Concepto actualizado.')
    cerrarFormModal()
    await cargar()
    onActualizado?.()
  }

  const onGuardarAltaCompleto = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)
    setError(null)
    const resConcepto = await guardarConceptoInterno(formConcepto, true)
    if (!resConcepto.ok) {
      setGuardando(false)
      setError(resConcepto.mensaje)
      return
    }
    const precioPayload: PagoInternoPrecioInput = {
      ...formPrecio,
      concepto_id: formConcepto.concepto_id,
      precio_ciclo_escolar: formPrecio.precio_ciclo_escolar || filtroCicloPrecio,
    }
    const resPrecio = await guardarPrecioInterno(precioPayload)
    setGuardando(false)
    if (!resPrecio.ok) {
      setError(resPrecio.mensaje)
      await cargar()
      onActualizado?.()
      return
    }
    setMensaje('Concepto y precio registrados.')
    cerrarFormModal()
    await cargar()
    onActualizado?.()
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
    setMensaje(formPrecio.precio_interno_id ? 'Precio actualizado.' : 'Precio creado.')
    cerrarFormModal()
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
    await cargar()
    onActualizado?.()
  }

  const onEliminarPrecio = async (p: PagoInternoPrecio) => {
    const nombre = nombreConceptoInterno(p.concepto_id, conceptosAz)
    if (!window.confirm(`¿Eliminar el precio de «${nombre}»?`)) return
    setGuardando(true)
    const res = await eliminarPrecioInterno(p.precio_interno_id)
    setGuardando(false)
    if (!res.ok) {
      setError(res.mensaje)
      return
    }
    setMensaje('Precio eliminado.')
    await cargar()
    onActualizado?.()
  }

  const tituloForm =
    formModal === 'alta-completo'
      ? 'Agregar concepto y precio'
      : formModal === 'editar-concepto'
        ? 'Modificar concepto'
        : formModal === 'editar-precio'
          ? 'Modificar precio'
          : ''

  return (
    <div className="pi-modal-backdrop" role="presentation" onClick={onCerrar}>
      <div
        className="pi-modal pi-modal--catalogo"
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

        <div className="pi-catalogo-toolbar">
          <label className="pi-catalogo-busqueda">
            <span className="pi-catalogo-busqueda-label">Buscar</span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre de concepto, nivel, grado…"
              list="pi-catalogo-sugerencias"
              autoComplete="off"
            />
            <datalist id="pi-catalogo-sugerencias">
              {sugerenciasBusqueda.map((nombre) => (
                <option key={nombre} value={nombre} />
              ))}
            </datalist>
          </label>
          <button
            type="button"
            className="pi-btn pi-btn--primary"
            onClick={abrirAltaCompleto}
            disabled={guardando}
          >
            Agregar concepto y precio
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
          <div className="pi-modal-body pi-modal-body--lista">
            <div className="pi-crud-tabla-wrap">
              <table className="pi-crud-tabla">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Concepto</th>
                    <th>Visible</th>
                    <th>Orden</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {conceptosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="pi-crud-vacio">
                        No hay conceptos que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    conceptosFiltrados.map((c) => (
                      <tr key={c.concepto_id}>
                        <td>{c.concepto_id}</td>
                        <td>{c.concepto_clase}</td>
                        <td>{c.visible ? 'Sí' : 'No'}</td>
                        <td>{c.orden_visible}</td>
                        <td className="pi-crud-celda-acciones">
                          <button
                            type="button"
                            className="pi-btn pi-btn--ghost pi-btn--sm"
                            onClick={() => abrirEditarConcepto(c)}
                          >
                            Modificar
                          </button>
                          <button
                            type="button"
                            className="pi-btn pi-btn--danger pi-btn--sm"
                            onClick={() => onEliminarConcepto(c)}
                            disabled={guardando}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="pi-modal-body pi-modal-body--lista">
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
            <div className="pi-crud-tabla-wrap">
              <table className="pi-crud-tabla">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Nivel</th>
                    <th>Grado</th>
                    <th>Costo</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {preciosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="pi-crud-vacio">
                        No hay precios que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    preciosFiltrados.map((p) => (
                      <tr key={p.precio_interno_id}>
                        <td>{nombreConceptoInterno(p.concepto_id, conceptosAz)}</td>
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
                            className="pi-btn pi-btn--ghost pi-btn--sm"
                            onClick={() => abrirEditarPrecio(p)}
                          >
                            Modificar
                          </button>
                          <button
                            type="button"
                            className="pi-btn pi-btn--danger pi-btn--sm"
                            onClick={() => onEliminarPrecio(p)}
                            disabled={guardando}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {formModal && (
        <div
          className="pi-form-modal-backdrop"
          role="presentation"
          onClick={cerrarFormModal}
        >
          <div
            className="pi-form-modal"
            role="dialog"
            aria-labelledby="pi-form-modal-titulo"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="pi-form-modal-header">
              <h3 id="pi-form-modal-titulo">{tituloForm}</h3>
              <button
                type="button"
                className="pi-modal-cerrar"
                onClick={cerrarFormModal}
                aria-label="Cerrar formulario"
              >
                <X size={20} />
              </button>
            </header>

            {error && <p className="pi-modal-msg pi-modal-msg--error">{error}</p>}

            {formModal === 'alta-completo' && (
              <form className="pi-crud-form" onSubmit={onGuardarAltaCompleto}>
                <fieldset className="pi-crud-fieldset">
                  <legend>Concepto</legend>
                  <label>
                    ID
                    <input
                      type="number"
                      required
                      min={1}
                      value={formConcepto.concepto_id || ''}
                      onChange={(e) => {
                        const id = Number(e.target.value)
                        setFormConcepto((f) => ({ ...f, concepto_id: id }))
                        setFormPrecio((f) => ({ ...f, concepto_id: id }))
                      }}
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
                </fieldset>
                <fieldset className="pi-crud-fieldset">
                  <legend>Precio</legend>
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
                </fieldset>
                <div className="pi-crud-acciones">
                  <button type="submit" className="pi-btn pi-btn--primary" disabled={guardando}>
                    Guardar concepto y precio
                  </button>
                  <button
                    type="button"
                    className="pi-btn pi-btn--ghost"
                    onClick={cerrarFormModal}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {formModal === 'editar-concepto' && (
              <form
                className="pi-crud-form"
                onSubmit={(e) => onGuardarConcepto(e, false)}
              >
                <label>
                  ID
                  <input type="number" disabled value={formConcepto.concepto_id} />
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
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    className="pi-btn pi-btn--ghost"
                    onClick={cerrarFormModal}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            {formModal === 'editar-precio' && (
              <form className="pi-crud-form" onSubmit={onGuardarPrecio}>
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
                    {conceptosAz.map((c) => (
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
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    className="pi-btn pi-btn--ghost"
                    onClick={cerrarFormModal}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
