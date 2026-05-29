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

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (secreto.trim()) headers['x-migracion-secret'] = secreto.trim()

      const res = await fetch('/api/migracion-tablas', {
        method: 'POST',
        headers,
        body: JSON.stringify({ modo, tablas: [...seleccion] }),
      })
      const data = (await res.json()) as ResultadoMigracionTablas & { error?: string }
      if (!res.ok) throw new Error(data.error ?? res.statusText)
      setResultado(data)
      if (!data.ok) {
        setError(data.erroresGlobales.join(' · ') || 'Migración con errores parciales')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al migrar')
    } finally {
      setCargando(false)
    }
  }, [modo, secreto, seleccion])

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

      <button
        type="button"
        className="migracion-alumno-btn"
        disabled={cargando || config?.listo === false || seleccion.size === 0}
        onClick={migrar}
      >
        {cargando ? (
          <>
            <Loader2 className="migracion-alumno-spin" size={18} aria-hidden />
            Migrando… (puede tardar varios minutos)
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
