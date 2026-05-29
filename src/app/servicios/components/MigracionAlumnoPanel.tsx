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
import type {
  ResultadoTablaVerificacion,
  ResultadoVerificacionEspejo,
} from '@/lib/migracionTablasVerificacion'

interface EstadoConfig {
  listo: boolean
  requiereSecreto: boolean
  mysql: { host: string; database: string; port: number } | null
}

type EstadoFilaProgreso =
  | 'pendiente'
  | 'activa'
  | 'ok'
  | 'omitida'
  | 'error'
  | 'discordancia'

type TipoOperacion = 'migrar' | 'verificar'

interface ProgresoMigracion {
  tipo: TipoOperacion
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
  const [operacion, setOperacion] = useState<TipoOperacion | null>(null)
  const [progreso, setProgreso] = useState<ProgresoMigracion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoMigracionTablas | null>(null)
  const [resultadoVerificacion, setResultadoVerificacion] =
    useState<ResultadoVerificacionEspejo | null>(null)

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
    setOperacion('migrar')
    setError(null)
    setResultado(null)
    setResultadoVerificacion(null)

    const ordenadas = ordenarSeleccion(seleccion)
    const total = ordenadas.length
    const estadosIniciales = Object.fromEntries(
      ordenadas.map((t) => [t.id, 'pendiente' as EstadoFilaProgreso])
    ) as Record<string, EstadoFilaProgreso>

