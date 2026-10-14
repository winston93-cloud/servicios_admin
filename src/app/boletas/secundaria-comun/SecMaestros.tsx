'use client'

import { kiApi } from '@/app/boletas/kinder-ingles/components/kiApi'
import { SECUNDARIA_GRADOS, SECUNDARIA_GRUPOS, etiquetaGrupoSec } from '@/lib/boletasSecundariaCatalog'
import type { SecMaestro, SecMateria } from '@/lib/boletasSecundariaService'
import { Pencil, Plus, Trash2, UserCog } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

const API = '/api/boletas-secundaria/maestros'

type Datos = { maestros: SecMaestro[]; materias: SecMateria[] }
type Form = { id: number; nombre: string; app: string; apm: string; usuario: string; email: string; clave: string }

const VACIO: Form = { id: 0, nombre: '', app: '', apm: '', usuario: '', email: '', clave: '' }

function nombre(m: Pick<SecMaestro, 'nombre' | 'app' | 'apm'>): string {
  return [m.nombre, m.app, m.apm].filter(Boolean).join(' ')
}

/** Catálogo de maestros de secundaria y qué materia + grupo da cada uno. */
export default function SecMaestros() {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [grado, setGrado] = useState(1)
  const [editando, setEditando] = useState<{ materia: SecMateria; grupo: string } | null>(null)
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const [todos, setTodos] = useState(false)
  const [buscar, setBuscar] = useState('')
  const [form, setForm] = useState<Form | null>(null)
  const [filtro, setFiltro] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const picker = useRef<HTMLDivElement | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)

  useEffect(() => {
    kiApi<Datos>(API)
      .then(setDatos)
      .catch((e) => setErr(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.'))
  }, [])

  const porClase = useMemo(() => {
    const out = new Map<string, SecMaestro[]>()
    for (const m of datos?.maestros ?? []) {
      for (const a of m.asignaciones) out.set(`${a.materiaId}-${a.grupo}`, [...(out.get(`${a.materiaId}-${a.grupo}`) ?? []), m])
    }
    return out
  }, [datos])

  const materiaDe = useMemo(() => new Map((datos?.materias ?? []).map((m) => [m.id, m])), [datos])
  const materias = (datos?.materias ?? []).filter((m) => m.grado === grado && m.activa)

  async function enviar(cuerpo: Record<string, unknown>, ok: string): Promise<boolean> {
    setOcupado(true)
    setErr('')
    setMsg('')
    try {
      setDatos(await kiApi<Datos>(API, { method: 'POST', body: JSON.stringify(cuerpo) }))
      setMsg(ok)
      return true
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar.')
      return false
    } finally {
      setOcupado(false)
    }
  }

  function abrir(materia: SecMateria, grupo: string) {
    setEditando({ materia, grupo })
    setMarcados(new Set((porClase.get(`${materia.id}-${grupo}`) ?? []).map((m) => m.id)))
    setTodos(false)
    setBuscar('')
    window.setTimeout(() => picker.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  async function guardarAsignacion() {
    if (!editando) return
    const grupos = todos ? [...SECUNDARIA_GRUPOS] : [editando.grupo]
    setOcupado(true)
    setErr('')
    try {
      let ultimo: Datos | null = null
      for (const g of grupos) {
        ultimo = await kiApi<Datos>(API, {
          method: 'POST',
          body: JSON.stringify({ accion: 'asignar', materiaId: editando.materia.id, grupo: g, maestroIds: [...marcados] }),
        })
      }
      if (ultimo) setDatos(ultimo)
      setMsg(`${editando.materia.nombre}: asignación guardada en ${grupos.map((g) => etiquetaGrupoSec(editando.materia.grado, g)).join(', ')}.`)
      setEditando(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar la asignación.')
    } finally {
      setOcupado(false)
    }
  }

  async function guardarMaestro(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    if (await enviar({ accion: 'guardar', ...form, id: form.id || undefined }, form.id ? 'Maestro actualizado.' : 'Maestro dado de alta.')) {
      setForm(null)
    }
  }

  async function borrar(m: SecMaestro) {
    if (!window.confirm(`¿Borrar a ${nombre(m)}? También se quitan sus ${m.asignaciones.length} clase(s) asignada(s).`)) return
    setOcupado(true)
    setErr('')
    try {
      setDatos(await kiApi<Datos>(`${API}?id=${m.id}`, { method: 'DELETE' }))
      setMsg(`${nombre(m)} borrado.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo borrar.')
    } finally {
      setOcupado(false)
    }
  }

  const candidatos = (datos?.maestros ?? []).filter((m) => {
    const q = buscar.trim().toLowerCase()
    return !q || `${nombre(m)} ${m.usuario} ${m.email}`.toLowerCase().includes(q) || marcados.has(m.id)
  })
  const lista = (datos?.maestros ?? []).filter((m) => {
    const q = filtro.trim().toLowerCase()
    return !q || `${nombre(m)} ${m.usuario} ${m.email}`.toLowerCase().includes(q)
  })

  return (
    <>
      {(msg || err) && (
        <p className={`ki-msg${err ? ' is-error' : ''}`} role={err ? 'alert' : 'status'}>
          {err || msg}
        </p>
      )}
      {!datos && !err && <p className="ki-hint">Cargando catálogo…</p>}

      {datos && (
        <section className="ki-paper bm-panel">
          <h2 className="ki-seccion">Quién da cada materia</h2>
          <p className="ki-hint">
            Cada maestro solo ve en su portal las materias y grupos que tenga aquí. Un maestro puede tener varias materias y grupos.
          </p>
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
                  setEditando(null)
                }}
              >
                {g.etiqueta}
              </button>
            ))}
          </div>

          {editando && (
            <div ref={picker} className={`sd-grupo sc-g-${editando.grupo}`} style={{ marginTop: '0.9rem' }}>
              <header className="sd-grupo-head">
                <div>
                  <h3>
                    {editando.materia.nombre} — {etiquetaGrupoSec(editando.materia.grado, editando.grupo)}
                  </h3>
                  <p>Marca a quien da esta materia en este grupo (puede ser más de uno).</p>
                </div>
              </header>
              <div style={{ padding: '0.8rem 1rem' }}>
                <div className="sd-form" style={{ marginBottom: '0.6rem' }}>
                  <label>
                    Buscar maestro
                    <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Nombre, usuario o correo" />
                  </label>
                </div>
                <div className="sd-picker">
                  {candidatos.map((m) => (
                    <label key={m.id}>
                      <input
                        type="checkbox"
                        checked={marcados.has(m.id)}
                        onChange={(e) => {
                          const s = new Set(marcados)
                          if (e.target.checked) s.add(m.id)
                          else s.delete(m.id)
                          setMarcados(s)
                        }}
                      />
                      <span>
                        {nombre(m)} <span className="sd-prom-fino">{m.email || m.usuario}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <label className="sd-picker" style={{ marginTop: '0.6rem', maxHeight: 'none' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
                    Aplicar lo mismo a {SECUNDARIA_GRUPOS.map((g) => etiquetaGrupoSec(editando.materia.grado, g)).join(', ')}
                  </span>
                </label>
                <div className="sd-panel-acciones">
                  <button type="button" className="ki-btn primary" disabled={ocupado} onClick={() => void guardarAsignacion()}>
                    Guardar asignación
                  </button>
                  <button type="button" className="ki-btn ghost" onClick={() => setEditando(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="sd-tabla-wrap" style={{ marginTop: '0.9rem' }}>
            <table className="sd-tabla">
              <thead>
                <tr>
                  <th scope="col">Materia</th>
                  {SECUNDARIA_GRUPOS.map((g) => (
                    <th key={g} scope="col" className={`sc-g-${g}`}>
                      {etiquetaGrupoSec(grado, g)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materias.map((mat) => (
                  <tr key={mat.id}>
                    <td>
                      <strong>{mat.nombre}</strong>
                      {mat.seccion === 'winston' && <span className="sd-chip is-set"> Winston</span>}
                    </td>
                    {SECUNDARIA_GRUPOS.map((g) => {
                      const ms = porClase.get(`${mat.id}-${g}`) ?? []
                      return (
                        <td key={g}>
                          <div className="sd-asig-celda">
                            {ms.length ? (
                              <ul>
                                {ms.map((m) => (
                                  <li key={m.id}>{nombre(m)}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="sd-vacio">Sin maestro</span>
                            )}
                            <button type="button" className="ki-btn ghost" onClick={() => abrir(mat, g)}>
                              <UserCog size={14} aria-hidden /> Cambiar
                            </button>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {datos && (
        <section className="ki-paper bm-panel" style={{ marginTop: '1rem' }}>
          <h2 className="ki-seccion">Maestros de secundaria</h2>
          <div className="sd-form">
            <label>
              Buscar
              <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Nombre, usuario o correo" />
            </label>
            <div>
              <button
                type="button"
                className="ki-btn primary"
                onClick={() => {
                  setForm({ ...VACIO })
                  window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
                }}
              >
                <Plus size={15} aria-hidden /> Nuevo maestro
              </button>
            </div>
          </div>

          {form && (
            <form ref={formRef} className="sd-grupo" style={{ marginTop: '0.9rem', padding: '0.9rem 1rem' }} onSubmit={guardarMaestro}>
              <h3 style={{ margin: '0 0 0.6rem' }}>{form.id ? 'Editar maestro' : 'Nuevo maestro'}</h3>
              <div className="sd-form">
                <label>
                  Nombre(s)
                  <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                </label>
                <label>
                  Apellido paterno
                  <input value={form.app} onChange={(e) => setForm({ ...form, app: e.target.value })} required />
                </label>
                <label>
                  Apellido materno
                  <input value={form.apm} onChange={(e) => setForm({ ...form, apm: e.target.value })} />
                </label>
                <label>
                  Usuario
                  <input
                    value={form.usuario}
                    onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                    autoCapitalize="none"
                    required
                  />
                </label>
                <label>
                  Correo institucional
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
                <label>
                  Contraseña
                  <input
                    type="password"
                    value={form.clave}
                    onChange={(e) => setForm({ ...form, clave: e.target.value })}
                    autoComplete="new-password"
                    placeholder={form.id ? 'Vacía = no cambiar' : 'Mínimo 6 caracteres'}
                  />
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

          <div className="sd-tabla-wrap" style={{ marginTop: '0.9rem' }}>
            <table className="sd-tabla">
              <thead>
                <tr>
                  <th scope="col">Maestro</th>
                  <th scope="col">Usuario / correo</th>
                  <th scope="col">Clases</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((m) => (
                  <tr key={m.id}>
                    <td>{nombre(m)}</td>
                    <td>
                      {m.usuario}
                      <span className="sd-prom-fino">
                        {m.email || 'sin correo'}
                        {m.tieneClave ? '' : ' · sin contraseña (solo Google)'}
                      </span>
                    </td>
                    <td>
                      {m.asignaciones.length ? (
                        m.asignaciones
                          .map((a) => {
                            const mat = materiaDe.get(a.materiaId)
                            return mat ? `${mat.nombre} ${etiquetaGrupoSec(mat.grado, a.grupo)}` : ''
                          })
                          .filter(Boolean)
                          .join(' · ')
                      ) : (
                        <span className="sd-vacio">Sin clases</span>
                      )}
                    </td>
                    <td>
                      <div className="sd-acciones">
                        <button
                          type="button"
                          className="ki-btn ghost"
                          onClick={() => {
                            setForm({ id: m.id, nombre: m.nombre, app: m.app, apm: m.apm, usuario: m.usuario, email: m.email, clave: '' })
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
        </section>
      )}
    </>
  )
}
