'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarRange, ChevronDown, Clock, FileSpreadsheet, Loader2, Search, Timer } from 'lucide-react'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import {
  DIAS_TALLER,
  NIVELES_TALLER,
  etiquetaNivel,
  textoDuracion,
  textoIncidencia,
  type ReporteHorasMaestros,
  type TallerAsignacion,
} from '@/lib/talleres/talleresTypes'

type Props = {
  asignaciones: TallerAsignacion[]
  onError: (msg: string) => void
}

function hoyMx(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
}

function fechaChip(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  const dia = d.getUTCDay()
  const corto = dia === 0 ? 'D' : DIAS_TALLER.find((x) => x.valor === dia)?.etiqueta.slice(0, 3) ?? ''
  return `${corto} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function fechaLarga(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-MX', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function horaCorta(h: string | null): string {
  if (!h) return ''
  const [hh, mm] = h.split(':').map(Number)
  const sufijo = hh >= 12 ? 'pm' : 'am'
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${sufijo}`
}

function horasDecimal(min: number): string {
  return (min / 60).toFixed(2)
}

export default function ReportesView({ asignaciones, onError }: Props) {
  const hoy = hoyMx()
  const [nivel, setNivel] = useState<number | null>(null)
  const [desde, setDesde] = useState(`${hoy.slice(0, 8)}01`)
  const [hasta, setHasta] = useState(hoy)
  const [reporte, setReporte] = useState<ReporteHorasMaestros | null>(null)
  const [cargando, setCargando] = useState(false)
  const [descargando, setDescargando] = useState(false)

  const nivelesConTalleres = useMemo(() => {
    const s = new Set<number>()
    for (const a of asignaciones) for (const n of a.niveles) s.add(n)
    return s
  }, [asignaciones])

  const query = (extra = '') =>
    `/api/talleres/reportes?nivel=${nivel}&desde=${desde}&hasta=${hasta}${extra}`

  const rangoInvalido = !desde || !hasta || desde > hasta

  const generar = async () => {
    if (nivel == null || rangoInvalido) return
    setCargando(true)
    try {
      const res = await fetch(query(), { headers: portalSessionFetchHeaders(), cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo generar el reporte.')
      setReporte(json as ReporteHorasMaestros)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error al generar el reporte')
    } finally {
      setCargando(false)
    }
  }

  const descargar = async () => {
    if (!reporte) return
    setDescargando(true)
    try {
      const url = `/api/talleres/reportes?nivel=${reporte.nivel}&desde=${reporte.desde}&hasta=${reporte.hasta}&formato=xlsx`
      const res = await fetch(url, { headers: portalSessionFetchHeaders(), cache: 'no-store' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'No se pudo generar el Excel.')
      }
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `Horas maestros talleres ${etiquetaNivel(reporte.nivel)} ${reporte.desde} a ${reporte.hasta}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Error al descargar')
    } finally {
      setDescargando(false)
    }
  }

  const vigente =
    reporte && reporte.nivel === nivel && reporte.desde === desde && reporte.hasta === hasta ? reporte : null
  const totalDias = reporte ? new Set(reporte.maestros.flatMap((m) => m.dias)).size : 0

  return (
    <section className="tl-panel tl-rep">
      <header className="tl-rep-head">
        <div className="tl-min0">
          <h2 className="tl-rep-titulo">
            <Clock size={18} aria-hidden /> Horas impartidas por maestro
          </h2>
          <p className="tl-rep-lead">
            Para el pago por hora: suma las clases de cada maestro en el periodo. Cuentan los días con asistencia o con
            horario del maestro registrado (sin las clases a las que no asistió); la duración sale del horario del grupo.
          </p>
        </div>
      </header>

      <div className="tl-rep-filtros">
        <div className="tl-field">
          <span className="tl-field-label">1. Nivel</span>
          <div className="tl-chips" role="radiogroup" aria-label="Nivel">
            {NIVELES_TALLER.map((n) => (
              <button
                key={n.valor}
                type="button"
                role="radio"
                aria-checked={nivel === n.valor}
                className="tl-chip"
                data-activo={nivel === n.valor || undefined}
                disabled={!nivelesConTalleres.has(n.valor)}
                onClick={() => setNivel(n.valor)}
              >
                {n.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="tl-rep-fechas">
          <label className="tl-field">
            <span className="tl-field-label">2. Desde</span>
            <input type="date" className="tl-input" value={desde} max={hasta || undefined}
              onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="tl-field">
            <span className="tl-field-label">Hasta</span>
            <input type="date" className="tl-input" value={hasta} min={desde || undefined}
              onChange={(e) => setHasta(e.target.value)} />
          </label>
          <button type="button" className="tl-btn tl-btn-primary tl-rep-generar"
            disabled={nivel == null || rangoInvalido || cargando} onClick={() => void generar()}>
            {cargando ? <Loader2 size={16} className="tl-spin" aria-hidden /> : <Search size={16} aria-hidden />}
            Generar reporte
          </button>
        </div>
        {nivel == null ? <p className="tl-field-help">Selecciona primero el nivel.</p> : null}
        {rangoInvalido ? <p className="tl-rep-error">La fecha «desde» no puede ser posterior a «hasta».</p> : null}
      </div>

      {reporte ? (
        <div className="tl-rep-res" data-desactualizado={!vigente || undefined}>
          <div className="tl-rep-res-head">
            <p className="tl-rep-periodo">
              <CalendarRange size={16} aria-hidden />
              <span>
                <strong>{etiquetaNivel(reporte.nivel)}</strong> · {fechaLarga(reporte.desde)} al {fechaLarga(reporte.hasta)}
                {!vigente ? <em> (cambiaste los filtros: vuelve a generar)</em> : null}
              </span>
            </p>
            <button type="button" className="tl-btn tl-rep-excel" disabled={descargando || !reporte.maestros.length}
              onClick={() => void descargar()}>
              {descargando ? <Loader2 size={16} className="tl-spin" aria-hidden /> : <FileSpreadsheet size={16} aria-hidden />}
              Descargar Excel
            </button>
          </div>

          <dl className="tl-rep-stats">
            <div><dt>Maestros</dt><dd>{reporte.maestros.length}</dd></div>
            <div><dt>Días con clase</dt><dd>{totalDias}</dd></div>
            <div><dt>Sesiones</dt><dd>{reporte.total_sesiones}</dd></div>
            <div data-destacado><dt>Total horas</dt><dd>{horasDecimal(reporte.total_minutos)}</dd></div>
            {reporte.total_faltas_maestro ? (
              <div data-ambar>
                <dt>Maestro no asistió</dt>
                <dd>{reporte.total_faltas_maestro}</dd>
              </div>
            ) : null}
            {reporte.total_incidencias ? (
              <div data-ambar>
                <dt>Llegó tarde / salió antes</dt>
                <dd>{reporte.total_incidencias}</dd>
              </div>
            ) : null}
          </dl>

          {reporte.total_faltas_maestro ? (
            <p className="tl-rep-info">
              <Timer size={16} aria-hidden />
              {reporte.total_faltas_maestro === 1
                ? 'En 1 clase el maestro no asistió; esa clase no suma horas.'
                : `En ${reporte.total_faltas_maestro} clases el maestro no asistió; esas clases no suman horas.`}
            </p>
          ) : null}
          {reporte.total_incidencias ? (
            <p className="tl-rep-info">
              <Timer size={16} aria-hidden />
              {reporte.total_incidencias === 1 ? 'Hubo 1 clase' : `Hubo ${reporte.total_incidencias} clases`} en que el
              maestro llegó tarde o salió antes ({textoDuracion(reporte.total_minutos_no_impartidos)} en total). Es
              informativo: no se descuenta de las horas.
            </p>
          ) : null}

          {reporte.sin_horario > 0 ? (
            <p className="tl-rep-alerta">
              <AlertTriangle size={16} aria-hidden />
              {reporte.sin_horario === 1
                ? 'Hay 1 asistencia guardada en un día sin horario para ese grupo; no suma horas. Revisa el horario del grupo.'
                : `Hay ${reporte.sin_horario} asistencias guardadas en días sin horario para su grupo; no suman horas. Revisa los horarios.`}
            </p>
          ) : null}

          {!reporte.maestros.length ? (
            <p className="tl-empty">No hay asistencias guardadas de {etiquetaNivel(reporte.nivel)} en este periodo.</p>
          ) : (
            <ul className="tl-rep-lista">
              {reporte.maestros.map((m) => (
                <li key={m.maestro_id}>
                  <details className="tl-rep-maestro">
                    <summary>
                      <span className="tl-rep-nombre">
                        <strong>{m.nombre}</strong>
                        <span className="tl-rep-meta">
                          {m.dias.length} {m.dias.length === 1 ? 'día' : 'días'} · {m.sesiones}{' '}
                          {m.sesiones === 1 ? 'sesión' : 'sesiones'} · {m.grupos.length}{' '}
                          {m.grupos.length === 1 ? 'grupo' : 'grupos'}
                        </span>
                        {m.faltas_maestro ? (
                          <span className="tl-rep-inc" data-falta>
                            <Timer size={12} aria-hidden /> No asistió a {m.faltas_maestro}{' '}
                            {m.faltas_maestro === 1 ? 'clase' : 'clases'}
                          </span>
                        ) : null}
                        {m.incidencias ? (
                          <span className="tl-rep-inc">
                            <Timer size={12} aria-hidden /> {m.incidencias}{' '}
                            {m.incidencias === 1 ? 'incidencia' : 'incidencias'} · {textoDuracion(m.minutos_no_impartidos)}
                          </span>
                        ) : null}
                      </span>
                      <span className="tl-rep-horas">
                        <b>{horasDecimal(m.minutos)} h</b>
                        <small>{textoDuracion(m.minutos)}</small>
                      </span>
                      <ChevronDown size={18} className="tl-rep-chevron" aria-hidden />
                      <span className="tl-rep-dias" aria-label="Días de clase">
                        {m.dias.map((d) => (
                          <span key={d} className="tl-rep-dia">{fechaChip(d)}</span>
                        ))}
                      </span>
                    </summary>

                    <div className="tl-rep-detalle">
                      {m.grupos.map((g) => {
                        const otros = g.niveles.filter((n) => n !== reporte.nivel)
                        return (
                          <div key={g.asignacion_id} className="tl-rep-grupo">
                            <p className="tl-rep-grupo-titulo">
                              <span className="tl-dot" style={{ background: g.color }} aria-hidden />
                              <span className="tl-min0">
                                {g.taller}
                                {otros.length ? (
                                  <span className="tl-rep-compartido">
                                    Compartido con {otros.map(etiquetaNivel).join(' y ')}
                                  </span>
                                ) : null}
                              </span>
                              <b>{textoDuracion(g.minutos)}</b>
                            </p>
                            <div className="tl-table-wrap">
                              <table className="tl-rep-tabla">
                                <thead>
                                  <tr><th>Fecha</th><th>Horario</th><th>Horas</th><th>Alumnos</th><th>Maestro</th></tr>
                                </thead>
                                <tbody>
                                  {g.sesiones.map((s) => (
                                    <tr key={s.fecha} data-sin-horario={!s.hora_inicio || undefined}>
                                      <td>{fechaChip(s.fecha)}</td>
                                      <td>
                                        {s.hora_inicio ? `${horaCorta(s.hora_inicio)} – ${horaCorta(s.hora_fin)}` : 'Sin horario'}
                                      </td>
                                      <td>{horasDecimal(s.minutos)}</td>
                                      <td>{s.alumnos ?? '—'}</td>
                                      <td>
                                        {s.incidencia && s.hora_inicio && s.hora_fin ? (
                                          <span className="tl-rep-inc" data-falta={s.incidencia.falto || undefined} title={[s.incidencia.motivo, s.incidencia.nota].filter(Boolean).join(' · ') || undefined}>
                                            {textoIncidencia(s.hora_inicio, s.hora_fin, s.incidencia)}
                                          </span>
                                        ) : (
                                          <span className="tl-rep-ok">A tiempo</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="tl-empty tl-rep-vacio">
          Elige el nivel y el periodo, luego pulsa «Generar reporte». Podrás descargarlo en Excel listo para dirección y
          contabilidad.
        </p>
      )}
    </section>
  )
}
