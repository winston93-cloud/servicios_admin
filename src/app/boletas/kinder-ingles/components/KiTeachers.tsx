'use client'

import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { GRUPOS_ASIGNACION } from '@/lib/catalogoMaestrosConstants'
import { KINDER_EN_GRUPOS_MATERNAL, etiquetaGrupoKinderEn } from '@/lib/boletasKinderEnCatalog'
import type { TeacherKinderEn } from '@/lib/boletasKinderEnTeachers'
import { kiApi } from './kiApi'

type Form = {
  id: number
  nombre: string
  app: string
  apm: string
  usuario: string
  clave: string
  email: string
  nivel: number
}

const VACIO: Form = { id: 0, nombre: '', app: '', apm: '', usuario: '', clave: '', email: '', nivel: 2 }

const FILAS: { grado: number; etiqueta: string; nivel: number; grupos: readonly string[] }[] = [
  { grado: 0, etiqueta: 'Maternal', nivel: 1, grupos: KINDER_EN_GRUPOS_MATERNAL },
  { grado: 1, etiqueta: 'K1', nivel: 2, grupos: GRUPOS_ASIGNACION },
  { grado: 2, etiqueta: 'K2', nivel: 2, grupos: GRUPOS_ASIGNACION },
  { grado: 3, etiqueta: 'K3', nivel: 2, grupos: GRUPOS_ASIGNACION },
]

