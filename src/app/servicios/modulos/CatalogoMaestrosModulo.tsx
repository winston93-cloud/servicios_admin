'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Baby,
  BookMarked,
  GraduationCap,
  Layers3,
  Link2,
  Loader2,
  Pencil,
  Plus,
  School,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import {
  CATALOGO_MAESTROS_TABS,
  GRUPOS_ASIGNACION,
  esModoMateriasLibres,
  etiquetaNivelMaestro,
  nivelDefaultAlta,
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
  maestro_nivel: number
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
  maestro_nivel: 4,
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

const NIVEL_UI: Record<
  CatalogoMaestrosTab,
  { icon: typeof GraduationCap; tone: string; blurb: string }
> = {
  'maternal-kinder': {
    icon: Baby,
    tone: 'sky',
    blurb: 'Maestro(a) y Teacher por grado y grupo',
  },
  primaria: {
    icon: School,
    tone: 'indigo',
    blurb: 'Español e inglés por grado y grupo',
  },
  secundaria: {
    icon: GraduationCap,
    tone: 'rose',
    blurb: 'Materia, grado y grupo por docente',
  },
}

const SUBTAB_UI: Record<
  CatalogoMaestrosSubTab,
  { icon: typeof Users; label: string }
> = {
  maestros: { icon: Users, label: 'Maestros' },
  materias: { icon: BookMarked, label: 'Materias' },
  asignaciones: { icon: Link2, label: 'Asignaciones' },
}

function maestrosDelNivel(lista: MaestroRow[], nivel: number): MaestroRow[] {
  return lista.filter((m) => m.maestro_nivel === nivel)
}

function inicialesMaestro(m: MaestroRow): string {
  const partes = nombreMaestro(m).split(/\s+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return (partes[0]?.slice(0, 2) ?? '?').toUpperCase()
}

function GrupoBadge({ valor }: { valor: string }) {
  const letras = String(valor || '—')
    .toUpperCase()
    .split('')
    .filter((c) => /[A-Z]/.test(c))
  if (!letras.length) return <span className="cat-maestros-grupo-badge">—</span>
  return (
    <span className="cat-maestros-grupo-badges">
      {letras.map((l) => (
        <span key={l} className={`cat-maestros-grupo-badge cat-maestros-grupo-badge--${l.toLowerCase()}`}>
          {l}
        </span>
      ))}
    </span>
  )
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
  const nivelUi = NIVEL_UI[tabNivel]
  const NivelIcon = nivelUi.icon

  const stats = useMemo(
    () => ({
      maestros: maestros.length,
      materias: materias.length,
      asignaciones: asignaciones.length,
    }),
    [maestros, materias, asignaciones]
  )

  const cargarMaestros = useCallback(async () => {
    const data = await apiJson<{ maestros: MaestroRow[] }>(
      `/api/servicios/catalogo-maestros/maestros?tab=${tabNivel}`
    )
    setMaestros(data.maestros ?? [])
  }, [tabNivel])

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

  useEffect(() => {
    setEditMaestroId(null)
    setFormMaestro({ ...MAESTRO_VACIO, maestro_nivel: nivelDefaultAlta(tabNivel) })
  }, [tabNivel])

  const resetMaestro = () => {
    setEditMaestroId(null)
    setFormMaestro({ ...MAESTRO_VACIO, maestro_nivel: nivelDefaultAlta(tabNivel) })
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
          tab: tabNivel,
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
      <div className="cat-maestros-hero" data-tone={nivelUi.tone}>
        <div className="cat-maestros-hero-glow" aria-hidden />
        <div className="cat-maestros-hero-inner">
          <div className="cat-maestros-hero-copy">
            <p className="cat-maestros-kicker">
              <Sparkles size={14} aria-hidden />
              Control escolar · Docentes
            </p>
            <h1 className="cat-maestros-title">Catálogo de maestros</h1>
            <p className="cat-maestros-lead">
              Personal docente y asignaciones por nivel. Secundaria: maestro por materia, grado y
              grupo. Maternal, Kinder y Primaria: maestro(a) de español y Teacher de inglés por
              grado y grupo.
            </p>
          </div>
          <div className="cat-maestros-hero-badge" aria-hidden>
            <NivelIcon size={28} strokeWidth={1.6} />
          </div>
        </div>

        <div className="cat-maestros-stats" role="list">
          <div className="cat-maestros-stat" role="listitem">
            <span className="cat-maestros-stat-val">{stats.maestros}</span>
            <span className="cat-maestros-stat-label">Maestros</span>
          </div>
          {modoSecundaria ? (
            <div className="cat-maestros-stat" role="listitem">
              <span className="cat-maestros-stat-val">{stats.materias}</span>
              <span className="cat-maestros-stat-label">Materias</span>
            </div>
          ) : null}
          <div className="cat-maestros-stat" role="listitem">
            <span className="cat-maestros-stat-val">{stats.asignaciones}</span>
            <span className="cat-maestros-stat-label">Asignaciones</span>
          </div>
        </div>
      </div>

      <div className="cat-maestros-nav-block">
        <p className="cat-maestros-nav-label">Nivel escolar</p>
        <div className="cat-maestros-nivel-tabs" role="tablist" aria-label="Nivel escolar">
          {CATALOGO_MAESTROS_TABS.map((t) => {
            const meta = NIVEL_UI[t.id]
            const Icon = meta.icon
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tabNivel === t.id}
                className={`cat-maestros-nivel-tab${tabNivel === t.id ? ' is-active' : ''}`}
                data-tone={meta.tone}
                onClick={() => setTabNivel(t.id)}
              >
                <span className="cat-maestros-nivel-tab-icon">
                  <Icon size={18} aria-hidden />
                </span>
                <span className="cat-maestros-nivel-tab-text">
                  <strong>{t.label}</strong>
                  <small>{meta.blurb}</small>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="cat-maestros-nav-block cat-maestros-nav-block--sub">
        <p className="cat-maestros-nav-label">
          <Layers3 size={14} aria-hidden /> Sección · {nivelUi.blurb}
        </p>
        <div className="cat-maestros-sub-tabs" role="tablist" aria-label="Sección">
          {subTabs.map((id) => {
            const meta = SUBTAB_UI[id]
            const Icon = meta.icon
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={subTab === id}
                className={`cat-maestros-sub-tab${subTab === id ? ' is-active' : ''}`}
                onClick={() => setSubTab(id)}
              >
                <Icon size={16} aria-hidden />
                {meta.label}
              </button>
            )
          })}
        </div>
      </div>

      {mensaje ? (
        <p className="cat-maestros-flash cat-maestros-flash--ok" role="status">
          {mensaje}
        </p>
      ) : null}
      {error ? (
        <p className="cat-maestros-flash cat-maestros-flash--err" role="alert">
          {error}
        </p>
      ) : null}

      {cargando && subTab === 'maestros' ? (
        <p className="cat-maestros-loading">
          <Loader2 size={22} className="ciclos-crud-spin" aria-hidden />
          Cargando catálogo…
        </p>
      ) : null}

      <div key={`${tabNivel}-${subTab}`} className="cat-maestros-panel">

      {subTab === 'maestros' ? (
        <div className="cat-maestros-crud-layout">
          <section className="cat-maestros-card cat-maestros-card--form">
            <div className="cat-maestros-card-head">
              <span className="cat-maestros-card-icon">
                <Users size={18} aria-hidden />
              </span>
              <h2 className="cat-maestros-card-title">{editMaestroId ? 'Editar maestro' : 'Nuevo maestro'}</h2>
            </div>
            <form className="ciclos-crud-form cat-maestros-form" onSubmit={onGuardarMaestro}>
              {tabNivel === 'maternal-kinder' ? (
                <div className="ciclos-crud-field">
                  <label htmlFor="cm-nivel-doc">Nivel del docente *</label>
                  <select
                    id="cm-nivel-doc"
                    value={formMaestro.maestro_nivel}
                    onChange={(e) =>
                      setFormMaestro((f) => ({ ...f, maestro_nivel: Number(e.target.value) }))
                    }
                  >
                    <option value={1}>Maternal</option>
                    <option value={2}>Kinder</option>
                  </select>
                </div>
              ) : (
                <p className="cat-maestros-nivel-lock">
                  Alta en{' '}
                  <strong>{tabNivel === 'primaria' ? 'Primaria' : 'Secundaria'}</strong> — solo
                  docentes de este nivel.
                </p>
              )}
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
                <button type="submit" className="cat-maestros-btn cat-maestros-btn--primary" disabled={guardando}>
                  {guardando ? <Loader2 size={18} className="ciclos-crud-spin" aria-hidden /> : null}
                  {editMaestroId ? 'Actualizar' : 'Registrar maestro'}
                </button>
                {editMaestroId ? (
                  <button type="button" className="cat-maestros-btn cat-maestros-btn--ghost" onClick={resetMaestro}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="cat-maestros-card cat-maestros-card--table">
            <div className="cat-maestros-card-head cat-maestros-card-head--row">
              <div>
                <span className="cat-maestros-card-icon">
                  <Users size={18} aria-hidden />
                </span>
                <h2 className="cat-maestros-card-title">Maestros registrados</h2>
              </div>
              <button type="button" className="cat-maestros-btn cat-maestros-btn--secondary" onClick={resetMaestro}>
                <Plus size={16} aria-hidden />
                Nuevo
              </button>
            </div>
            <div className="cat-maestros-table-wrap">
              <table className="cat-maestros-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    {tabNivel === 'maternal-kinder' ? <th>Nivel</th> : null}
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th aria-label="Acciones" />
                  </tr>
                </thead>
                <tbody>
                  {maestros.map((m) => (
                    <tr key={m.maestro_id} className={editMaestroId === m.maestro_id ? 'cat-maestros-row--active' : ''}>
                      <td>
                        <span className="cat-maestros-person">
                          <span className="cat-maestros-avatar" aria-hidden>
                            {inicialesMaestro(m)}
                          </span>
                          <span className="cat-maestros-person-name">{nombreMaestro(m)}</span>
                        </span>
                      </td>
                      {tabNivel === 'maternal-kinder' ? (
                        <td>
                          <span
                            className={`cat-maestros-nivel-pill cat-maestros-nivel-pill--${m.maestro_nivel}`}
                          >
                            {etiquetaNivelMaestro(m.maestro_nivel)}
                          </span>
                        </td>
                      ) : null}
                      <td>
                        <code className="cat-maestros-user-chip">{m.maestro_usuario}</code>
                      </td>
                      <td>{m.maestro_email ?? '—'}</td>
                      <td className="cat-maestros-actions">
                        <button
                          type="button"
                          className="cat-maestros-icon-btn"
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
                              maestro_nivel: m.maestro_nivel ?? nivelDefaultAlta(tabNivel),
                            })
                          }}
                        >
                          <Pencil size={16} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="cat-maestros-icon-btn cat-maestros-icon-btn--danger"
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
        <div className="cat-maestros-crud-layout">
          <section className="cat-maestros-card cat-maestros-card--form">
            <div className="cat-maestros-card-head">
              <span className="cat-maestros-card-icon">
                <BookMarked size={18} aria-hidden />
              </span>
              <h2 className="cat-maestros-card-title">{editMateriaId ? 'Editar materia' : 'Nueva materia'}</h2>
            </div>
            <form className="ciclos-crud-form cat-maestros-form" onSubmit={onGuardarMateria}>
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
                <button type="submit" className="cat-maestros-btn cat-maestros-btn--primary" disabled={guardando}>
                  {editMateriaId ? 'Actualizar' : 'Crear materia'}
                </button>
                {editMateriaId ? (
                  <button type="button" className="cat-maestros-btn cat-maestros-btn--ghost" onClick={resetMateria}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="cat-maestros-card cat-maestros-card--table">
            <div className="cat-maestros-card-head cat-maestros-card-head--row">
              <div>
                <span className="cat-maestros-card-icon">
                  <BookMarked size={18} aria-hidden />
                </span>
                <h2 className="cat-maestros-card-title">Materias de secundaria</h2>
              </div>
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
            <div className="cat-maestros-table-wrap">
              <table className="cat-maestros-table">
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
                    <tr key={m.materia_id} className={editMateriaId === m.materia_id ? 'cat-maestros-row--active' : ''}>
                      <td>
                        <span className="cat-maestros-materia-tag">{m.materia_nombre}</span>
                      </td>
                      <td>
                        <span className="cat-maestros-grado-chip">
                          {gradosSecundaria.find((g) => g.valor === m.materia_grado)?.etiqueta ?? m.materia_grado}
                        </span>
                      </td>
                      <td>{m.materia_orden}</td>
                      <td className="cat-maestros-actions">
                        <button type="button" className="cat-maestros-icon-btn" onClick={() => {
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
                          className="cat-maestros-icon-btn cat-maestros-icon-btn--danger"
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
        <div className="cat-maestros-crud-layout">
          <section className="cat-maestros-card cat-maestros-card--form">
            <div className="cat-maestros-card-head">
              <span className="cat-maestros-card-icon">
                <Link2 size={18} aria-hidden />
              </span>
              <h2 className="cat-maestros-card-title">{editAsigId ? 'Editar asignación' : 'Nueva asignación'}</h2>
            </div>
            <form className="ciclos-crud-form cat-maestros-form" onSubmit={onGuardarAsigSecundaria}>
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
                <button type="submit" className="cat-maestros-btn cat-maestros-btn--primary" disabled={guardando}>
                  {editAsigId ? 'Actualizar' : 'Asignar'}
                </button>
                {editAsigId ? (
                  <button type="button" className="cat-maestros-btn cat-maestros-btn--ghost" onClick={resetAsig}>
                    Cancelar
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section className="cat-maestros-card cat-maestros-card--table">
            <div className="cat-maestros-card-head">
              <span className="cat-maestros-card-icon">
                <Link2 size={18} aria-hidden />
              </span>
              <h2 className="cat-maestros-card-title">Asignaciones secundaria</h2>
            </div>
            <div className="cat-maestros-table-wrap">
              <table className="cat-maestros-table">
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
                      <td>
                        <span className="cat-maestros-person-name">{a.maestro_nombre}</span>
                      </td>
                      <td>
                        <span className="cat-maestros-materia-tag cat-maestros-materia-tag--sm">
                          {a.materia_nombre}
                        </span>
                      </td>
                      <td>
                        <GrupoBadge valor={a.grupo_letra} />
                      </td>
                      <td className="cat-maestros-actions">
                        <button type="button" className="cat-maestros-icon-btn" onClick={() => {
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
                          className="cat-maestros-icon-btn cat-maestros-icon-btn--danger"
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
        <section className="cat-maestros-asig-board">
          <div className="cat-maestros-asig-board-head">
            <div>
              <h2 className="cat-maestros-asig-board-title">Mapa de titulares</h2>
              <p className="cat-maestros-asig-board-lead">
                Solo docentes de{' '}
                <strong>{tabNivel === 'primaria' ? 'Primaria' : 'Maternal / Kinder'}</strong>. Cada
                celda es independiente — español e inglés por grupo.
              </p>
            </div>
            <div className="cat-maestros-asig-board-meta">
              <span className="cat-maestros-legend cat-maestros-legend--es">Maestro(a)</span>
              <span className="cat-maestros-legend cat-maestros-legend--en">Teacher</span>
            </div>
          </div>

          {maestros.length === 0 ? (
            <div className="cat-maestros-empty">
              <Users size={28} aria-hidden />
              <p>Aún no hay docentes en este nivel.</p>
              <button type="button" className="cat-maestros-btn cat-maestros-btn--primary" onClick={() => setSubTab('maestros')}>
                Dar de alta maestros
              </button>
            </div>
          ) : (
            <div className="cat-maestros-grado-grid">
              {filasGG.map((fila) => {
                const docentesNivel = maestrosDelNivel(maestros, fila.nivel)
                return (
                  <article
                    key={`${fila.nivel}-${fila.grado}`}
                    className="cat-maestros-grado-card"
                    data-nivel={fila.nivel}
                  >
                    <header className="cat-maestros-grado-card-head">
                      <span className="cat-maestros-grado-num">{fila.grado}</span>
                      <div>
                        <h3>{fila.etiqueta}</h3>
                        {tabNivel === 'maternal-kinder' ? (
                          <span className="cat-maestros-nivel-pill cat-maestros-nivel-pill--mini">
                            {etiquetaNivelMaestro(fila.nivel)}
                          </span>
                        ) : null}
                      </div>
                    </header>
                    <div className="cat-maestros-grupo-grid">
                      {GRUPOS_ASIGNACION.map((grupo) => (
                        <div key={grupo} className="cat-maestros-grupo-card" data-grupo={grupo}>
                          <span className={`cat-maestros-grupo-badge cat-maestros-grupo-badge--${grupo.toLowerCase()}`}>
                            Grupo {grupo}
                          </span>
                          <label className="cat-maestros-slot cat-maestros-slot--es">
                            <span>Maestro(a)</span>
                            <select
                              className="cat-maestros-select"
                              disabled={guardando || docentesNivel.length === 0}
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
                              <option value={0}>Sin asignar</option>
                              {docentesNivel.map((m) => (
                                <option key={m.maestro_id} value={m.maestro_id}>
                                  {nombreMaestro(m)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="cat-maestros-slot cat-maestros-slot--en">
                            <span>Teacher</span>
                            <select
                              className="cat-maestros-select"
                              disabled={guardando || docentesNivel.length === 0}
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
                              <option value={0}>Sin asignar</option>
                              {docentesNivel.map((m) => (
                                <option key={m.maestro_id} value={m.maestro_id}>
                                  {nombreMaestro(m)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : null}
      </div>
    </div>
  )
}
