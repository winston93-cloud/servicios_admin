'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { NIVELES_ESCOLARES_OPCIONES } from '@/lib/nivelEscolar'
import type { FilaPanelControlEscolar } from '@/lib/controlEscolarPanelService'

type EstadoFiltro = 'pendiente' | 'aprobado' | 'todos'
type NivelFiltro = 'todos' | 1 | 2 | 3 | 4

type Props = {
  abierto: boolean
  onCerrar: () => void
  onElegirAlumno: (alumnoRef: string) => void
}

function formatearFecha(iso: string | null): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso.slice(0, 16).replace('T', ' ')
  return new Date(t).toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

export default function ControlEscolarPanelModal({
  abierto,
  onCerrar,
  onElegirAlumno,
}: Props) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState<FilaPanelControlEscolar[]>([])
  const [aprobados, setAprobados] = useState<FilaPanelControlEscolar[]>([])
  const [estado, setEstado] = useState<EstadoFiltro>('pendiente')
  const [nivel, setNivel] = useState<NivelFiltro>('todos')
  const [q, setQ] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/control-escolar/panel')
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        pendientes?: FilaPanelControlEscolar[]
        aprobados?: FilaPanelControlEscolar[]
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message || 'No se pudo cargar el panel')
      }
      setPendientes(data.pendientes ?? [])
      setAprobados(data.aprobados ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
      setPendientes([])
      setAprobados([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (!abierto) return
    void cargar()
  }, [abierto, cargar])

  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [abierto, onCerrar])

  const conteoNivel = useMemo(() => {
    const base =
      estado === 'pendiente'
        ? pendientes
        : estado === 'aprobado'
          ? aprobados
          : [...pendientes, ...aprobados]
    return NIVELES_ESCOLARES_OPCIONES.map((n) => ({
      ...n,
      total: base.filter((f) => f.nivel === n.valor).length,
    }))
  }, [estado, pendientes, aprobados])

  const filas = useMemo(() => {
    let lista =
      estado === 'pendiente'
        ? pendientes
        : estado === 'aprobado'
          ? aprobados
          : [...pendientes, ...aprobados]

    if (nivel !== 'todos') {
      lista = lista.filter((f) => f.nivel === nivel)
    }

    const needle = normalizar(q)
    if (needle) {
      lista = lista.filter((f) => {
        const haystack = normalizar(
          `${f.nombre} ${f.alumnoRef} ${f.nivelEtiqueta} ${f.gradoEtiqueta}`
        )
        return haystack.includes(needle)
      })
    }

    return lista
  }, [estado, nivel, q, pendientes, aprobados])

  if (!abierto) return null

  return (
    <div
      className="ce-panel-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div
        className="ce-panel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ce-panel-title"
      >
        <header className="ce-panel-modal__head">
          <span className="ce-panel-modal__badge" aria-hidden>
            <ClipboardList size={20} />
          </span>
          <div className="ce-panel-modal__titles">
            <p className="ce-panel-modal__eyebrow">Minipanel</p>
            <h2 id="ce-panel-title">Documentación NI</h2>
            <p className="ce-panel-modal__sub">
              Pendientes de liberar y ya autorizados, con filtro por nivel.
            </p>
          </div>
          <div className="ce-panel-modal__head-actions">
            <button
              type="button"
              className="ce-panel-icon-btn"
              onClick={() => void cargar()}
              disabled={cargando}
              aria-label="Actualizar"
              title="Actualizar"
            >
              <RefreshCw size={18} className={cargando ? 'ce-spin' : undefined} />
            </button>
            <button
              type="button"
              className="ce-panel-icon-btn"
              onClick={onCerrar}
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="ce-panel-stats">
          <button
            type="button"
            className={`ce-panel-stat ${estado === 'pendiente' ? 'is-active is-warn' : ''}`}
            onClick={() => setEstado('pendiente')}
          >
            <span className="ce-panel-stat__label">Pendientes</span>
            <strong className="ce-panel-stat__value">{pendientes.length}</strong>
          </button>
          <button
            type="button"
            className={`ce-panel-stat ${estado === 'aprobado' ? 'is-active is-ok' : ''}`}
            onClick={() => setEstado('aprobado')}
          >
            <span className="ce-panel-stat__label">Aprobados</span>
            <strong className="ce-panel-stat__value">{aprobados.length}</strong>
          </button>
          <button
            type="button"
            className={`ce-panel-stat ${estado === 'todos' ? 'is-active' : ''}`}
            onClick={() => setEstado('todos')}
          >
            <span className="ce-panel-stat__label">Todos</span>
            <strong className="ce-panel-stat__value">
              {pendientes.length + aprobados.length}
            </strong>
          </button>
        </div>

        <div className="ce-panel-filters">
          <label className="ce-panel-field">
            <span>Nivel</span>
            <select
              value={nivel === 'todos' ? 'todos' : String(nivel)}
              onChange={(e) => {
                const v = e.target.value
                setNivel(v === 'todos' ? 'todos' : (Number(v) as 1 | 2 | 3 | 4))
              }}
            >
              <option value="todos">Todos los niveles</option>
              {conteoNivel.map((n) => (
                <option key={n.valor} value={n.valor}>
                  {n.etiqueta} ({n.total})
                </option>
              ))}
            </select>
          </label>

          <label className="ce-panel-field">
            <span>Estado</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoFiltro)}
            >
              <option value="pendiente">Pendientes de autorizar</option>
              <option value="aprobado">Ya autorizados</option>
              <option value="todos">Pendientes y autorizados</option>
            </select>
          </label>

          <label className="ce-panel-field ce-panel-field--search">
            <span>Buscar</span>
            <span className="ce-panel-search">
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre o No. de control…"
              />
            </span>
          </label>
        </div>

        <div className="ce-panel-body">
          {cargando && (
            <p className="ce-panel-empty">
              <Loader2 size={18} className="ce-spin" aria-hidden />
              Cargando panel…
            </p>
          )}

          {!cargando && error && (
            <p className="ce-panel-empty ce-panel-empty--err" role="alert">
              {error}
            </p>
          )}

          {!cargando && !error && filas.length === 0 && (
            <p className="ce-panel-empty">
              {estado === 'pendiente'
                ? 'No hay alumnos pendientes de liberar con los filtros actuales.'
                : estado === 'aprobado'
                  ? 'No hay autorizaciones con los filtros actuales.'
                  : 'Sin resultados con los filtros actuales.'}
            </p>
          )}

          {!cargando && !error && filas.length > 0 && (
            <div className="ce-panel-table-wrap">
              <table className="ce-panel-table">
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Nivel / grado</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={`${f.estado}-${f.alumnoRef}-${f.cicloValor ?? ''}-${f.autorizadoEn ?? ''}`}>
                      <td>
                        <div className="ce-panel-alumno">
                          <strong>{f.nombre}</strong>
                          <span>Ref. {f.alumnoRef}</span>
                        </div>
                      </td>
                      <td>
                        <div className="ce-panel-nivel">
                          <span>{f.nivelEtiqueta}</span>
                          <span>
                            {f.gradoEtiqueta}
                            {f.grupoEtiqueta !== '—' ? ` · ${f.grupoEtiqueta}` : ''}
                          </span>
                        </div>
                      </td>
                      <td>
                        {f.estado === 'pendiente' ? (
                          <span className="ce-panel-badge ce-panel-badge--warn">
                            Pendiente
                          </span>
                        ) : (
                          <span className="ce-panel-badge ce-panel-badge--ok">
                            <CheckCircle2 size={13} aria-hidden />
                            Autorizado
                          </span>
                        )}
                        {f.autorizadoPor && (
                          <span className="ce-panel-meta">por {f.autorizadoPor}</span>
                        )}
                      </td>
                      <td className="ce-panel-fecha">
                        {f.estado === 'pendiente'
                          ? formatearFecha(f.docsEnviadoAt)
                          : formatearFecha(f.autorizadoEn)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ce-panel-row-btn"
                          onClick={() => {
                            onElegirAlumno(f.alumnoRef)
                            onCerrar()
                          }}
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="ce-panel-modal__foot">
          <span>
            Mostrando <strong>{filas.length}</strong>
            {estado === 'pendiente'
              ? ' pendiente(s)'
              : estado === 'aprobado'
                ? ' autorizado(s)'
                : ' registro(s)'}
          </span>
          <button type="button" className="ce-panel-close-btn" onClick={onCerrar}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  )
}
