'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { posApi } from '@/lib/pos/posApi'
import type { PosExterno, PosExternoInput } from '@/lib/pos/posTipos'
import { iniciales } from './ClienteBuscador'
import { useToast } from './Toast'

const VACIO: PosExternoInput = { nombre: '', app: '', apm: '' }

export default function ExternosView() {
  const toast = useToast()
  const [externos, setExternos] = useState<PosExterno[]>([])
  const [cargando, setCargando] = useState(true)
  const [q, setQ] = useState('')
  const [form, setForm] = useState<PosExternoInput | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [borrando, setBorrando] = useState<number | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setExternos(await posApi.externos())
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cargar la lista.', 'error')
    } finally {
      setCargando(false)
    }
  }, [toast])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? externos.filter((e) => e.nombreCompleto.toLowerCase().includes(t)) : externos
  }, [externos, q])

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setGuardando(true)
    try {
      await posApi.guardarExterno(form)
      toast(form.id ? 'Datos actualizados.' : 'Externo agregado. Ya aparece en la búsqueda de caja.', 'ok')
      setForm(null)
      await cargar()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo guardar.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id: number) => {
    try {
      await posApi.eliminarExterno(id)
      toast('Externo eliminado.', 'ok')
      setExternos((xs) => xs.filter((x) => x.id !== id))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo eliminar.', 'error')
    } finally {
      setBorrando(null)
    }
  }

  return (
    <div className="cj-page">
      <header className="cj-page-head">
        <div>
          <h1 className="cj-h1">Externos</h1>
          <p className="cj-muted">Personas que no son alumnos ni docentes (intendencia, visitas, proveedores…).</p>
        </div>
        <button type="button" className="cj-btn cj-btn--primary" onClick={() => setForm({ ...VACIO })}>
          <Plus size={16} aria-hidden /> Agregar externo
        </button>
      </header>

      <div className="cj-toolbar">
        <div className="cj-input-wrap cj-input-wrap--sm">
          <Search size={16} className="cj-input-icon" aria-hidden />
          <input className="cj-input" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar externo" />
        </div>
        <span className="cj-muted">{externos.length} registrados</span>
      </div>

      {cargando ? (
        <div className="cj-skeleton-list" aria-busy="true">
          <div className="cj-skeleton" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="cj-card cj-empty">
          <p>{externos.length ? 'Sin coincidencias.' : 'Aún no hay externos registrados.'}</p>
        </div>
      ) : (
        <ul className="cj-people">
          {filtrados.map((x) => (
            <li key={x.id} className="cj-card cj-person">
              <span className="cj-avatar cj-avatar--externo" aria-hidden>
                {iniciales(x.nombreCompleto)}
              </span>
              <div className="cj-person-info">
                <span className="cj-strong">{x.nombreCompleto}</span>
                <span className="cj-muted cj-small">Ref. E{x.id}</span>
              </div>
              {borrando === x.id ? (
                <div className="cj-inline-confirm">
                  <span>¿Eliminar?</span>
                  <button type="button" className="cj-btn cj-btn--danger cj-btn--sm" onClick={() => void eliminar(x.id)}>
                    Sí
                  </button>
                  <button type="button" className="cj-btn cj-btn--ghost cj-btn--sm" onClick={() => setBorrando(null)}>
                    No
                  </button>
                </div>
              ) : (
                <div className="cj-person-actions">
                  <button
                    type="button"
                    className="cj-icon-btn cj-icon-btn--sm"
                    onClick={() => setForm({ id: x.id, nombre: x.nombre, app: x.app, apm: x.apm })}
                    aria-label={`Editar ${x.nombreCompleto}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="cj-icon-btn cj-icon-btn--sm cj-icon-btn--danger"
                    onClick={() => setBorrando(x.id)}
                    aria-label={`Eliminar ${x.nombreCompleto}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {form ? (
        <div className="cj-overlay" role="dialog" aria-modal="true" aria-labelledby="cj-ext-title" onClick={() => setForm(null)}>
          <form className="cj-dialog cj-dialog--sm" onSubmit={guardar} onClick={(e) => e.stopPropagation()}>
            <header className="cj-dialog-head">
              <h3 id="cj-ext-title">{form.id ? 'Editar externo' : 'Agregar externo'}</h3>
              <button type="button" className="cj-icon-btn cj-icon-btn--sm" onClick={() => setForm(null)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>
            <div className="cj-form-grid cj-form-grid--1">
              <label className="cj-field">
                <span>Nombre(s)</span>
                <input className="cj-input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required autoFocus maxLength={60} />
              </label>
              <label className="cj-field">
                <span>Apellido paterno</span>
                <input className="cj-input" value={form.app} onChange={(e) => setForm({ ...form, app: e.target.value })} required maxLength={60} />
              </label>
              <label className="cj-field">
                <span>Apellido materno</span>
                <input className="cj-input" value={form.apm} onChange={(e) => setForm({ ...form, apm: e.target.value })} maxLength={60} />
              </label>
            </div>
            <footer className="cj-dialog-foot">
              <button type="button" className="cj-btn cj-btn--ghost" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <button type="submit" className="cj-btn cj-btn--primary" disabled={guardando}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  )
}
