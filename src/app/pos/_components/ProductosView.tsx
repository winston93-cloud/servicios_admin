'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import { posApi } from '@/lib/pos/posApi'
import { moneda, type PosProducto, type PosProductoInput } from '@/lib/pos/posTipos'
import { useToast } from './Toast'

const VACIO: PosProductoInput = { nombre: '', abreviatura: '', costo: 0, montoLudi: 0, codigoReporte: '', activo: true }

export default function ProductosView({ onCambio }: { onCambio: () => void }) {
  const toast = useToast()
  const [productos, setProductos] = useState<PosProducto[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState<PosProductoInput | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setProductos(await posApi.productos(true))
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.', 'error')
    } finally {
      setCargando(false)
    }
  }, [toast])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const editar = (p: PosProducto) =>
    setForm({
      id: p.id,
      nombre: p.nombre,
      abreviatura: p.abreviatura,
      costo: p.costo,
      montoLudi: p.montoLudi,
      codigoReporte: p.codigoReporte ?? '',
      activo: p.activo,
    })

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setGuardando(true)
    try {
      await posApi.guardarProducto(form)
      toast(form.id ? 'Producto actualizado.' : 'Producto creado.', 'ok')
      setForm(null)
      await cargar()
      onCambio()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo guardar.', 'error')
    } finally {
      setGuardando(false)
    }
  }

  const set = <K extends keyof PosProductoInput>(k: K, v: PosProductoInput[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f))

  return (
    <div className="cj-page">
      <header className="cj-page-head">
        <div>
          <h1 className="cj-h1">Productos</h1>
          <p className="cj-muted">Precios, códigos rápidos y reparto entre Ludy y caja para los reportes.</p>
        </div>
        <button type="button" className="cj-btn cj-btn--primary" onClick={() => setForm({ ...VACIO })}>
          <Plus size={16} aria-hidden /> Nuevo producto
        </button>
      </header>

      <div className="cj-card cj-table-card">
        <div className="cj-table-scroll">
          <table className="cj-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th className="is-num">Precio</th>
                <th className="is-num">Ludy</th>
                <th className="is-num">Caja</th>
                <th>Reporte</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={8} className="cj-muted">Cargando…</td>
                </tr>
              ) : (
                productos.map((p) => (
                  <tr key={p.id} className={p.activo ? '' : 'is-off'}>
                    <td>
                      <span className="cj-prod-code">{p.abreviatura}</span>
                    </td>
                    <td className="cj-strong">{p.nombre}</td>
                    <td className="is-num">{moneda(p.costo)}</td>
                    <td className="is-num">{moneda(p.montoLudi)}</td>
                    <td className="is-num">{moneda(p.costo - p.montoLudi)}</td>
                    <td className="cj-muted">{p.codigoReporte ?? '—'}</td>
                    <td>
                      <span className={`cj-badge ${p.activo ? 'cj-badge--ok' : 'cj-badge--off'}`}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="is-actions">
                      <button type="button" className="cj-icon-btn cj-icon-btn--sm" onClick={() => editar(p)} aria-label={`Editar ${p.nombre}`}>
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {form ? (
        <div className="cj-overlay" role="dialog" aria-modal="true" aria-labelledby="cj-prod-title" onClick={() => setForm(null)}>
          <form className="cj-dialog" onSubmit={guardar} onClick={(e) => e.stopPropagation()}>
            <header className="cj-dialog-head">
              <h3 id="cj-prod-title">{form.id ? 'Editar producto' : 'Nuevo producto'}</h3>
              <button type="button" className="cj-icon-btn cj-icon-btn--sm" onClick={() => setForm(null)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </header>
            <div className="cj-form-grid">
              <label className="cj-field cj-field--wide">
                <span>Nombre</span>
                <input className="cj-input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required maxLength={80} autoFocus />
              </label>
              <label className="cj-field">
                <span>Código rápido</span>
                <input
                  className="cj-input cj-input--mono"
                  value={form.abreviatura}
                  onChange={(e) => set('abreviatura', e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  required
                  maxLength={10}
                />
              </label>
              <label className="cj-field">
                <span>Código en reporte</span>
                <input
                  className="cj-input"
                  value={form.codigoReporte ?? ''}
                  onChange={(e) => set('codigoReporte', e.target.value.toUpperCase())}
                  maxLength={20}
                  placeholder="Ej. DCH"
                />
              </label>
              <label className="cj-field">
                <span>Precio</span>
                <input
                  className="cj-input"
                  type="number"
                  min={0}
                  step="0.5"
                  inputMode="decimal"
                  value={form.costo || ''}
                  onChange={(e) => set('costo', parseFloat(e.target.value) || 0)}
                  required
                />
              </label>
              <label className="cj-field">
                <span>Para Ludy</span>
                <input
                  className="cj-input"
                  type="number"
                  min={0}
                  step="0.5"
                  inputMode="decimal"
                  value={form.montoLudi || ''}
                  onChange={(e) => set('montoLudi', parseFloat(e.target.value) || 0)}
                />
              </label>
              <div className="cj-field cj-field--wide cj-reparto">
                <span>Queda en caja</span>
                <strong>{moneda(Math.max(0, form.costo - form.montoLudi))}</strong>
              </div>
              <label className="cj-switch cj-field--wide">
                <input type="checkbox" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} />
                <span>Disponible en caja</span>
              </label>
            </div>
            <p className="cj-hint">
              Los cambios de precio aplican a ventas nuevas; las ventas ya registradas conservan su precio.
            </p>
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
