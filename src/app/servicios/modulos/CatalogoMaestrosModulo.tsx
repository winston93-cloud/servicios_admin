'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  CATALOGO_MAESTROS_TABS,
  GRUPOS_ASIGNACION,
  esModoMateriasLibres,
  nivelesDeTab,
  subTabsDeNivel,
  type CatalogoMaestrosSubTab,
  type CatalogoMaestrosTab,
} from '@/lib/catalogoMaestrosConstants'
import { gradoOpcionesPorNivel } from '@/lib/gradoEscolar'
import { nombreMaestro, type AsignacionRow, type MaestroRow, type MateriaRow } from '@/lib/catalogoMaestrosService'
import './catalogo-maestros.css'

type MaestroForm = {
  maestro_id?: number
  maestro_app: string
  maestro_apm: string
  maestro_nombre: string
  maestro_usuario: string
  maestro_clave: string
  maestro_email: string
  maestro_celular: string
  maestro_sexo: number
}

type MateriaForm = {
  materia_id?: number
  materia_nombre: string
  materia_nivel: number
  materia_grado: number
  materia_orden: number
}

type AsignacionForm = {
  grupo_id?: number
  maestro_id: number
  materia_id: number
  grupo_letra: string
}

const MAESTRO_VACIO: MaestroForm = {
  maestro_app: '',
  maestro_apm: '',
  maestro_nombre: '',
  maestro_usuario: '',
  maestro_clave: '',
  maestro_email: '',
  maestro_celular: '',
  maestro_sexo: 0,
}

