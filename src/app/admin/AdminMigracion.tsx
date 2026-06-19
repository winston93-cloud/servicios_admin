'use client'

import { useState, useEffect, useCallback } from 'react'

interface PreviewData {
  totalMySQL: number
  alreadyMigrated: number
}

interface MigrationResult {
  inserted: number
  skipped: number
  errors: string[]
}

export default function AdminMigracion() {
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(true)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchPreview = useCallback(async () => {
    setLoadingPreview(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/admin/migrate-legacy')
      const data = await res.json()
      if (data.ok) setPreview(data)
      else setErrorMsg(data.error ?? 'Error al consultar')
    } catch {
      setErrorMsg('No se pudo conectar con el servidor')
    } finally {
      setLoadingPreview(false)
    }
  }, [])

  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  const handleMigrate = async () => {
    if (!confirm('¿Confirmas la migración de los registros pendientes?')) return
    setRunning(true)
    setResult(null)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/admin/migrate-legacy', {
        method: 'POST',
        headers: {
          'x-cron-secret': process.env.NEXT_PUBLIC_CRON_SECRET ?? 'agendaw-cron-2026',
        },
      })
      const data = await res.json()
      if (data.ok) {
        setResult(data)
        fetchPreview()
      } else {
        setErrorMsg(data.error ?? 'Error en la migración')
      }
    } catch {
      setErrorMsg('Error de red al migrar')
    } finally {
      setRunning(false)
    }
  }

  const pendingCount = preview ? preview.totalMySQL - preview.alreadyMigrated : 0

  return (
    <div className="migracion-container">
      <div className="migracion-header">
        <span className="migracion-icon">🗃️</span>
        <div>
          <h3 className="migracion-title">Migración desde sistema anterior</h3>
          <p className="migracion-subtitle">
            Importa alumnos pendientes (ciclos 2025-2026 y 2026-2027) que aún no tienen número de pase.
          </p>
        </div>
      </div>

      {/* Panel de estadísticas */}
      <div className="migracion-stats">
        {loadingPreview ? (
          <div className="migracion-loading">Consultando sistema anterior…</div>
        ) : errorMsg && !preview ? (
          <div className="migracion-error">{errorMsg}</div>
        ) : preview ? (
          <>
            <div className="migracion-stat">
              <span className="migracion-stat-num">{preview.totalMySQL}</span>
              <span className="migracion-stat-label">Pendientes en sistema anterior</span>
            </div>
            <div className="migracion-stat-divider" />
            <div className="migracion-stat">
              <span className="migracion-stat-num migracion-stat-green">{preview.alreadyMigrated}</span>
              <span className="migracion-stat-label">Ya migrados</span>
            </div>
            <div className="migracion-stat-divider" />
            <div className="migracion-stat">
              <span className={`migracion-stat-num ${pendingCount > 0 ? 'migracion-stat-orange' : 'migracion-stat-green'}`}>
                {pendingCount}
              </span>
              <span className="migracion-stat-label">Por migrar ahora</span>
            </div>
          </>
        ) : null}
      </div>

      {/* Info de qué se migrará */}
      <div className="migracion-info">
        <p>Los registros migrados aparecerán con el estado <strong>Confirmado</strong> y la etiqueta <span className="badge-legacy">Sistema anterior</span> para diferenciarlos de los nuevos.</p>
        <p>Puedes ejecutar la migración múltiples veces — solo se agregarán registros nuevos que no existan ya en el sistema.</p>
      </div>

      {/* Resultado anterior */}
      {result && (
        <div className="migracion-result">
          <p className="migracion-result-ok">
            ✅ Migración completada: <strong>{result.inserted}</strong> insertados,{' '}
            <strong>{result.skipped}</strong> omitidos (ya existían o sin fecha).
          </p>
          {result.errors.length > 0 && (
            <details className="migracion-errors">
              <summary>{result.errors.length} error(es)</summary>
              <ul>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="migracion-error">{errorMsg}</div>
      )}

      {/* Botones */}
      <div className="migracion-actions">
        <button
          type="button"
          className="migracion-btn-refresh"
          onClick={fetchPreview}
          disabled={loadingPreview || running}
        >
          ↺ Actualizar conteo
        </button>
        <button
          type="button"
          className="migracion-btn"
          onClick={handleMigrate}
          disabled={running || loadingPreview || pendingCount === 0}
        >
          {running ? 'Migrando…' : pendingCount === 0 ? 'Sin registros nuevos' : `Migrar ${pendingCount} registro${pendingCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
