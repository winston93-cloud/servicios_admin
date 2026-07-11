'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { NIVELES_ESCOLARES_OPCIONES } from '@/lib/nivelEscolar'
import {
  CONCEPTO_TIPOS,
  etiquetaConceptoTipo,
  type ConceptoBoucherRegistro,
} from '@/lib/conceptoBoucherCatalogService'

type FormConcepto = {
  concepto_no: string
  concepto_clase: string
  alumno_nivel: number
  concepto_tipo: number
  concepto_descuento: boolean
}

const FORM_VACIO: FormConcepto = {
  concepto_no: '',
  concepto_clase: '',
  alumno_nivel: 0,
  concepto_tipo: 2,
  concepto_descuento: false,
}

function etiquetaNivelConcepto(nivel: number): string {
  if (nivel === 0) return 'Todos'
  return NIVELES_ESCOLARES_OPCIONES.find((n) => n.valor === nivel)?.etiqueta ?? `Nivel ${nivel}`
}

export default function ConceptosPagoCatalogo() {
  const [lista, setLista] = useState<ConceptoBoucherRegistro[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState<number | null>(null)
  const [form, setForm] = useState<FormConcepto>(FORM_VACIO)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/costos/conceptos')
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
        setLista([])
        return
      }
      setLista((data.conceptos ?? []) as ConceptoBoucherRegistro[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red')
      setLista([])
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

  const onEditar = (c: ConceptoBoucherRegistro) => {
    setEditandoId(c.concepto_id)
    setForm({
      concepto_no: c.concepto_no,
      concepto_clase: c.concepto_clase,
      alumno_nivel: c.alumno_nivel,
      concepto_tipo: c.concepto_tipo,
      concepto_descuento: c.concepto_descuento === 1,
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
      const payload = {
        concepto_no: form.concepto_no,
        concepto_clase: form.concepto_clase,
        alumno_nivel: form.alumno_nivel,
        concepto_tipo: form.concepto_tipo,
        concepto_descuento: form.concepto_descuento ? 1 : 0,
        ...(editandoId != null ? { concepto_id: editandoId } : {}),
      }
      const res = await fetch('/api/costos/conceptos', {
        method: editandoId != null ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo guardar')
        return
      }
      setMensaje(
        editandoId != null
          ? `Concepto ${data.concepto?.concepto_no} actualizado.`
          : `Concepto ${data.concepto?.concepto_no} creado.`
      )
      resetForm()
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setGuardando(false)
    }
  }

  const onEliminar = async (c: ConceptoBoucherRegistro) => {
    if (
      !window.confirm(
        `¿Eliminar el concepto «${c.concepto_no} — ${c.concepto_clase}»? Si ya hay pagos con ese código, puedes romper reportes.`
      )
    ) {
      return
    }
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      const res = await fetch(`/api/costos/conceptos?id=${c.concepto_id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo eliminar')
        return
      }
      setMensaje(`Concepto ${c.concepto_no} eliminado.`)
      if (editandoId === c.concepto_id) resetForm()
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="ciclos-crud-layout">
      <section className="ciclos-crud-form-card" aria-labelledby="conceptos-form-titulo">
        <h2 id="conceptos-form-titulo" className="ciclos-crud-form-title">
          {editandoId != null ? 'Editar concepto' : 'Nuevo concepto'}
        </h2>
        <form className="ciclos-crud-form" onSubmit={onGuardar}>
          <div className="ciclos-crud-field-row">
            <div className="ciclos-crud-field">
              <label htmlFor="concepto-no">Código (concepto_no)</label>
              <input
                id="concepto-no"
                type="text"
                required
                maxLength={2}
                pattern="\d{1,2}"
                placeholder="00"
                value={form.concepto_no}
                onChange={(e) =>
                  setForm((f) => ({ ...f, concepto_no: e.target.value.replace(/\D/g, '').slice(0, 2) }))
                }
              />
            </div>
            <div className="ciclos-crud-field">
              <label htmlFor="concepto-tipo">Tipo</label>
              <select
                id="concepto-tipo"
                value={form.concepto_tipo}
                onChange={(e) => setForm((f) => ({ ...f, concepto_tipo: Number(e.target.value) }))}
              >
                {CONCEPTO_TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.etiqueta}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="ciclos-crud-field">
            <label htmlFor="concepto-clase">Nombre (concepto_clase)</label>
            <input
              id="concepto-clase"
              type="text"
              required
              maxLength={100}
              value={form.concepto_clase}
              onChange={(e) => setForm((f) => ({ ...f, concepto_clase: e.target.value }))}
            />
          </div>

          <div className="ciclos-crud-field">
            <label htmlFor="concepto-nivel">Nivel aplicable</label>
            <select
              id="concepto-nivel"
              value={form.alumno_nivel}
              onChange={(e) => setForm((f) => ({ ...f, alumno_nivel: Number(e.target.value) }))}
            >
              <option value={0}>Todos los niveles</option>
              {NIVELES_ESCOLARES_OPCIONES.map((n) => (
                <option key={n.valor} value={n.valor}>
                  {n.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <label className="ciclos-crud-check">
            <input
              type="checkbox"
              checked={form.concepto_descuento}
              onChange={(e) => setForm((f) => ({ ...f, concepto_descuento: e.target.checked }))}
            />
            Aplica descuento de beca
          </label>

          {mensaje ? <p className="ciclos-crud-msg ciclos-crud-msg--ok">{mensaje}</p> : null}
          {error ? <p className="ciclos-crud-msg ciclos-crud-msg--error">{error}</p> : null}

          <div className="ciclos-crud-form-actions">
            <button
              type="submit"
              className="ciclos-crud-btn ciclos-crud-btn--primary"
              disabled={guardando}
            >
              {guardando ? <Loader2 size={18} className="ciclos-crud-spin" aria-hidden /> : null}
              {editandoId != null ? 'Actualizar' : 'Crear concepto'}
            </button>
            {editandoId != null ? (
              <button
                type="button"
                className="ciclos-crud-btn ciclos-crud-btn--ghost"
                onClick={resetForm}
                disabled={guardando}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="ciclos-crud-table-card" aria-labelledby="conceptos-lista-titulo">
        <div className="ciclos-crud-table-header">
          <h2 id="conceptos-lista-titulo" className="ciclos-crud-form-title">
            Conceptos registrados
          </h2>
          <button
            type="button"
            className="ciclos-crud-btn ciclos-crud-btn--secondary"
            onClick={resetForm}
            disabled={guardando}
          >
            <Plus size={16} aria-hidden />
            Nuevo
          </button>
        </div>

        {cargando ? (
          <p className="ciclos-crud-loading">
            <Loader2 size={18} className="ciclos-crud-spin" aria-hidden />
            Cargando…
          </p>
        ) : (
          <div className="ciclos-crud-table-wrap">
            <table className="ciclos-crud-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Nivel</th>
                  <th>Beca</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr
                    key={c.concepto_id}
                    className={editandoId === c.concepto_id ? 'ciclos-crud-row--active' : undefined}
                  >
                    <td>
                      <code>{c.concepto_no}</code>
                    </td>
                    <td>{c.concepto_clase}</td>
                    <td>{etiquetaConceptoTipo(c.concepto_tipo)}</td>
                    <td>{etiquetaNivelConcepto(c.alumno_nivel)}</td>
                    <td>{c.concepto_descuento ? 'Sí' : 'No'}</td>
                    <td>
                      <div className="ciclos-crud-actions">
                        <button
                          type="button"
                          className="ciclos-crud-icon-btn"
                          title="Editar"
                          onClick={() => onEditar(c)}
                          disabled={guardando}
                        >
                          <Pencil size={14} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="ciclos-crud-icon-btn ciclos-crud-icon-btn--danger"
                          title="Eliminar"
                          onClick={() => onEliminar(c)}
                          disabled={guardando}
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lista.length === 0 ? (
              <p className="servicios-panel-hint">No hay conceptos en concepto_boucher.</p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  )
}
