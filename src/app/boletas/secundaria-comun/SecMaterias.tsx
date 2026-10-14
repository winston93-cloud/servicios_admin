'use client'

import { kiApi } from '@/app/boletas/kinder-ingles/components/kiApi'
import { SECCION_ETIQUETA, SECUNDARIA_GRADOS, etiquetaGradoSec, type SecundariaSeccion } from '@/lib/boletasSecundariaCatalog'
import type { SecMateria } from '@/lib/boletasSecundariaService'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

const API = '/api/boletas-secundaria/catalogo'

type Form = Omit<SecMateria, 'id'> & { id: number }

function si(v: boolean): string {
  return v ? 'Sí' : '—'
}

/** Materias de la boleta de secundaria por grado: orden, SET/Winston y qué cuenta en el promedio. */
export default function SecMaterias() {
  const [materias, setMaterias] = useState<SecMateria[] | null>(null)
  const [grado, setGrado] = useState<1 | 2 | 3>(1)
  const [form, setForm] = useState<Form | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    kiApi<{ materias: SecMateria[] }>(API)
      .then((d) => setMaterias(d.materias))
      .catch((e) => setErr(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.'))
  }, [])

  const delGrado = (materias ?? []).filter((m) => m.grado === grado)
  const cuentan = delGrado.filter((m) => m.activa && m.enPromedio)

  function nueva() {
    const orden = Math.max(0, ...delGrado.map((m) => m.orden)) + 1
    setForm({ id: 0, nombre: '', grado, orden, seccion: 'winston', enPromedio: true, semaforo: false, comprension: false, activa: true })
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setOcupado(true)
    setErr('')
    setMsg('')
    try {
      const r = await kiApi<{ materias: SecMateria[] }>(API, { method: 'POST', body: JSON.stringify({ ...form, id: form.id || undefined }) })
      setMaterias(r.materias)
      setMsg(form.id ? 'Materia actualizada.' : 'Materia agregada.')
      setForm(null)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'No se pudo guardar.')
    } finally {
      setOcupado(false)
    }
  }

  async function borrar(m: SecMateria) {
    if (!window.confirm(`¿Borrar ${m.nombre} de ${etiquetaGradoSec(m.grado)}? Si ya tiene calificaciones no se puede: desactívala.`)) return
    setOcupado(true)
    setErr('')
    try {
      setMaterias((await kiApi<{ materias: SecMateria[] }>(`${API}?id=${m.id}`, { method: 'DELETE' })).materias)
      setMsg(`${m.nombre} borrada.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo borrar.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="ki-paper bm-panel">
      <div className="bc-trimestres" role="tablist" aria-label="Grado">
        {SECUNDARIA_GRADOS.map((g) => (
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
        <p className={`ki-msg${err ? ' is-error' : ''}`} role={err ? 'alert' : 'status'} style={{ marginTop: '0.8rem' }}>
          {err || msg}
        </p>
      )}

      {materias && (
        <p className="ki-hint" style={{ marginTop: '0.8rem' }}>
          En {etiquetaGradoSec(grado)} cuentan para el promedio <strong>{cuentan.length}</strong> materias (Winston ÷ {cuentan.length}) y{' '}
          <strong>{cuentan.filter((m) => m.seccion === 'set').length}</strong> SET. Cambiar esto cambia todos los promedios del grado.
        </p>
      )}

      <div className="sd-panel-acciones">
        <button type="button" className="ki-btn primary" onClick={nueva}>
          <Plus size={15} aria-hidden /> Nueva materia en {etiquetaGradoSec(grado)}
        </button>
      </div>

      {form && (
        <form ref={formRef} className="sd-grupo" style={{ marginTop: '0.9rem', padding: '0.9rem 1rem' }} onSubmit={guardar}>
          <h3 style={{ margin: '0 0 0.6rem' }}>{form.id ? `Editar ${form.nombre}` : `Nueva materia de ${etiquetaGradoSec(form.grado)}`}</h3>
          <div className="sd-form">
            <label>
              Nombre
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </label>
            <label>
              Orden en la boleta
              <input
                type="number"
                min={1}
                max={99}
                value={form.orden}
                onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })}
                required
              />
            </label>
            <label>
              Sección
              <select value={form.seccion} onChange={(e) => setForm({ ...form, seccion: e.target.value as SecundariaSeccion })}>
                <option value="set">{SECCION_ETIQUETA.set}</option>
                <option value="winston">{SECCION_ETIQUETA.winston}</option>
              </select>
            </label>
            <label className="sd-check">
              <input type="checkbox" checked={form.enPromedio} onChange={(e) => setForm({ ...form, enPromedio: e.target.checked })} />
              Cuenta en el promedio
            </label>
            <label className="sd-check">
              <input type="checkbox" checked={form.semaforo} onChange={(e) => setForm({ ...form, semaforo: e.target.checked })} />
              Se imprime como semáforo
            </label>
            <label className="sd-check">
              <input type="checkbox" checked={form.comprension} onChange={(e) => setForm({ ...form, comprension: e.target.checked })} />
              Lleva comprensión lectora
            </label>
            <label className="sd-check">
              <input type="checkbox" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} />
              Activa
            </label>
          </div>
          <div className="sd-panel-acciones">
            <button type="submit" className="ki-btn primary" disabled={ocupado}>
              Guardar
            </button>
            <button type="button" className="ki-btn ghost" onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {!materias && !err && <p className="ki-hint">Cargando materias…</p>}
      {materias && (
        <div className="sd-tabla-wrap" style={{ marginTop: '0.9rem' }}>
          <table className="sd-tabla">
            <thead>
              <tr>
                <th scope="col" className="num">
                  Orden
                </th>
                <th scope="col">Materia</th>
                <th scope="col">Sección</th>
                <th scope="col" className="centro">
                  Promedio
                </th>
                <th scope="col" className="centro">
                  Semáforo
                </th>
                <th scope="col" className="centro">
                  Comprensión
                </th>
                <th scope="col" className="centro">
                  Activa
                </th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {delGrado.map((m) => (
                <tr key={m.id} style={m.activa ? undefined : { opacity: 0.55 }}>
                  <td className="num">{m.orden}</td>
                  <td>{m.nombre}</td>
                  <td>{m.seccion === 'set' ? 'SET' : 'Winston'}</td>
                  <td className="centro">{si(m.enPromedio)}</td>
                  <td className="centro">{si(m.semaforo)}</td>
                  <td className="centro">{si(m.comprension)}</td>
                  <td className="centro">{si(m.activa)}</td>
                  <td>
                    <div className="sd-acciones">
                      <button
                        type="button"
                        className="ki-btn ghost"
                        onClick={() => {
                          setForm({ ...m })
                          window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
                        }}
                      >
                        <Pencil size={14} aria-hidden /> Editar
                      </button>
                      <button type="button" className="ki-btn ghost" disabled={ocupado} onClick={() => void borrar(m)}>
                        <Trash2 size={14} aria-hidden /> Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
