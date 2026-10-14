'use client'

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  PRIMARIA_ESCALA,
  PRIMARIA_GRADOS,
  PRIMARIA_SECCIONES,
  type IdiomaPrimaria,
  type PrimariaGrado,
} from '@/lib/boletasPrimariaCatalog'
import type { PrimariaMateria } from '@/lib/boletasPrimariaComun'
import { kiApi } from '../kinder-ingles/components/kiApi'

type Form = {
  id: number
  seccion: string
  nombre: string
  nombreAlt: string
  enPromedio: boolean
  semaforo: boolean
  activo: boolean
  orden: number
}

/**
 * Materias de la boleta de primaria por grado y sección (alta, orden, activar/desactivar, borrar).
 * Desactivar la quita de la boleta sin perder calificaciones.
 */
export default function PrimariaCatalogo({ idioma, apiUrl }: { idioma: IdiomaPrimaria; apiUrl: string }) {
  const secciones = PRIMARIA_SECCIONES[idioma]
  const en = idioma === 'en'
  const [grado, setGrado] = useState<PrimariaGrado>(1)
  const [todas, setTodas] = useState<PrimariaMateria[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setTodas((await kiApi<{ materias: PrimariaMateria[] }>(apiUrl)).materias)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.')
    } finally {
      setCargando(false)
    }
  }, [apiUrl])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const porSeccion = useMemo(() => {
    const delGrado = todas.filter((m) => m.grado === grado)
    return secciones.map((s) => ({
      seccion: s,
      materias: delGrado.filter((m) => m.seccion === s.id).sort((a, b) => a.orden - b.orden || a.id - b.id),
    }))
  }, [todas, grado, secciones])

  async function guardarMateria(datos: Partial<Form> & { seccion: string; nombre: string }) {
    await kiApi(apiUrl, { method: 'POST', body: JSON.stringify({ grado, ...datos }) })
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
        guardarMateria({
          id: f.id || undefined,
          seccion: f.seccion,
          nombre: f.nombre,
          nombreAlt: f.nombreAlt,
          enPromedio: f.enPromedio,
          semaforo: f.semaforo,
          activo: f.activo,
          orden: f.id ? f.orden : undefined,
        }),
      f.id ? 'Materia actualizada.' : 'Materia agregada.'
    )
    if (ok) setForm(null)
  }

  async function mover(lista: PrimariaMateria[], idx: number, delta: -1 | 1) {
    const a = lista[idx]
    const b = lista[idx + delta]
    if (!a || !b) return
    await correr(async () => {
      const ordenA = a.orden === b.orden ? b.orden + delta : b.orden
      await guardarMateria({ ...a, orden: ordenA })
      await guardarMateria({ ...b, orden: a.orden })
    }, 'Orden actualizado.')
  }

  async function alternarActivo(m: PrimariaMateria) {
    await correr(
      () => guardarMateria({ ...m, activo: !m.activo }),
      m.activo ? `«${m.nombre}» ya no sale en la boleta.` : `«${m.nombre}» vuelve a salir en la boleta.`
    )
  }

  async function borrar(m: PrimariaMateria) {
    if (!window.confirm(`¿Borrar «${m.nombre}» de ${grado}°?`)) return
    await correr(() => kiApi(`${apiUrl}?grado=${grado}&id=${m.id}`, { method: 'DELETE' }), 'Materia borrada.')
  }

  const nueva = (seccion: string): Form => ({
    id: 0,
    seccion,
    nombre: '',
    nombreAlt: '',
    enPromedio: true,
    semaforo: false,
    activo: true,
    orden: 0,
  })
  const formSeccion = form ? secciones.find((s) => s.id === form.seccion) : undefined
  const escalaTexto = PRIMARIA_ESCALA[idioma].map((e) => e.letra).join(' · ')

  return (
    <section className="ki-paper bm-panel ki-cat-panel">
      <header className="ki-cat-head">
        <div>
          <h2>{en ? 'Subjects y skills de la boleta' : 'Materias de la boleta'}</h2>
          <p className="ki-hint">
            Cada grado tiene sus materias. Las de calificación van de 5 a 10;{' '}
            {en ? 'las skills' : 'las habilidades'} se califican con {escalaTexto}. Lo que cambies aquí aparece en la
            captura de las docentes y en el PDF.
          </p>
        </div>
      </header>

      <div className="ki-tabs" role="tablist" aria-label="Grado">
        {PRIMARIA_GRADOS.map((g) => (
          <button
            key={g.valor}
            type="button"
            role="tab"
            aria-selected={grado === g.valor}
            className={`ki-tab${grado === g.valor ? ' is-on' : ''}`}
            onClick={() => {
              setGrado(g.valor)
              setForm(null)
            }}
          >
            {g.etiqueta}
          </button>
        ))}
      </div>

      {(msg || err) && (
        <p className={`ki-msg${err ? ' is-error' : ''}`} role={err ? 'alert' : 'status'}>
          {err || msg}
        </p>
      )}

      {form && (
        <form className="ki-cat-form" onSubmit={guardar}>
          <div className="ki-cat-form-grid">
            <label>
              Sección
              <select value={form.seccion} onChange={(e) => setForm({ ...form, seccion: e.target.value })}>
                {secciones.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.titulo}
                  </option>
                ))}
              </select>
            </label>
            <label className={en ? undefined : 'ki-cat-form-wide'}>
              {en ? 'Nombre en inglés' : 'Nombre'} ({grado}°)
              <input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
                maxLength={120}
                autoComplete="off"
                autoFocus
              />
            </label>
            {en && (
              <label>
                Nombre en español
                <input
                  value={form.nombreAlt}
                  onChange={(e) => setForm({ ...form, nombreAlt: e.target.value })}
                  maxLength={120}
                  autoComplete="off"
                />
              </label>
            )}
            {formSeccion?.formato === 'decimal' && formSeccion.promedio && (
              <label className="ki-check">
                <input
                  type="checkbox"
                  checked={form.enPromedio}
                  onChange={(e) => setForm({ ...form, enPromedio: e.target.checked })}
                />
                Cuenta para el promedio
              </label>
            )}
            {en && formSeccion?.formato === 'decimal' && (
              <label className="ki-check">
                <input
                  type="checkbox"
                  checked={form.semaforo}
                  onChange={(e) => setForm({ ...form, semaforo: e.target.checked })}
                />
                Semáforo en el PDF (verde / amarillo / rojo)
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
      ) : (
        porSeccion.map(({ seccion, materias }) => (
          <div key={seccion.id} className="pr-cat-seccion">
            <div className="pr-cat-seccion-head">
              <h3>{seccion.titulo}</h3>
              <button
                type="button"
                className="ki-btn ghost"
                disabled={ocupado}
                onClick={() => setForm(nueva(seccion.id))}
                aria-label={`Agregar a ${seccion.titulo}`}
              >
                <Plus size={16} aria-hidden />
                Agregar
              </button>
            </div>
            {materias.length === 0 ? (
              <p className="ki-hint">Sin materias en {grado}°.</p>
            ) : (
              <ol className="ki-indicadores">
                {materias.map((m, idx) => (
                  <li key={m.id} className={`ki-indicador${m.activo ? '' : ' is-off'}`}>
                    <span className="ki-indicador-num">{idx + 1}</span>
                    <div className="ki-indicador-info">
                      <strong>{m.nombre}</strong>
                      <span>
                        {m.nombreAlt ? `${m.nombreAlt} · ` : ''}
                        {seccion.formato === 'escala' ? 'Escala' : 'Calificación 5 a 10'}
                        {seccion.formato === 'decimal' && seccion.promedio
                          ? m.enPromedio
                            ? ' · cuenta para el promedio'
                            : ' · fuera del promedio'
                          : ''}
                        {m.semaforo ? ' · semáforo' : ''}
                        {m.activo ? '' : ' · no sale en la boleta'}
                      </span>
                    </div>
                    <div className="ki-indicador-acciones">
                      <button
                        type="button"
                        className="ki-btn ghost"
                        aria-label="Subir"
                        disabled={ocupado || idx === 0}
                        onClick={() => void mover(materias, idx, -1)}
                      >
                        <ArrowUp size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ki-btn ghost"
                        aria-label="Bajar"
                        disabled={ocupado || idx === materias.length - 1}
                        onClick={() => void mover(materias, idx, 1)}
                      >
                        <ArrowDown size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ki-btn ghost"
                        aria-label={`Editar ${m.nombre}`}
                        disabled={ocupado}
                        onClick={() =>
                          setForm({
                            id: m.id,
                            seccion: m.seccion,
                            nombre: m.nombre,
                            nombreAlt: m.nombreAlt,
                            enPromedio: m.enPromedio,
                            semaforo: m.semaforo,
                            activo: m.activo,
                            orden: m.orden,
                          })
                        }
                      >
                        <Pencil size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="ki-btn ghost ki-btn-texto"
                        disabled={ocupado}
                        onClick={() => void alternarActivo(m)}
                      >
                        {m.activo ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        className="ki-btn ghost is-danger"
                        aria-label={`Borrar ${m.nombre}`}
                        disabled={ocupado}
                        onClick={() => void borrar(m)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))
      )}
    </section>
  )
}
