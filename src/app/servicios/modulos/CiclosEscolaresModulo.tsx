'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCicloEscolar } from '@/contexts/CicloEscolarContext'
import {
  actualizarCicloEscolar,
  crearCicloEscolar,
  eliminarCicloEscolar,
  listarCiclosEscolares,
  type CicloEscolarInput,
  type CicloEscolarRegistro,
} from '@/lib/ciclosEscolaresService'

const FORM_VACIO: CicloEscolarInput = {
  valor: 0,
  nombre: '',
  anio_inicio: new Date().getFullYear(),
  anio_fin: new Date().getFullYear() + 1,
  activo: true,
  es_actual: false,
}

export default function CiclosEscolaresModulo() {
  const { recargarCiclos } = useCicloEscolar()
  const [lista, setLista] = useState<CicloEscolarRegistro[]>([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<CicloEscolarInput>(FORM_VACIO)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const datos = await listarCiclosEscolares()
      setLista(datos)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar ciclos.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const resetForm = () => {
    setEditandoId(null)
    setForm(FORM_VACIO)
  }

  const onEditar = (ciclo: CicloEscolarRegistro) => {
    setEditandoId(ciclo.id)
    setForm({
      valor: ciclo.valor,
      nombre: ciclo.nombre,
      anio_inicio: ciclo.anio_inicio,
      anio_fin: ciclo.anio_fin,
      activo: ciclo.activo,
      es_actual: ciclo.es_actual,
    })
    setMensaje(null)
    setError(null)
  }

  const onGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)
    setError(null)

    try {
      if (editandoId != null) {
        await actualizarCicloEscolar(editandoId, form)
        setMensaje('Ciclo actualizado correctamente.')
      } else {
        await crearCicloEscolar(form)
        setMensaje('Ciclo creado correctamente.')
      }
      await cargar()
      await recargarCiclos()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el ciclo.')
    } finally {
      setGuardando(false)
    }
  }

  const onEliminar = async (ciclo: CicloEscolarRegistro) => {
    if (
      !window.confirm(
        `¿Eliminar el ciclo «${ciclo.nombre}» (valor ${ciclo.valor})? Esta acción no se puede deshacer.`
      )
    ) {
      return
    }

    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      await eliminarCicloEscolar(ciclo.id)
      setMensaje('Ciclo eliminado.')
      if (editandoId === ciclo.id) resetForm()
      await cargar()
      await recargarCiclos()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el ciclo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="servicios-panel-inner">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Catálogo de ciclos escolares</h1>
        <p className="servicios-panel-lead">
          Administra los ciclos de la tabla <code>ciclos_escolares</code>. El ciclo marcado como
          actual define el predeterminado del sistema; el selector superior filtra alumnos por el
          valor en <code>alumno_ciclo_escolar</code>.
        </p>
      </header>

      <div className="ciclos-crud-layout">
        <section className="ciclos-crud-form-card" aria-labelledby="ciclos-form-titulo">
          <h2 id="ciclos-form-titulo" className="ciclos-crud-form-title">
            {editandoId != null ? 'Editar ciclo' : 'Nuevo ciclo'}
          </h2>
          <form className="ciclos-crud-form" onSubmit={onGuardar}>
            <div className="ciclos-crud-field">
              <label htmlFor="ciclo-valor">Valor (alumno_ciclo_escolar)</label>
              <input
                id="ciclo-valor"
                type="number"
                required
                min={1}
                value={form.valor || ''}
                onChange={(e) => setForm((f) => ({ ...f, valor: Number(e.target.value) }))}
              />
            </div>
            <div className="ciclos-crud-field">
              <label htmlFor="ciclo-nombre">Nombre</label>
              <input
                id="ciclo-nombre"
                type="text"
                required
                maxLength={20}
                placeholder="2025-2026"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div className="ciclos-crud-field-row">
              <div className="ciclos-crud-field">
                <label htmlFor="ciclo-inicio">Año inicio</label>
                <input
                  id="ciclo-inicio"
                  type="number"
                  required
                  value={form.anio_inicio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, anio_inicio: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="ciclos-crud-field">
                <label htmlFor="ciclo-fin">Año fin</label>
                <input
                  id="ciclo-fin"
                  type="number"
                  required
                  value={form.anio_fin}
                  onChange={(e) => setForm((f) => ({ ...f, anio_fin: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="ciclos-crud-checks">
              <label className="ciclos-crud-check">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                />
                Activo
              </label>
              <label className="ciclos-crud-check">
                <input
                  type="checkbox"
                  checked={form.es_actual}
                  onChange={(e) => setForm((f) => ({ ...f, es_actual: e.target.checked }))}
                />
                Ciclo actual del sistema
              </label>
            </div>
            <div className="ciclos-crud-form-actions">
              <button type="submit" className="ciclos-crud-btn ciclos-crud-btn--primary" disabled={guardando}>
                {guardando ? <Loader2 size={18} className="ciclos-crud-spin" aria-hidden /> : null}
                {editandoId != null ? 'Actualizar' : 'Crear ciclo'}
              </button>
              {editandoId != null && (
                <button
                  type="button"
                  className="ciclos-crud-btn ciclos-crud-btn--ghost"
                  onClick={resetForm}
                  disabled={guardando}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="ciclos-crud-table-card" aria-labelledby="ciclos-tabla-titulo">
          <div className="ciclos-crud-table-header">
            <h2 id="ciclos-tabla-titulo" className="ciclos-crud-form-title">
              Ciclos registrados
            </h2>
            <button
              type="button"
              className="ciclos-crud-btn ciclos-crud-btn--secondary"
              onClick={() => {
                resetForm()
                setMensaje(null)
                setError(null)
              }}
            >
              <Plus size={16} aria-hidden />
              Nuevo
            </button>
          </div>

          {mensaje && <p className="ciclos-crud-msg ciclos-crud-msg--ok">{mensaje}</p>}
          {error && (
            <p className="ciclos-crud-msg ciclos-crud-msg--error" role="alert">
              {error}
            </p>
          )}

          {cargando ? (
            <p className="ciclos-crud-loading">
              <Loader2 size={20} className="ciclos-crud-spin" aria-hidden />
              Cargando ciclos…
            </p>
          ) : (
            <div className="ciclos-crud-table-wrap">
              <table className="ciclos-crud-table">
                <thead>
                  <tr>
                    <th>Valor</th>
                    <th>Nombre</th>
                    <th>Años</th>
                    <th>Activo</th>
                    <th>Actual</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((ciclo) => (
                    <tr key={ciclo.id} className={editandoId === ciclo.id ? 'ciclos-crud-row--active' : ''}>
                      <td>{ciclo.valor}</td>
                      <td>{ciclo.nombre}</td>
                      <td>
                        {ciclo.anio_inicio}–{ciclo.anio_fin}
                      </td>
                      <td>{ciclo.activo ? 'Sí' : 'No'}</td>
                      <td>{ciclo.es_actual ? 'Sí' : 'No'}</td>
                      <td className="ciclos-crud-actions">
                        <button
                          type="button"
                          className="ciclos-crud-icon-btn"
                          onClick={() => onEditar(ciclo)}
                          aria-label={`Editar ${ciclo.nombre}`}
                        >
                          <Pencil size={16} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="ciclos-crud-icon-btn ciclos-crud-icon-btn--danger"
                          onClick={() => onEliminar(ciclo)}
                          aria-label={`Eliminar ${ciclo.nombre}`}
                          disabled={guardando}
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
