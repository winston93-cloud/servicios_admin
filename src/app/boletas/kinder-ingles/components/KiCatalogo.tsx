'use client'

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ETIQUETA_TIPO_KINDER_EN,
  etiquetaGradoKinderEn,
  type KinderEnFormato,
  type KinderEnIndicador,
  type KinderEnTipo,
} from '@/lib/boletasKinderEnCatalog'
import { kiApi } from './kiApi'

type Form = {
  id: number
  nombre: string
  formato: KinderEnFormato
  enPromedio: boolean
  activo: boolean
  orden: number
}

const AYUDA: Record<KinderEnTipo, string> = {
  subject:
    'Materias de la boleta por grado. Las marcadas «Cuenta para Average» entran al promedio (Music y Mindfulness no).',
  behavioral: 'Habilidades de conducta por grado. Se califican con la misma escala E · VG · G · R · S · NI.',
  maternal: 'Indicadores de la boleta de Maternal. «Días» es para School days / Days absent.',
}

/** CRUD de Subjects / Behavioral skills / Maternal. Desactivar oculta el indicador sin perder calificaciones. */
export default function KiCatalogo({ tipo }: { tipo: KinderEnTipo }) {
  const grados = tipo === 'maternal' ? [0] : [1, 2, 3]
  const [grado, setGrado] = useState(grados[0])
  const [todos, setTodos] = useState<KinderEnIndicador[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const data = await kiApi<{ indicadores: KinderEnIndicador[] }>(`/api/boletas-kinder-ingles/catalogo?tipo=${tipo}`)
      setTodos(data.indicadores)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.')
    } finally {
      setCargando(false)
    }
  }, [tipo])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const filas = useMemo(
    () => todos.filter((i) => i.grado === grado).sort((a, b) => a.orden - b.orden || a.id - b.id),
    [todos, grado]
  )

  async function guardarIndicador(datos: Partial<Form> & { id?: number; nombre: string }) {
    await kiApi('/api/boletas-kinder-ingles/catalogo', {
      method: 'POST',
      body: JSON.stringify({ tipo, grado, ...datos }),
    })
  }

  async function correr(fn: () => Promise<void>, ok: string) {
    setOcupado(true)
    setErr('')
    setMsg('')
    try {
      await fn()
      await cargar()
      setMsg(ok)
      return true
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar.')
      return false
    } finally {
      setOcupado(false)
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const f = form
    const ok = await correr(
      () =>
        guardarIndicador({
          id: f.id || undefined,
          nombre: f.nombre,
          formato: f.formato,
          enPromedio: f.enPromedio,
          activo: f.activo,
          orden: f.id ? f.orden : undefined,
        }),
      f.id ? 'Indicador actualizado.' : 'Indicador agregado.'
    )
    if (ok) setForm(null)
  }

  async function mover(idx: number, delta: -1 | 1) {
    const a = filas[idx]
    const b = filas[idx + delta]
    if (!a || !b) return
    await correr(async () => {
      const ordenA = a.orden === b.orden ? b.orden + delta : b.orden
      await guardarIndicador({ ...a, orden: ordenA })
      await guardarIndicador({ ...b, orden: a.orden })
    }, 'Orden actualizado.')
  }

  async function alternarActivo(i: KinderEnIndicador) {
    await correr(
      () => guardarIndicador({ ...i, activo: !i.activo }),
      i.activo ? `«${i.nombre}» ya no sale en la boleta.` : `«${i.nombre}» vuelve a salir en la boleta.`
    )
  }

  async function borrar(i: KinderEnIndicador) {
    if (!window.confirm(`¿Borrar «${i.nombre}» de ${etiquetaGradoKinderEn(grado)}?`)) return
    await correr(
      () => kiApi(`/api/boletas-kinder-ingles/catalogo?tipo=${tipo}&grado=${grado}&id=${i.id}`, { method: 'DELETE' }),
      'Indicador borrado.'
    )
  }

  return (
    <section className="ki-paper bm-panel ki-cat-panel">
      <header className="ki-cat-head">
        <div>
          <h2>{ETIQUETA_TIPO_KINDER_EN[tipo]}</h2>
          <p className="ki-hint">{AYUDA[tipo]}</p>
        </div>
        {!form && (
          <button
            type="button"
            className="ki-btn primary"
            onClick={() => setForm({ id: 0, nombre: '', formato: 'escala', enPromedio: true, activo: true, orden: 0 })}
          >
            <Plus size={16} aria-hidden />
            Agregar
          </button>
        )}
      </header>

      {grados.length > 1 && (
        <div className="ki-tabs" role="tablist" aria-label="Grado">
          {grados.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={grado === g}
              className={`ki-tab${grado === g ? ' is-on' : ''}`}
              onClick={() => {
                setGrado(g)
                setForm(null)
              }}
            >
              {etiquetaGradoKinderEn(g)}
            </button>
          ))}
        </div>
      )}

      {(msg || err) && (
        <p className={`ki-msg${err ? ' is-error' : ''}`} role={err ? 'alert' : 'status'}>
          {err || msg}
        </p>
      )}

      {form && (
        <form className="ki-cat-form" onSubmit={guardar}>
          <div className="ki-cat-form-grid">
            <label className="ki-cat-form-wide">
              Nombre ({etiquetaGradoKinderEn(grado)})
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                maxLength={120}
                autoComplete="off"
                autoFocus
              />
            </label>
            {tipo === 'subject' && (
              <label className="ki-check">
                <input
                  type="checkbox"
                  checked={form.enPromedio}
                  onChange={(e) => setForm({ ...form, enPromedio: e.target.checked })}
                />
                Cuenta para Average
              </label>
            )}
            {tipo === 'maternal' && (
              <label>
                Se califica con
                <select
                  value={form.formato}
                  onChange={(e) => setForm({ ...form, formato: e.target.value as KinderEnFormato })}
                >
                  <option value="escala">Escala (E · VG · G · R · S · NI)</option>
                  <option value="numero">Días (número)</option>
                </select>
              </label>
            )}
          </div>
          <div className="ki-actions">
            <button type="submit" className="ki-btn primary" disabled={ocupado}>
              {ocupado ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Agregar'}
            </button>
            <button type="button" className="ki-btn ghost" onClick={() => setForm(null)} disabled={ocupado}>
              <X size={16} aria-hidden />
              Cancelar
            </button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="ki-empty bm-empty">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="ki-empty bm-empty">
          <strong>Sin indicadores</strong>
          Agrega el primero para {etiquetaGradoKinderEn(grado)}.
        </p>
      ) : (
        <ol className="ki-indicadores">
          {filas.map((i, idx) => (
            <li key={i.id} className={`ki-indicador${i.activo ? '' : ' is-off'}`}>
              <span className="ki-indicador-num">{idx + 1}</span>
              <div className="ki-indicador-info">
                <strong>{i.nombre}</strong>
                <span>
                  {i.formato === 'numero' ? 'Días' : 'Escala'}
                  {tipo === 'subject' ? (i.enPromedio ? ' · cuenta para Average' : ' · fuera del Average') : ''}
                  {i.activo ? '' : ' · no sale en la boleta'}
                </span>
              </div>
              <div className="ki-indicador-acciones">
                <button
                  type="button"
                  className="ki-btn ghost"
                  aria-label="Subir"
                  disabled={ocupado || idx === 0}
                  onClick={() => void mover(idx, -1)}
                >
                  <ArrowUp size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="ki-btn ghost"
                  aria-label="Bajar"
                  disabled={ocupado || idx === filas.length - 1}
                  onClick={() => void mover(idx, 1)}
                >
                  <ArrowDown size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="ki-btn ghost"
                  aria-label={`Editar ${i.nombre}`}
                  disabled={ocupado}
                  onClick={() =>
                    setForm({
                      id: i.id,
                      nombre: i.nombre,
                      formato: i.formato,
                      enPromedio: i.enPromedio,
                      activo: i.activo,
                      orden: i.orden,
                    })
                  }
                >
                  <Pencil size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="ki-btn ghost ki-btn-texto"
                  disabled={ocupado}
                  onClick={() => void alternarActivo(i)}
                >
                  {i.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  type="button"
                  className="ki-btn ghost is-danger"
                  aria-label={`Borrar ${i.nombre}`}
                  disabled={ocupado}
                  onClick={() => void borrar(i)}
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