const MATERIA_VACIA: MateriaForm = {
  materia_nombre: '',
  materia_nivel: 4,
  materia_grado: 1,
  materia_orden: 0,
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

function filasGradoGrupo(tab: CatalogoMaestrosTab) {
  const filas: { nivel: number; grado: number; etiqueta: string }[] = []
  for (const nivel of nivelesDeTab(tab)) {
    for (const g of gradoOpcionesPorNivel(nivel)) {
      filas.push({ nivel, grado: g.valor, etiqueta: g.etiqueta })
    }
  }
  return filas
}

export default function CatalogoMaestrosModulo() {
  const [tabNivel, setTabNivel] = useState<CatalogoMaestrosTab>('secundaria')
  const [subTab, setSubTab] = useState<CatalogoMaestrosSubTab>('maestros')
  const [maestros, setMaestros] = useState<MaestroRow[]>([])
  const [materias, setMaterias] = useState<MateriaRow[]>([])
  const [asignaciones, setAsignaciones] = useState<AsignacionRow[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [formMaestro, setFormMaestro] = useState<MaestroForm>(MAESTRO_VACIO)
  const [editMaestroId, setEditMaestroId] = useState<number | null>(null)

  const [formMateria, setFormMateria] = useState<MateriaForm>(MATERIA_VACIA)
  const [editMateriaId, setEditMateriaId] = useState<number | null>(null)
  const [filtroGradoMateria, setFiltroGradoMateria] = useState(0)

  const [formAsig, setFormAsig] = useState<AsignacionForm>({
    maestro_id: 0,
    materia_id: 0,
    grupo_letra: 'A',
  })
  const [editAsigId, setEditAsigId] = useState<number | null>(null)

  const subTabs = useMemo(() => subTabsDeNivel(tabNivel), [tabNivel])
  const modoSecundaria = esModoMateriasLibres(tabNivel)
  const gradosSecundaria = gradoOpcionesPorNivel(4)
  const filasGG = useMemo(() => filasGradoGrupo(tabNivel), [tabNivel])

  const cargarMaestros = useCallback(async () => {
    const data = await apiJson<{ maestros: MaestroRow[] }>('/api/servicios/catalogo-maestros/maestros')
    setMaestros(data.maestros ?? [])
  }, [])

  const cargarMaterias = useCallback(async () => {
    const q = new URLSearchParams({ tab: tabNivel })
    if (filtroGradoMateria > 0) q.set('grado', String(filtroGradoMateria))
    const data = await apiJson<{ materias: MateriaRow[] }>(
      `/api/servicios/catalogo-maestros/materias?${q}`
    )
    setMaterias(data.materias ?? [])
  }, [tabNivel, filtroGradoMateria])

  const cargarAsignaciones = useCallback(async () => {
    const data = await apiJson<{ asignaciones: AsignacionRow[] }>(
      `/api/servicios/catalogo-maestros/asignaciones?tab=${tabNivel}`
    )
    setAsignaciones(data.asignaciones ?? [])
  }, [tabNivel])

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      await cargarMaestros()
      if (modoSecundaria && subTab !== 'maestros') await cargarMaterias()
      if (subTab === 'asignaciones') await cargarAsignaciones()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setCargando(false)
    }
  }, [cargarMaestros, cargarMaterias, cargarAsignaciones, modoSecundaria, subTab])

  useEffect(() => {
    void recargar()
  }, [recargar])

  useEffect(() => {
    const subs = subTabsDeNivel(tabNivel)
    if (!subs.includes(subTab)) setSubTab(subs[0] ?? 'maestros')
  }, [tabNivel, subTab])

  useEffect(() => {
    if (tabNivel === 'secundaria') {
      setFormMateria((f) => ({ ...f, materia_nivel: 4 }))
    } else if (tabNivel === 'primaria') {
      setFormMateria((f) => ({ ...f, materia_nivel: 3 }))
    } else {
      setFormMateria((f) => ({ ...f, materia_nivel: 2 }))
    }
  }, [tabNivel])

  const resetMaestro = () => {
    setEditMaestroId(null)
    setFormMaestro(MAESTRO_VACIO)
  }

  const resetMateria = () => {
    setEditMateriaId(null)
    setFormMateria({
      ...MATERIA_VACIA,
      materia_nivel: tabNivel === 'secundaria' ? 4 : tabNivel === 'primaria' ? 3 : 2,
    })
  }

  const resetAsig = () => {
    setEditAsigId(null)
    setFormAsig({ maestro_id: 0, materia_id: 0, grupo_letra: 'A' })
  }

  const onGuardarMaestro = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)
    setError(null)
    try {
      await apiJson('/api/servicios/catalogo-maestros/maestros', {
        method: 'POST',
        body: JSON.stringify({
          ...formMaestro,
          maestro_id: editMaestroId ?? undefined,
          maestro_clave: formMaestro.maestro_clave || undefined,
        }),
      })
      setMensaje(editMaestroId ? 'Maestro actualizado.' : 'Maestro registrado.')
      resetMaestro()
      await cargarMaestros()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const onEliminarMaestro = async (m: MaestroRow) => {
    if (!window.confirm(`¿Eliminar a ${nombreMaestro(m)} (${m.maestro_usuario})?`)) return
    setGuardando(true)
    setError(null)
    try {
      await apiJson(`/api/servicios/catalogo-maestros/maestros?id=${m.maestro_id}`, { method: 'DELETE' })
      setMensaje('Maestro eliminado.')
      if (editMaestroId === m.maestro_id) resetMaestro()
      await cargarMaestros()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setGuardando(false)
    }
  }

  const onGuardarMateria = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)
    setError(null)
    try {
      await apiJson('/api/servicios/catalogo-maestros/materias', {
        method: 'POST',
        body: JSON.stringify({
          ...formMateria,
          materia_id: editMateriaId ?? undefined,
        }),
      })
      setMensaje(editMateriaId ? 'Materia actualizada.' : 'Materia creada.')
      resetMateria()
      await cargarMaterias()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const onEliminarMateria = async (m: MateriaRow) => {
    if (!window.confirm(`¿Eliminar materia «${m.materia_nombre}»?`)) return
    setGuardando(true)
    try {
      await apiJson(`/api/servicios/catalogo-maestros/materias?id=${m.materia_id}`, { method: 'DELETE' })
      setMensaje('Materia eliminada.')
      if (editMateriaId === m.materia_id) resetMateria()
      await cargarMaterias()
      await cargarAsignaciones()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setGuardando(false)
    }
  }

  const onGuardarAsigSecundaria = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setMensaje(null)
    setError(null)
    try {
      await apiJson('/api/servicios/catalogo-maestros/asignaciones', {
        method: 'POST',
        body: JSON.stringify({
          ...formAsig,
          grupo_id: editAsigId ?? undefined,
        }),
      })
      setMensaje(editAsigId ? 'Asignación actualizada.' : 'Asignación creada.')
      resetAsig()
      await cargarAsignaciones()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const onEliminarAsig = async (a: AsignacionRow) => {
    if (!window.confirm('¿Quitar esta asignación?')) return
    setGuardando(true)
    try {
      await apiJson(`/api/servicios/catalogo-maestros/asignaciones?id=${a.grupo_id}`, { method: 'DELETE' })
      setMensaje('Asignación eliminada.')
      await cargarAsignaciones()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setGuardando(false)
    }
  }

  const onAsignarGradoGrupo = async (
    nivel: number,
    grado: number,
    grupo: string,
    idioma: 'es' | 'en',
    maestroId: number
  ) => {
    setGuardando(true)
    setError(null)
    try {
      await apiJson('/api/servicios/catalogo-maestros/asignaciones', {
        method: 'POST',
        body: JSON.stringify({
          modo: 'grado-grupo',
          nivel,
          grado,
          grupo_letra: grupo,
          idioma,
          maestro_id: maestroId,
        }),
      })
      setMensaje('Asignación guardada.')
      await cargarAsignaciones()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo asignar')
    } finally {
      setGuardando(false)
    }
  }

  const maestroDeCelda = (nivel: number, grado: number, grupo: string, orden: number) => {
    const mat = materias.find(
      (m) => m.materia_nivel === nivel && m.materia_grado === grado && m.materia_orden === orden
    )
    if (!mat) return 0
    const hit = asignaciones.find(
      (a) => a.materia_id === mat.materia_id && a.grupo_letra.toUpperCase() === grupo.toUpperCase()
    )
    return hit?.maestro_id ?? 0
  }

  useEffect(() => {
    if (subTab === 'asignaciones' && !modoSecundaria) {
      void cargarMaterias()
    }
  }, [subTab, modoSecundaria, cargarMaterias])

  return (
    <div className="servicios-panel-inner cat-maestros">
      <header className="servicios-panel-header servicios-panel-header--compact">
        <h1 className="servicios-panel-title">Catálogo de maestros</h1>
        <p className="servicios-panel-lead">
          Personal docente y asignaciones por nivel. Secundaria: maestro por materia, grado y grupo.
          Maternal, Kinder y Primaria: maestro(a) de español y Teacher de inglés por grado y grupo.
        </p>
      </header>

      <div className="costos-tabs cat-maestros-nivel-tabs" role="tablist" aria-label="Nivel escolar">
        {CATALOGO_MAESTROS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tabNivel === t.id}
            className={`costos-tab${tabNivel === t.id ? ' is-active' : ''}`}
            onClick={() => setTabNivel(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="costos-tabs cat-maestros-sub-tabs" role="tablist" aria-label="Sección">
        {subTabs.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={subTab === id}
            className={`costos-tab${subTab === id ? ' is-active' : ''}`}
            onClick={() => setSubTab(id)}
          >
            {id === 'maestros' ? 'Maestros' : id === 'materias' ? 'Materias' : 'Asignaciones'}
          </button>
        ))}
      </div>

      {mensaje ? <p className="ciclos-crud-msg ciclos-crud-msg--ok">{mensaje}</p> : null}
      {error ? (
        <p className="ciclos-crud-msg ciclos-crud-msg--error" role="alert">
          {error}
        </p>
      ) : null}

      {cargando && subTab === 'maestros' ? (
        <p className="ciclos-crud-loading">
          <Loader2 size={20} className="ciclos-crud-spin" aria-hidden />
          Cargando…
        </p>
      ) : null}

      {subTab === 'maestros' ? (
        <div className="ciclos-crud-layout">
          <section className="ciclos-crud-form-card">
            <h2 className="ciclos-crud-form-title">{editMaestroId ? 'Editar maestro' : 'Nuevo maestro'}</h2>
            <form className="ciclos-crud-form" onSubmit={onGuardarMaestro}>
              <div className="ciclos-crud-field-row">
                <div className="ciclos-crud-field">
                  <label htmlFor="cm-nombre">Nombre(s)</label>
                  <input
                    id="cm-nombre"
                    value={formMaestro.maestro_nombre}
                    onChange={(e) => setFormMaestro((f) => ({ ...f, maestro_nombre: e.target.value }))}
                  />
                </div>
                <div className="ciclos-crud-field">
                  <label htmlFor="cm-app">Apellido paterno</label>
                  <input
                    id="cm-app"
                    value={formMaestro.maestro_app}
                    onChange={(e) => setFormMaestro((f) => ({ ...f, maestro_app: e.target.value }))}
                  />
                </div>
                <div className="ciclos-crud-field">
                  <label htmlFor="cm-apm">Apellido materno</label>
                  <input
                    id="cm-apm"
                    value={formMaestro.maestro_apm}
                    onChange={(e) => setFormMaestro((f) => ({ ...f, maestro_apm: e.target.value }))}
                  />
                </div>
              </div>
              <div className="ciclos-crud-field-row">
                <div className="ciclos-crud-field">
                  <label htmlFor="cm-usuario">Usuario *</label>
                  <input
                    id="cm-usuario"
                    required
                    value={formMaestro.maestro_usuario}
                    onChange={(e) => setFormMaestro((f) => ({ ...f, maestro_usuario: e.target.value }))}
                  />
                </div>
                <div className="ciclos-crud-field">
                  <label htmlFor="cm-clave">{editMaestroId ? 'Nueva clave (opcional)' : 'Clave *'}</label>
                  <input
                    id="cm-clave"
                    type="password"
                    required={!editMaestroId}
                    autoComplete="new-password"
                    value={formMaestro.maestro_clave}
                    onChange={(e) => setFormMaestro((f) => ({ ...f, maestro_clave: e.target.value }))}
                  />
                </div>
              </div>
              <div className="ciclos-crud-field-row">
                <div className="ciclos-crud-field">
                  <label htmlFor="cm-email">Correo</label>
                  <input
                    id="cm-email"
                    type="email"
                    value={formMaestro.maestro_email}
                    onChange={(e) => setFormMaestro((f) => ({ ...f, maestro_email: e.target.value }))}
                  />
                </div>
                <div className="ciclos-crud-field">
                  <label htmlFor="cm-cel">Celular</label>
                  <input
                    id="cm-cel"
                    value={formMaestro.maestro_celular}
                    onChange={(e) => setFormMaestro((f) => ({ ...f, maestro_celular: e.target.value }))}
                  />
                </div>
              </div>
              <div className="ciclos-crud-form-actions">
                <button type="submit" className="ciclos-crud-btn ciclos-crud-btn--primary" disabled={guardando}>
                  {guardando ? <Loader2 size={18} className="ciclos-crud-spin" aria-hidden /> : null}
                  {editMaestroId ? 'Actualizar' : 'Registrar maestro'}
                </button>
                {editMaestroId ? (
                  <button type="button" className="ciclos-crud-btn ciclos-crud-btn--ghost" onClick={resetMaestro}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="ciclos-crud-table-card">
            <div className="ciclos-crud-table-header">
              <h2 className="ciclos-crud-form-title">Maestros registrados</h2>
              <button type="button" className="ciclos-crud-btn ciclos-crud-btn--secondary" onClick={resetMaestro}>
                <Plus size={16} aria-hidden />
                Nuevo
              </button>
            </div>
            <div className="ciclos-crud-table-wrap">
              <table className="ciclos-crud-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {maestros.map((m) => (
                    <tr key={m.maestro_id} className={editMaestroId === m.maestro_id ? 'ciclos-crud-row--active' : ''}>
                      <td>{nombreMaestro(m)}</td>
                      <td>{m.maestro_usuario}</td>
                      <td>{m.maestro_email ?? '—'}</td>
                      <td className="ciclos-crud-actions">
                        <button
                          type="button"
                          className="ciclos-crud-icon-btn"
                          aria-label={`Editar ${m.maestro_usuario}`}
                          onClick={() => {
                            setEditMaestroId(m.maestro_id)
                            setFormMaestro({
                              maestro_id: m.maestro_id,
                              maestro_app: m.maestro_app ?? '',
                              maestro_apm: m.maestro_apm ?? '',
                              maestro_nombre: m.maestro_nombre ?? '',
                              maestro_usuario: m.maestro_usuario,
                              maestro_clave: '',
                              maestro_email: m.maestro_email ?? '',
                              maestro_celular: m.maestro_celular ?? '',
                              maestro_sexo: m.maestro_sexo ?? 0,
                            })
                          }}
                        >
                          <Pencil size={16} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="ciclos-crud-icon-btn ciclos-crud-icon-btn--danger"
                          aria-label={`Eliminar ${m.maestro_usuario}`}
                          disabled={guardando}
                          onClick={() => void onEliminarMaestro(m)}
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {subTab === 'materias' && modoSecundaria ? (
        <div className="ciclos-crud-layout">
          <section className="ciclos-crud-form-card">
            <h2 className="ciclos-crud-form-title">{editMateriaId ? 'Editar materia' : 'Nueva materia'}</h2>
            <form className="ciclos-crud-form" onSubmit={onGuardarMateria}>
              <div className="ciclos-crud-field">
                <label htmlFor="cm-mat-nombre">Nombre *</label>
                <input
                  id="cm-mat-nombre"
                  required
                  value={formMateria.materia_nombre}
                  onChange={(e) => setFormMateria((f) => ({ ...f, materia_nombre: e.target.value }))}
                />
              </div>
              <div className="ciclos-crud-field-row">
                <div className="ciclos-crud-field">
                  <label htmlFor="cm-mat-grado">Grado</label>
                  <select
                    id="cm-mat-grado"
                    value={formMateria.materia_grado}
                    onChange={(e) => setFormMateria((f) => ({ ...f, materia_grado: Number(e.target.value) }))}
                  >
                    {gradosSecundaria.map((g) => (
                      <option key={g.valor} value={g.valor}>
                        {g.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ciclos-crud-field">
                  <label htmlFor="cm-mat-orden">Orden</label>
                  <input
                    id="cm-mat-orden"
                    type="number"
                    min={0}
                    value={formMateria.materia_orden}
                    onChange={(e) => setFormMateria((f) => ({ ...f, materia_orden: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="ciclos-crud-form-actions">
                <button type="submit" className="ciclos-crud-btn ciclos-crud-btn--primary" disabled={guardando}>
                  {editMateriaId ? 'Actualizar' : 'Crear materia'}
                </button>
                {editMateriaId ? (
                  <button type="button" className="ciclos-crud-btn ciclos-crud-btn--ghost" onClick={resetMateria}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="ciclos-crud-table-card">
            <div className="ciclos-crud-table-header">
              <h2 className="ciclos-crud-form-title">Materias de secundaria</h2>
              <select
                className="cat-maestros-filtro-grado"
                value={filtroGradoMateria}
                onChange={(e) => setFiltroGradoMateria(Number(e.target.value))}
                aria-label="Filtrar por grado"
              >
                <option value={0}>Todos los grados</option>
                {gradosSecundaria.map((g) => (
                  <option key={g.valor} value={g.valor}>
                    {g.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="ciclos-crud-table-wrap">
              <table className="ciclos-crud-table">
                <thead>
                  <tr>
                    <th>Materia</th>
                    <th>Grado</th>
                    <th>Orden</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {materias.map((m) => (
                    <tr key={m.materia_id} className={editMateriaId === m.materia_id ? 'ciclos-crud-row--active' : ''}>
                      <td>{m.materia_nombre}</td>
                      <td>{gradosSecundaria.find((g) => g.valor === m.materia_grado)?.etiqueta ?? m.materia_grado}</td>
                      <td>{m.materia_orden}</td>
                      <td className="ciclos-crud-actions">
                        <button
                          type="button"
                          className="ciclos-crud-icon-btn"
                          onClick={() => {
                            setEditMateriaId(m.materia_id)
                            setFormMateria({
                              materia_id: m.materia_id,
                              materia_nombre: m.materia_nombre,
                              materia_nivel: m.materia_nivel,
                              materia_grado: m.materia_grado,
                              materia_orden: m.materia_orden,
                            })
                          }}
                        >
                          <Pencil size={16} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="ciclos-crud-icon-btn ciclos-crud-icon-btn--danger"
                          disabled={guardando}
                          onClick={() => void onEliminarMateria(m)}
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {subTab === 'asignaciones' && modoSecundaria ? (
        <div className="ciclos-crud-layout">
          <section className="ciclos-crud-form-card">
            <h2 className="ciclos-crud-form-title">{editAsigId ? 'Editar asignación' : 'Nueva asignación'}</h2>
            <form className="ciclos-crud-form" onSubmit={onGuardarAsigSecundaria}>
              <div className="ciclos-crud-field">
                <label htmlFor="cm-asig-maestro">Maestro *</label>
                <select
                  id="cm-asig-maestro"
                  required
                  value={formAsig.maestro_id || ''}
                  onChange={(e) => setFormAsig((f) => ({ ...f, maestro_id: Number(e.target.value) }))}
                >
                  <option value="">Selecciona…</option>
                  {maestros.map((m) => (
                    <option key={m.maestro_id} value={m.maestro_id}>
                      {nombreMaestro(m)} ({m.maestro_usuario})
                    </option>
                  ))}
                </select>
              </div>
              <div className="ciclos-crud-field">
                <label htmlFor="cm-asig-materia">Materia *</label>
                <select
                  id="cm-asig-materia"
                  required
                  value={formAsig.materia_id || ''}
                  onChange={(e) => setFormAsig((f) => ({ ...f, materia_id: Number(e.target.value) }))}
                >
                  <option value="">Selecciona…</option>
                  {materias.map((m) => (
                    <option key={m.materia_id} value={m.materia_id}>
                      {m.materia_nombre} ·{' '}
                      {gradosSecundaria.find((g) => g.valor === m.materia_grado)?.etiqueta}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ciclos-crud-field">
                <label htmlFor="cm-asig-grupo">Grupo *</label>
                <select
                  id="cm-asig-grupo"
                  value={formAsig.grupo_letra}
                  onChange={(e) => setFormAsig((f) => ({ ...f, grupo_letra: e.target.value }))}
                >
                  {GRUPOS_ASIGNACION.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ciclos-crud-form-actions">
                <button type="submit" className="ciclos-crud-btn ciclos-crud-btn--primary" disabled={guardando}>
                  {editAsigId ? 'Actualizar' : 'Asignar'}
                </button>
                {editAsigId ? (
                  <button type="button" className="ciclos-crud-btn ciclos-crud-btn--ghost" onClick={resetAsig}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="ciclos-crud-table-card">
            <h2 className="ciclos-crud-form-title">Asignaciones secundaria</h2>
            <div className="ciclos-crud-table-wrap">
              <table className="ciclos-crud-table">
                <thead>
                  <tr>
                    <th>Maestro</th>
                    <th>Materia</th>
                    <th>Grupo</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {asignaciones.map((a) => (
                    <tr key={a.grupo_id}>
                      <td>{a.maestro_nombre}</td>
                      <td>{a.materia_nombre}</td>
                      <td>{a.grupo_letra}</td>
                      <td className="ciclos-crud-actions">
                        <button
                          type="button"
                          className="ciclos-crud-icon-btn"
                          onClick={() => {
                            setEditAsigId(a.grupo_id)
                            setFormAsig({
                              maestro_id: a.maestro_id,
                              materia_id: a.materia_id,
                              grupo_letra: a.grupo_letra,
                            })
                          }}
                        >
                          <Pencil size={16} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="ciclos-crud-icon-btn ciclos-crud-icon-btn--danger"
                          disabled={guardando}
                          onClick={() => void onEliminarAsig(a)}
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}

      {subTab === 'asignaciones' && !modoSecundaria ? (
        <section className="ciclos-crud-table-card cat-maestros-grid-card">
          <h2 className="ciclos-crud-form-title">Asignación por grado y grupo</h2>
          <p className="servicios-panel-hint cat-maestros-grid-hint">
            Maestro(a) = español · Teacher = inglés. Elige docente por celda; vacío quita la asignación.
          </p>
          <div className="ciclos-crud-table-wrap">
            <table className="ciclos-crud-table cat-maestros-grid">
              <thead>
                <tr>
                  <th>Grado</th>
                  {GRUPOS_ASIGNACION.map((g) => (
                    <th key={g} colSpan={2}>
                      Grupo {g}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th />
                  {GRUPOS_ASIGNACION.flatMap((g) => [
                    <th key={`${g}-es`}>Maestro(a)</th>,
                    <th key={`${g}-en`}>Teacher</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {filasGG.map((fila) => (
                  <tr key={`${fila.nivel}-${fila.grado}`}>
                    <td>{fila.etiqueta}</td>
                    {GRUPOS_ASIGNACION.flatMap((grupo) => [
                      <td key={`${fila.grado}-${grupo}-es`}>
                        <select
                          className="cat-maestros-select"
                          disabled={guardando}
                          value={maestroDeCelda(fila.nivel, fila.grado, grupo, 1)}
                          onChange={(e) =>
                            void onAsignarGradoGrupo(
                              fila.nivel,
                              fila.grado,
                              grupo,
                              'es',
                              Number(e.target.value)
                            )
                          }
                        >
                          <option value={0}>—</option>
                          {maestros.map((m) => (
                            <option key={m.maestro_id} value={m.maestro_id}>
                              {nombreMaestro(m)}
                            </option>
                          ))}
                        </select>
                      </td>,
                      <td key={`${fila.grado}-${grupo}-en`}>
                        <select
                          className="cat-maestros-select"
                          disabled={guardando}
                          value={maestroDeCelda(fila.nivel, fila.grado, grupo, 2)}
                          onChange={(e) =>
                            void onAsignarGradoGrupo(
                              fila.nivel,
                              fila.grado,
                              grupo,
                              'en',
                              Number(e.target.value)
                            )
                          }
                        >
                          <option value={0}>—</option>
                          {maestros.map((m) => (
                            <option key={m.maestro_id} value={m.maestro_id}>
                              {nombreMaestro(m)}
                            </option>
                          ))}
                        </select>
                      </td>,
                    ])}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
