'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface EstadoConfig {
  listo: boolean
  requiereSecreto: boolean
  mysql: { host: string; database: string; port: number } | null
}

export default function MigracionAlumnoPanel() {
  const [config, setConfig] = useState<EstadoConfig | null>(null)
  const [secreto, setSecreto] = useState('')
  const [vaciar, setVaciar] = useState(true)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/migracion-alumno')
      .then((r) => r.json())
      .then((d) => setConfig(d as EstadoConfig))
      .catch(() => setConfig({ listo: false, requiereSecreto: false, mysql: null }))
  }, [])

  const migrar = useCallback(async () => {
    if (
      !window.confirm(
        vaciar
          ? 'Se vaciarán alumno, alumno_detalles, alumno_familiar y alumno_contacto en Supabase y se copiarán desde MySQL. ¿Continuar?'
          : 'Se agregarán/actualizarán filas desde MySQL sin vaciar antes. ¿Continuar?'
      )
    ) {
      return
    }

    setCargando(true)
    setError(null)

    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (secreto.trim()) headers['x-migracion-secret'] = secreto.trim()

      const res = await fetch('/api/migracion-alumno', {
        method: 'POST',
        headers,
        body: JSON.stringify({ vaciarDestino: vaciar }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? res.statusText)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al migrar')
    } finally {
      setCargando(false)
    }
  }, [secreto, vaciar])

  return (
    <section className="migracion-alumno" aria-label="Herramientas de migración">
      {config && !config.listo && (
        <p className="migracion-alumno-alerta" role="alert">
          Falta configuración MySQL (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD). En Vercel solo aplica si vas a migrar desde ahí.
        </p>
      )}

      {config?.requiereSecreto && (
        <label className="migracion-alumno-field">
          <span>Secreto de migración</span>
          <input
            type="password"
            value={secreto}
            onChange={(e) => setSecreto(e.target.value)}
            className="migracion-alumno-input"
            autoComplete="off"
          />
        </label>
      )}

      <label className="migracion-alumno-check">
        <input type="checkbox" checked={vaciar} onChange={(e) => setVaciar(e.target.checked)} />
        Vaciar tablas en Supabase antes de copiar
      </label>

      <button
        type="button"
        className="migracion-alumno-btn"
        disabled={cargando || config?.listo === false}
        onClick={migrar}
      >
        {cargando ? (
          <>
            <Loader2 className="migracion-alumno-spin" size={18} aria-hidden />
            Migrando…
          </>
        ) : (
          'Migración de tablas'
        )}
      </button>

      {error && (
        <p className="migracion-alumno-alerta" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
