'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  Stamp,
} from 'lucide-react'
import type {
  DashboardTramiteCe,
  FilaTramiteAdministrativo,
} from '@/lib/controlEscolarTramitesTipos'
import { etiquetaDashboardTramite } from '@/lib/controlEscolarTramitesTipos'

type EstadoFiltro = 'pendiente' | 'liberado'
type DashFiltro = 'todos' | DashboardTramiteCe

type Props = {
  usuarioNombre: string
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

const DASHBOARDS: DashboardTramiteCe[] = ['kinder', 'primaria', 'secundaria']

export default function ControlEscolarAdministrativos({ usuarioNombre }: Props) {
  const [cargando, setCargando] = useState(false)
  const [liberandoId, setLiberandoId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState<FilaTramiteAdministrativo[]>([])
  const [liberados, setLiberados] = useState<FilaTramiteAdministrativo[]>([])
  const [estado, setEstado] = useState<EstadoFiltro>('pendiente')
  const [dash, setDash] = useState<DashFiltro>('todos')
  const [q, setQ] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/control-escolar/tramites')
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        pendientes?: FilaTramiteAdministrativo[]
        liberados?: FilaTramiteAdministrativo[]
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message || 'No se pudo cargar Administrativos')
      }
      setPendientes(data.pendientes ?? [])
      setLiberados(data.liberados ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión')
      setPendientes([])
      setLiberados([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const filas = useMemo(() => {
    let lista = estado === 'pendiente' ? pendientes : liberados
    if (dash !== 'todos') lista = lista.filter((f) => f.dashboard === dash)
    const needle = normalizar(q)
    if (needle) {
      lista = lista.filter((f) =>
        normalizar(
          `${f.nombre} ${f.alumnoRef} ${f.conceptoNombre} ${f.pagoFolio ?? ''}`
        ).includes(needle)
      )
    }
    return lista
  }, [estado, dash, q, pendientes, liberados])

  async function liberar(id: number) {
    if (!usuarioNombre) {
      setError('No se identificó la sesión. Vuelve a entrar.')
      return
    }
    setLiberandoId(id)
    setError(null)
    setOkMsg(null)
    try {
      const res = await fetch('/api/control-escolar/tramites/liberar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tramiteId: id, liberadoPor: usuarioNombre }),
      })
      const data = (await res.json()) as { ok?: boolean; mensaje?: string }
      if (!data.ok) {
        throw new Error(data.mensaje || 'No se pudo liberar')
      }
      setOkMsg(data.mensaje ?? 'Liberado')
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al liberar')
    } finally {
      setLiberandoId(null)
    }
  }

  return (
    <div className="ce-admin">
      <p className="ce-admin-lead">
        Documentos pagados en Administrativo (constancia, cotejo, credencial,
        reimpresión de boleta). Aparecen pendientes según el nivel del alumno.
        Al elaborarlos, libéralos aquí.
      </p>

      <div className="ce-panel-stats">
        {DASHBOARDS.map((d) => {
          const n = pendientes.filter((f) => f.dashboard === d).length
          return (
            <button
              key={d}
              type="button"
              className={`ce-panel-stat ${dash === d ? 'is-active is-warn' : ''}`}
              onClick={() => {
                setDash(d)
                setEstado('pendiente')
              }}
            >
              <span className="ce-panel-stat__label">{etiquetaDashboardTramite(d)}</span>
              <strong className="ce-panel-stat__value">{n}</strong>
            </button>
          )
        })}
        <button
          type="button"
          className={`ce-panel-stat ${dash === 'todos' && estado === 'pendiente' ? 'is-active is-warn' : ''}`}
          onClick={() => {
            setDash('todos')
            setEstado('pendiente')
          }}
        >
          <span className="ce-panel-stat__label">Pendientes</span>
          <strong className="ce-panel-stat__value">{pendientes.length}</strong>
        </button>
        <button
          type="button"
          className={`ce-panel-stat ${estado === 'liberado' ? 'is-active is-ok' : ''}`}
          onClick={() => setEstado('liberado')}
        >
          <span className="ce-panel-stat__label">Liberados</span>
          <strong className="ce-panel-stat__value">{liberados.length}</strong>
        </button>
      </div>

      <div className="ce-panel-filters">
        <label className="ce-panel-field">
          <span>Dashboard</span>
          <select
            value={dash}
            onChange={(e) => setDash(e.target.value as DashFiltro)}
          >
            <option value="todos">Kinder, Primaria y Secundaria</option>
            {DASHBOARDS.map((d) => (
              <option key={d} value={d}>
                {etiquetaDashboardTramite(d)}
              </option>
            ))}
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
              placeholder="Alumno, folio o concepto…"
            />
          </span>
        </label>
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
      </div>

      {okMsg && (
        <p className="ce-msg ce-msg--ok" role="status">
          {okMsg}
        </p>
      )}
      {error && (
        <p className="ce-msg ce-msg--err" role="alert">
          {error}
        </p>
      )}

      <div className="ce-panel-body ce-admin-body">
        {cargando && (
          <p className="ce-panel-empty">
            <Loader2 size={18} className="ce-spin" aria-hidden />
            Cargando trámites…
          </p>
        )}
        {!cargando && filas.length === 0 && (
          <p className="ce-panel-empty">
            {estado === 'pendiente'
              ? 'No hay trámites pendientes en este dashboard.'
              : 'No hay trámites liberados con estos filtros.'}
          </p>
        )}
        {!cargando && filas.length > 0 && (
          <div className="ce-panel-table-wrap">
            <table className="ce-panel-table">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Documento</th>
                  <th>Nivel</th>
                  <th>Pago</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div className="ce-panel-alumno">
                        <strong>{f.nombre}</strong>
                        <span>Ref. {f.alumnoRef}</span>
                      </div>
                    </td>
                    <td>
                      <div className="ce-panel-nivel">
                        <span>{f.conceptoNombre}</span>
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
                    <td className="ce-panel-fecha">
                      Folio {f.pagoFolio ?? '—'}
                      <br />
                      {f.estado === 'pendiente'
                        ? formatearFecha(f.creadoAt)
                        : formatearFecha(f.liberadoAt)}
                      {f.liberadoPor && (
                        <>
                          <br />
                          <span className="ce-panel-meta">por {f.liberadoPor}</span>
                        </>
                      )}
                    </td>
                    <td>
                      {f.estado === 'pendiente' ? (
                        <button
                          type="button"
                          className="ce-panel-row-btn"
                          disabled={liberandoId === f.id}
                          onClick={() => void liberar(f.id)}
                        >
                          {liberandoId === f.id ? (
                            <Loader2 size={16} className="ce-spin" />
                          ) : (
                            <Stamp size={15} aria-hidden />
                          )}
                          Liberar
                        </button>
                      ) : (
                        <span className="ce-panel-badge ce-panel-badge--ok">
                          <CheckCircle2 size={13} aria-hidden />
                          Liberado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