    setProgreso({
      tipo: 'migrar',
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
      setOperacion(null)
      setProgreso(null)
    }
  }, [modo, secreto, seleccion])

  const verificar = useCallback(async () => {
    if (seleccion.size === 0) {
      setError('Selecciona al menos una tabla.')
      return
    }

    if (
      !window.confirm(
        `Verificar espejo de ${seleccion.size} tabla(s).\n\nCompara MySQL (adaptado) vs Supabase: conteos, PKs faltantes/sobrantes y filas con contenido distinto.\n\nSe ejecutará en el servidor (Vercel). ¿Continuar?`
      )
    ) {
      return
    }

    setCargando(true)
    setOperacion('verificar')
    setError(null)
    setResultado(null)
    setResultadoVerificacion(null)

    const ordenadas = ordenarSeleccion(seleccion)
    const total = ordenadas.length
    const estadosIniciales = Object.fromEntries(
      ordenadas.map((t) => [t.id, 'pendiente' as EstadoFilaProgreso])
    ) as Record<string, EstadoFilaProgreso>

    setProgreso({
      tipo: 'verificar',
      total,
      completadas: 0,
      tablaActual: ordenadas[0]?.id ?? null,
      tablaActualEtiqueta: ordenadas[0]?.etiqueta ?? null,
      filas: estadosIniciales,
    })

    const inicio = Date.now()
    const tablasAcumuladas: ResultadoTablaVerificacion[] = []
    const erroresGlobales: string[] = []
    let mysqlMeta: ResultadoVerificacionEspejo['mysql'] | null = null

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

        const res = await fetch('/api/migracion-tablas/verificar', {
          method: 'POST',
          headers,
          body: JSON.stringify({ tablas: [def.id] }),
        })
        const data = (await res.json()) as ResultadoVerificacionEspejo & { error?: string }

        if (!res.ok) {
          throw new Error(data.error ?? res.statusText)
        }

        if (data.mysql) mysqlMeta = data.mysql
        if (data.tablas?.length) tablasAcumuladas.push(...data.tablas)
        if (data.erroresGlobales?.length) erroresGlobales.push(...data.erroresGlobales)

        const fila = data.tablas?.[0]
        let estadoFila: EstadoFilaProgreso = 'ok'
        if (fila?.estado === 'error') estadoFila = 'error'
        else if (fila?.estado === 'omitida') estadoFila = 'omitida'
        else if (fila?.estado === 'discordancia') estadoFila = 'discordancia'

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

      const conDiscordancia = tablasAcumuladas.some((t) => t.estado === 'discordancia')
      const conError = tablasAcumuladas.some((t) => t.estado === 'error')

      const resultadoFinal: ResultadoVerificacionEspejo = {
        ok: !conDiscordancia && !conError && erroresGlobales.length === 0,
        duracionMs: Date.now() - inicio,
        mysql: mysqlMeta ?? { host: '—', database: '—', port: 3306 },
        tablas: tablasAcumuladas,
        erroresGlobales,
      }

      setResultadoVerificacion(resultadoFinal)
      if (!resultadoFinal.ok) {
        setError(
          conDiscordancia
            ? 'Verificación terminada con discordancias entre MySQL y Supabase'
            : erroresGlobales.join(' · ') || 'Verificación con errores parciales'
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al verificar')
    } finally {
      setCargando(false)
      setOperacion(null)
      setProgreso(null)
    }
  }, [secreto, seleccion])

  const porcentajeProgreso = useMemo(() => {
    if (!progreso || progreso.total === 0) return 0
    return Math.round((progreso.completadas / progreso.total) * 100)
  }, [progreso])

  const totalesVerificacion = useMemo(() => {
    if (!resultadoVerificacion) return null
    return resultadoVerificacion.tablas.reduce(
      (acc, t) => ({
        mysql: acc.mysql + t.mysqlCount,
        supabase: acc.supabase + t.supabaseCount,
        faltan: acc.faltan + t.faltanEnSupabase,
        sobran: acc.sobran + t.sobranEnSupabase,
        distintas: acc.distintas + t.contenidoDistinto,
      }),
      { mysql: 0, supabase: 0, faltan: 0, sobran: 0, distintas: 0 }
    )
  }, [resultadoVerificacion])

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
        hacia Supabase. Se ejecuta en el servidor (Vercel), no en tu PC. Tras migrar en modo espejo,
        usa <strong>Verificar espejo</strong> para auditar conteos, PKs y contenido de negocio
        (ignora columnas <code>*_actualizacion</code> que Postgres sobrescribe con triggers).
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
                  {progreso.tipo === 'verificar' ? 'Verificando' : 'Migrando'}{' '}
                  <strong>{progreso.tablaActualEtiqueta}</strong>…
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
            aria-label={progreso.tipo === 'verificar' ? 'Avance de verificación' : 'Avance de migración'}
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
                  {est === 'discordancia' && <span aria-hidden>≠</span>}
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

      <div className="migracion-alumno-acciones">
        <button
          type="button"
          className="migracion-alumno-btn"
          disabled={cargando || config?.listo === false || seleccion.size === 0}
          onClick={migrar}
        >
          {cargando && operacion === 'migrar' ? (
            <>
              <Loader2 className="migracion-alumno-spin" size={18} aria-hidden />
              Migrando…
            </>
          ) : (
            `Migrar ${seleccion.size} tabla(s)`
          )}
        </button>

        <button
          type="button"
          className="migracion-alumno-btn migracion-alumno-btn--secundario"
          disabled={cargando || config?.listo === false || seleccion.size === 0}
          onClick={verificar}
        >
          {cargando && operacion === 'verificar' ? (
            <>
              <Loader2 className="migracion-alumno-spin" size={18} aria-hidden />
              Verificando…
            </>
          ) : (
            `Verificar espejo (${seleccion.size})`
          )}
        </button>
      </div>

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

      {resultadoVerificacion && (
        <div className="migracion-alumno-resultado migracion-alumno-resultado--verificacion">
          <p
            className={
              resultadoVerificacion.ok ? 'migracion-alumno-ok' : 'migracion-alumno-alerta'
            }
            role="status"
          >
            {resultadoVerificacion.ok
              ? 'Espejo verificado: MySQL y Supabase coinciden'
              : 'Verificación terminada con discordancias'}{' '}
            · {formatoDuracion(resultadoVerificacion.duracionMs)}
          </p>

          {totalesVerificacion && (
            <p className="migracion-alumno-resumen">
              MySQL esperado: <strong>{totalesVerificacion.mysql}</strong> · Supabase:{' '}
              <strong>{totalesVerificacion.supabase}</strong> · Faltan en Supabase:{' '}
              <strong>{totalesVerificacion.faltan}</strong> · Sobran en Supabase:{' '}
              <strong>{totalesVerificacion.sobran}</strong> · Contenido distinto:{' '}
              <strong>{totalesVerificacion.distintas}</strong>
            </p>
          )}

          <div className="migracion-alumno-tabla-wrap">
            <table className="migracion-alumno-tabla">
              <thead>
                <tr>
                  <th>Tabla</th>
                  <th>Estado</th>
                  <th>MySQL</th>
                  <th>Supabase</th>
                  <th>Faltan</th>
                  <th>Sobran</th>
                  <th>≠ Contenido</th>
                </tr>
              </thead>
              <tbody>
                {resultadoVerificacion.tablas.map((t: ResultadoTablaVerificacion) => (
                  <tr key={t.id} className={`migracion-alumno-tr--${t.estado}`}>
                    <td>
                      <strong>{t.etiqueta}</strong>
                      <span className="migracion-alumno-tabla-meta">{t.supabase}</span>
                    </td>
                    <td>
                      {t.estado === 'ok' && 'OK'}
                      {t.estado === 'discordancia' && 'Discordancia'}
                      {t.estado === 'omitida' && 'Omitida'}
                      {t.estado === 'error' && 'Error'}
                    </td>
                    <td>{t.mysqlCount}</td>
                    <td>{t.supabaseCount}</td>
                    <td>{t.faltanEnSupabase}</td>
                    <td>{t.sobranEnSupabase}</td>
                    <td>{t.contenidoDistinto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {resultadoVerificacion.tablas.some(
            (t) =>
              t.mensaje ||
              t.muestraFaltan.length > 0 ||
              t.muestraSobran.length > 0 ||
              t.muestraDistintas.length > 0
          ) && (
            <ul className="migracion-alumno-detalles">
              {resultadoVerificacion.tablas.map((t) => {
                const partes: string[] = []
                if (t.mensaje) partes.push(t.mensaje)
                if (t.muestraFaltan.length > 0) {
                  partes.push(
                    `PK faltan (muestra): ${t.muestraFaltan.join(', ')}${t.faltanEnSupabase > t.muestraFaltan.length ? '…' : ''}`
                  )
                }
                if (t.muestraSobran.length > 0) {
                  partes.push(
                    `PK sobran (muestra): ${t.muestraSobran.join(', ')}${t.sobranEnSupabase > t.muestraSobran.length ? '…' : ''}`
                  )
                }
                for (const d of t.muestraDistintas) {
                  partes.push(`PK ${d.pk}: campos distintos → ${d.campos.join(', ')}`)
                }
                if (partes.length === 0) return null
                return (
                  <li key={t.id}>
                    <strong>{t.etiqueta}:</strong> {partes.join(' · ')}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
