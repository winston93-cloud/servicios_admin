'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  GRUPOS_MIGRACION,
  TABLAS_MIGRACION,
  type TablaMigracion,
} from '@/lib/migracionTablasManifest'
import type {
  ModoMigracion,
  ResultadoMigracionTablas,
  ResultadoTablaMigracion,
} from '@/lib/migracionTablasService'

interface EstadoConfig {
  listo: boolean
  requiereSecreto: boolean
  mysql: { host: string; database: string; port: number } | null
}

type EstadoFilaProgreso = 'pendiente' | 'activa' | 'ok' | 'omitida' | 'error'

interface ProgresoMigracion {
  total: number
  completadas: number
  tablaActual: string | null
  tablaActualEtiqueta: string | null
  filas: Record<string, EstadoFilaProgreso>
}

function ordenarSeleccion(ids: Set<string>): TablaMigracion[] {
  return TABLAS_MIGRACION.filter((t) => ids.has(t.id))
}

function formatoDuracion(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const s = Math.round(ms / 100) / 10
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`
}

export default function MigracionAlumnoPanel() {
  const [config, setConfig] = useState<EstadoConfig | null>(null)
  const [secreto, setSecreto] = useState('')
  const [modo, setModo] = useState<ModoMigracion>('espejo')
  const [seleccion, setSeleccion] = useState<Set<string>>(
    () => new Set(TABLAS_MIGRACION.map((t) => t.id))
  )
  const [cargando, setCargando] = useState(false)
  const [progreso, setProgreso] = useState<ProgresoMigracion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoMigracionTablas | null>(null)

  useEffect(() => {
    fetch('/api/migracion-tablas')
      .then((r) => r.json())
      .then((d) => setConfig(d as EstadoConfig))
      .catch(() => setConfig({ listo: false, requiereSecreto: false, mysql: null }))
  }, [])

  const porGrupo = useMemo(() => {
    const map = new Map<TablaMigracion['grupo'], TablaMigracion[]>()
    for (const t of TABLAS_MIGRACION) {
      const lista = map.get(t.grupo) ?? []
      lista.push(t)
      map.set(t.grupo, lista)
    }
    return map
  }, [])

  const toggleTabla = (id: string) => {
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleGrupo = (grupo: TablaMigracion['grupo']) => {
    const ids = TABLAS_MIGRACION.filter((t) => t.grupo === grupo).map((t) => t.id)
    setSeleccion((prev) => {
      const todos = ids.every((id) => prev.has(id))
      const next = new Set(prev)
      for (const id of ids) {
        if (todos) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const migrar = useCallback(async () => {
    if (seleccion.size === 0) {
      setError('Selecciona al menos una tabla.')
      return
    }

    const etiquetaModo =
      modo === 'espejo'
        ? 'modo espejo (insertar, actualizar y eliminar huérfanos para igualar phpMyAdmin)'
        : modo === 'solo_upsert'
          ? 'solo insertar/actualizar sin borrar huérfanos'
          : 'vaciar tablas en Supabase y copiar todo de nuevo'

    if (
      !window.confirm(
        `Migrar ${seleccion.size} tabla(s) en ${etiquetaModo}.\n\nSe ejecutará en el servidor (Vercel). ¿Continuar?`
      )
    ) {
      return
    }

    setCargando(true)
    setError(null)
    setResultado(null)

    const ordenadas = ordenarSeleccion(seleccion)
    const total = ordenadas.length
    const estadosIniciales = Object.fromEntries(
      ordenadas.map((t) => [t.id, 'pendiente' as EstadoFilaProgreso])
    ) as Record<string, EstadoFilaProgreso>

    setProgreso({
      total,
      completadas: 0,
      tablaActual: ordenadas[0]?.id ?? null,
      tablaActualEtiqueta: ordenadas[0]?.etiqueta ?? null,
      filas: estadosIniciales,
    })

    const inicio = Date.now()
    const tablasAcumuladas: ResultadoTablaMigracion[] = []
    const erroresGlobales: string[] = []
    let mysqlMeta: ResultadoMigracionTablas['mysql'] | null = null

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (secreto.trim()) headers['x-migracion-secret'] = secreto.trim()

      for (let i = 0; i < ordenadas.length; i++) {
        const def = ordenadas[i]
        setProgreso((prev) =>
          prev
            ? {
                ...prev,
                tablaActual: def.id,
                tablaActualEtiqueta: def.etiqueta,
                filas: { ...prev.filas, [def.id]: 'activa' },
              }
            : prev
        )

        const res = await fetch('/api/migracion-tablas', {
          method: 'POST',
          headers,
          body: JSON.stringify({ modo, tablas: [def.id] }),
        })
        const data = (await res.json()) as ResultadoMigracionTablas & { error?: string }

        if (!res.ok) {
          throw new Error(data.error ?? res.statusText)
        }

        if (data.mysql) mysqlMeta = data.mysql
        if (data.tablas?.length) tablasAcumuladas.push(...data.tablas)
        if (data.erroresGlobales?.length) erroresGlobales.push(...data.erroresGlobales)

        const fila = data.tablas?.[0]
        const estadoFila: EstadoFilaProgreso =
          fila?.estado === 'error' ? 'error' : fila?.estado === 'omitida' ? 'omitida' : 'ok'

        setProgreso((prev) =>
          prev
            ? {
                ...prev,
                completadas: i + 1,
                tablaActual: ordenadas[i + 1]?.id ?? null,
                tablaActualEtiqueta: ordenadas[i + 1]?.etiqueta ?? null,
                filas: { ...prev.filas, [def.id]: estadoFila },
              }
            : prev
        )
      }

      const resultadoFinal: ResultadoMigracionTablas = {
        ok: erroresGlobales.length === 0,
        duracionMs: Date.now() - inicio,
        modo,
        mysql: mysqlMeta ?? { host: '—', database: '—', port: 3306 },
        tablas: tablasAcumuladas,
        erroresGlobales,
      }

      setResultado(resultadoFinal)
      if (!resultadoFinal.ok) {
        setError(erroresGlobales.join(' · ') || 'Migración con errores parciales')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al migrar')
    } finally {
      setCargando(false)
      setProgreso(null)
    }
  }, [modo, secreto, seleccion])

  const porcentajeProgreso = useMemo(() => {
    if (!progreso || progreso.total === 0) return 0
    return Math.round((progreso.completadas / progreso.total) * 100)
  }, [progreso])

  const totales = useMemo(() => {
    if (!resultado) return null
    return resultado.tablas.reduce(
      (acc, t) => ({
        origen: acc.origen + t.origen,
        insertados: acc.insertados + t.insertados,
        actualizados: acc.actualizados + t.actualizados,
        sinCambios: acc.sinCambios + t.sinCambios,
        eliminados: acc.eliminados + t.eliminados,
      }),
      { origen: 0, insertados: 0, actualizados: 0, sinCambios: 0, eliminados: 0 }
    )
  }, [resultado])

  return (
    <section className="migracion-alumno" aria-label="Migración MySQL → Supabase">
      <p className="migracion-alumno-desc">
        Sincroniza tablas de <strong>phpMyAdmin</strong> ({config?.mysql?.database ?? 'winston_general'})
        hacia Supabase. Se ejecuta en el servidor (Vercel), no en tu PC.
      </p>

      {config?.mysql && (
        <p className="migracion-alumno-meta">
          Origen MySQL: <strong>{config.mysql.host}</strong> · puerto {config.mysql.port}
        </p>
      )}

      {config && !config.listo && (
        <p className="migracion-alumno-alerta" role="alert">
          Falta configuración MySQL en Vercel. Ve a{' '}
          <strong>Project → Settings → Environment Variables</strong> y agrega MYSQL_HOST,
          MYSQL_USER, MYSQL_PASSWORD y MYSQL_DATABASE. El servidor MySQL debe aceptar conexiones
          desde internet (no solo localhost).
        </p>
      )}

      {config?.requiereSecreto && (
        <label className="migracion-alumno-field">
          <span>Secreto de migración (MIGRACION_SECRET)</span>
          <input
            type="password"
            value={secreto}
            onChange={(e) => setSecreto(e.target.value)}
            className="migracion-alumno-input"
            autoComplete="off"
          />
        </label>
      )}

      <fieldset className="migracion-alumno-modo">
        <legend>Modo de sincronización</legend>
        <label className="migracion-alumno-radio">
          <input
            type="radio"
            name="modo-migracion"
            checked={modo === 'espejo'}
            onChange={() => setModo('espejo')}
          />
          <span>
            <strong>Espejo</strong> — inserta, actualiza y elimina en Supabase lo que no esté en
            MySQL (recomendado para quedar idéntico)
          </span>
        </label>
        <label className="migracion-alumno-radio">
          <input
            type="radio"
            name="modo-migracion"
            checked={modo === 'solo_upsert'}
            onChange={() => setModo('solo_upsert')}
          />
          <span>
            <strong>Solo upsert</strong> — inserta o actualiza; no borra filas extra en Supabase
          </span>
        </label>
        <label className="migracion-alumno-radio">
          <input
            type="radio"
            name="modo-migracion"
            checked={modo === 'vaciar_copiar'}
            onChange={() => setModo('vaciar_copiar')}
          />
          <span>
            <strong>Vaciar y copiar</strong> — borra la tabla en Supabase y vuelve a cargar todo
          </span>
        </label>
      </fieldset>

      <div className="migracion-alumno-tablas">
        <div className="migracion-alumno-tablas-head">
          <h2 className="migracion-alumno-subtitulo">Tablas a migrar</h2>
          <button
            type="button"
            className="migracion-alumno-link-btn"
            onClick={() => setSeleccion(new Set(TABLAS_MIGRACION.map((t) => t.id)))}
          >
            Todas
          </button>
          <button
            type="button"
            className="migracion-alumno-link-btn"
            onClick={() => setSeleccion(new Set())}
          >
            Ninguna
          </button>
        </div>

        {([...porGrupo.entries()] as [TablaMigracion['grupo'], TablaMigracion[]][]).map(
          ([grupo, tablas]) => (
            <div key={grupo} className="migracion-alumno-grupo">
              <label className="migracion-alumno-grupo-label">
                <input
                  type="checkbox"
                  checked={tablas.every((t) => seleccion.has(t.id))}
                  onChange={() => toggleGrupo(grupo)}
                />
                {GRUPOS_MIGRACION[grupo]}
              </label>
              <ul className="migracion-alumno-grupo-lista">
                {tablas.map((t) => (
                  <li key={t.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={seleccion.has(t.id)}
                        onChange={() => toggleTabla(t.id)}
                      />
                      {t.etiqueta}
                      <span className="migracion-alumno-tabla-meta">
                        {t.mysql} → {t.supabase}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>

      {cargando && progreso && (
        <div
          className="migracion-alumno-progreso"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="migracion-alumno-progreso-cabecera">
            <span className="migracion-alumno-progreso-texto">
              {progreso.tablaActualEtiqueta ? (
                <>
                  Migrando <strong>{progreso.tablaActualEtiqueta}</strong>…
                </>
              ) : (
                'Finalizando…'
              )}
            </span>
            <span className="migracion-alumno-progreso-contador">
              {progreso.completadas} / {progreso.total} ({porcentajeProgreso}%)
            </span>
          </div>
          <div
            className="migracion-alumno-progreso-bar"
            role="progressbar"
            aria-valuenow={porcentajeProgreso}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Avance de migración"
          >
            <div
              className="migracion-alumno-progreso-fill"
              style={{ width: `${porcentajeProgreso}%` }}
            />
          </div>
          <ul className="migracion-alumno-progreso-lista">
            {ordenarSeleccion(seleccion).map((t) => {
              const est = progreso.filas[t.id] ?? 'pendiente'
              return (
                <li
                  key={t.id}
                  className={`migracion-alumno-progreso-item migracion-alumno-progreso-item--${est}`}
                >
                  {est === 'activa' && (
                    <Loader2 className="migracion-alumno-spin" size={14} aria-hidden />
                  )}
                  {est === 'ok' && <span aria-hidden>✓</span>}
                  {est === 'omitida' && <span aria-hidden>−</span>}
                  {est === 'error' && <span aria-hidden>✗</span>}
                  {est === 'pendiente' && <span className="migracion-alumno-progreso-punto" aria-hidden />}
                  {t.etiqueta}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="migracion-alumno-btn"
        disabled={cargando || config?.listo === false || seleccion.size === 0}
        onClick={migrar}
      >
        {cargando ? (
          <>
            <Loader2 className="migracion-alumno-spin" size={18} aria-hidden />
            Migrando…
          </>
        ) : (
          `Migrar ${seleccion.size} tabla(s)`
        )}
      </button>

      {error && (
        <p className="migracion-alumno-alerta" role="alert">
          {error}
        </p>
      )}

      {resultado && (
        <div className="migracion-alumno-resultado">
          <p className="migracion-alumno-ok" role="status">
            {resultado.ok ? 'Migración completada' : 'Migración terminada con errores'} ·{' '}
            {formatoDuracion(resultado.duracionMs)} · modo {resultado.modo}
          </p>

          {totales && (
            <p className="migracion-alumno-resumen">
              Origen: <strong>{totales.origen}</strong> filas · Insertados:{' '}
              <strong>{totales.insertados}</strong> · Actualizados:{' '}
              <strong>{totales.actualizados}</strong> · Sin cambios:{' '}
              <strong>{totales.sinCambios}</strong> · Eliminados:{' '}
              <strong>{totales.eliminados}</strong>
            </p>
          )}

          <div className="migracion-alumno-tabla-wrap">
            <table className="migracion-alumno-tabla">
              <thead>
                <tr>
                  <th>Tabla</th>
                  <th>Estado</th>
                  <th>MySQL</th>
                  <th>+ Insert</th>
                  <th>↻ Update</th>
                  <th>= Igual</th>
                  <th>− Delete</th>
                </tr>
              </thead>
              <tbody>
                {resultado.tablas.map((t: ResultadoTablaMigracion) => (
                  <tr key={t.id} className={`migracion-alumno-tr--${t.estado}`}>
                    <td>
                      <strong>{t.etiqueta}</strong>
                      <span className="migracion-alumno-tabla-meta">{t.supabase}</span>
                    </td>
                    <td>
                      {t.estado === 'ok' && 'OK'}
                      {t.estado === 'omitida' && 'Omitida'}
                      {t.estado === 'error' && 'Error'}
                    </td>
                    <td>{t.origen}</td>
                    <td>{t.insertados}</td>
                    <td>{t.actualizados}</td>
                    <td>{t.sinCambios}</td>
                    <td>{t.eliminados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {resultado.tablas.some((t) => t.mensaje) && (
            <ul className="migracion-alumno-detalles">
              {resultado.tablas
                .filter((t) => t.mensaje)
                .map((t) => (
                  <li key={t.id}>
                    <strong>{t.etiqueta}:</strong> {t.mensaje}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