/** Catálogo de teachers de inglés (Maternal/Kinder): alta, edición, baja y grupos asignados. */
export default function KiTeachers() {
  const [teachers, setTeachers] = useState<TeacherKinderEn[]>([])
  const [cargando, setCargando] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      setTeachers((await kiApi<{ teachers: TeacherKinderEn[] }>('/api/boletas-kinder-ingles/teachers')).teachers)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  async function enviar(body: Record<string, unknown>, metodo: 'POST' | 'DELETE' = 'POST', url = '') {
    setOcupado(true)
    setErr('')
    setMsg('')
    try {
      const data = await kiApi<{ teachers: TeacherKinderEn[] }>(url || '/api/boletas-kinder-ingles/teachers', {
        method: metodo,
        body: metodo === 'POST' ? JSON.stringify(body) : undefined,
      })
      setTeachers(data.teachers)
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
    if (await enviar({ accion: 'guardar', ...form })) {
      setMsg(form.id ? 'Teacher actualizada.' : 'Teacher dada de alta. Ya puedes asignarle grupos abajo.')
      setForm(null)
    }
  }

  async function borrar(t: TeacherKinderEn) {
    const grupos = t.grupos.length ? `\n\nSe le quitarán sus grupos: ${t.grupos.map((g) => etiquetaGrupoKinderEn(g.grado, g.grupo)).join(', ')}.` : ''
    if (!window.confirm(`¿Borrar a ${t.nombreCompleto} del catálogo?${grupos}`)) return
    if (await enviar({}, 'DELETE', `/api/boletas-kinder-ingles/teachers?id=${t.id}`)) setMsg('Teacher borrada.')
  }

  async function asignar(grado: number, grupo: string, maestroId: number) {
    if (await enviar({ accion: 'asignar', grado, grupo, maestroId })) {
      setMsg(maestroId ? `Asignada a ${etiquetaGrupoKinderEn(grado, grupo)}.` : `${etiquetaGrupoKinderEn(grado, grupo)} sin teacher.`)
    }
  }

  function asignadaA(grado: number, grupo: string): number {
    return teachers.find((t) => t.grupos.some((g) => g.grado === grado && g.grupo === grupo))?.id ?? 0
  }

  const campo = (k: keyof Form) => ({
    value: form ? String(form[k]) : '',
    onChange: (e: { target: { value: string } }) =>
      setForm((f) => (f ? { ...f, [k]: k === 'nivel' ? Number(e.target.value) : e.target.value } : f)),
  })

  return (
    <div className="ki-cat">
      {(msg || err) && (
        <p className={`ki-msg${err ? ' is-error' : ''}`} role={err ? 'alert' : 'status'}>
          {err || msg}
        </p>
      )}

      <section className="ki-paper bm-panel ki-cat-panel">
        <header className="ki-cat-head">
          <div>
            <h2>Teachers de inglés</h2>
            <p className="ki-hint">
              Entran al portal de captura con su usuario y contraseña o con su correo institucional (Google).
            </p>
          </div>
          {!form && (
            <button type="button" className="ki-btn primary" onClick={() => setForm({ ...VACIO })}>
              <Plus size={16} aria-hidden />
              Nueva teacher
            </button>
          )}
        </header>

        {form && (
          <form className="ki-cat-form" onSubmit={guardar}>
            <div className="ki-cat-form-grid">
              <label>
                Nombre(s)
                <input {...campo('nombre')} required maxLength={60} autoComplete="off" />
              </label>
              <label>
                Apellido paterno
                <input {...campo('app')} required maxLength={60} autoComplete="off" />
              </label>
              <label>
                Apellido materno
                <input {...campo('apm')} maxLength={60} autoComplete="off" />
              </label>
              <label>
                Nivel
                <select {...campo('nivel')}>
                  <option value={1}>Maternal</option>
                  <option value={2}>Kinder</option>
                </select>
              </label>
              <label>
                Usuario
                <input {...campo('usuario')} required maxLength={40} autoComplete="off" autoCapitalize="none" />
              </label>
              <label>
                Contraseña
                <input
                  {...campo('clave')}
                  type="password"
                  autoComplete="new-password"
                  placeholder={form.id ? 'Vacía = no cambiarla' : 'Mínimo 6 caracteres'}
                />
              </label>
              <label className="ki-cat-form-wide">
                Correo institucional
                <input {...campo('email')} type="email" maxLength={120} autoComplete="off" autoCapitalize="none" />
              </label>
            </div>
            <div className="ki-actions">
              <button type="submit" className="ki-btn primary" disabled={ocupado}>
                {ocupado ? 'Guardando…' : form.id ? 'Guardar cambios' : 'Dar de alta'}
              </button>
              <button type="button" className="ki-btn ghost" onClick={() => setForm(null)} disabled={ocupado}>
                <X size={16} aria-hidden />
                Cancelar
              </button>
            </div>
          </form>
        )}

        {cargando ? (
          <p className="ki-empty bm-empty">Cargando teachers…</p>
        ) : teachers.length === 0 ? (
          <p className="ki-empty bm-empty">
            <strong>Sin teachers</strong>
            Da de alta a la primera con «Nueva teacher».
          </p>
        ) : (
          <ul className="ki-teachers">
            {teachers.map((t) => (
              <li key={t.id} className="ki-teacher">
                <div className="ki-teacher-info">
                  <strong>{t.nombreCompleto}</strong>
                  <span>
                    @{t.usuario} · {t.nivel === 1 ? 'Maternal' : 'Kinder'}
                    {t.email ? ` · ${t.email}` : ''}
                    {!t.tieneClave && !t.email ? ' · sin forma de entrar' : ''}
                  </span>
                  <span className="ki-teacher-grupos">
                    {t.grupos.length
                      ? t.grupos.map((g) => (
                          <span key={`${g.grado}-${g.grupo}`} className="ki-tag">
                            {etiquetaGrupoKinderEn(g.grado, g.grupo)}
                          </span>
                        ))
                      : <span className="ki-hint">Sin grupos</span>}
                  </span>
                </div>
                <div className="ki-teacher-acciones">
                  <button
                    type="button"
                    className="ki-btn ghost"
                    aria-label={`Editar a ${t.nombreCompleto}`}
                    onClick={() =>
                      setForm({
                        id: t.id,
                        nombre: t.nombre,
                        app: t.app,
                        apm: t.apm,
                        usuario: t.usuario,
                        clave: '',
                        email: t.email,
                        nivel: t.nivel,
                      })
                    }
                  >
                    <Pencil size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="ki-btn ghost is-danger"
                    aria-label={`Borrar a ${t.nombreCompleto}`}
                    disabled={ocupado}
                    onClick={() => void borrar(t)}
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ki-paper bm-panel ki-cat-panel">
        <header className="ki-cat-head">
          <div>
            <h2>Grados y grupos</h2>
            <p className="ki-hint">Cada teacher solo ve y captura los grupos que le asignes aquí.</p>
          </div>
        </header>
        <div className="ki-asig">
          {FILAS.map((f) => {
            const opciones = teachers.filter((t) => t.nivel === f.nivel)
            return (
              <div key={f.grado} className="ki-asig-fila">
                <h3>{f.etiqueta}</h3>
                <div className="ki-asig-celdas">
                  {f.grupos.map((grupo) => (
                    <label key={grupo} className="ki-asig-celda">
                      <span>Grupo {grupo}</span>
                      <select
                        value={asignadaA(f.grado, grupo)}
                        disabled={ocupado || cargando}
                        onChange={(e) => void asignar(f.grado, grupo, Number(e.target.value))}
                      >
                        <option value={0}>Sin teacher</option>
                        {opciones.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nombreCompleto}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                {opciones.length === 0 && (
                  <p className="ki-hint">No hay teachers de {f.nivel === 1 ? 'Maternal' : 'Kinder'} en el catálogo.</p>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
