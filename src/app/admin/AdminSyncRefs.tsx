'use client'

import { useState } from 'react'

type SyncResult = {
  success: boolean
  message: string
  synced: number
  notFound: number
  total: number
  details: Array<{ id: string; name: string; ref: number | null }>
}

export default function AdminSyncRefs() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    if (!confirm('¿Estás seguro? Esta operación buscará en MySQL los números de control de todas las citas completadas sin alumno_ref y los actualizará en Supabase.')) {
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/admin/sync-alumno-refs', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al sincronizar')
      }

      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="admin-sync-refs">
      <div className="admin-section-header">
        <h2>🔄 Sincronizar números de control</h2>
        <p className="admin-section-subtitle">
          Vincula los números de control (alumno_ref) de MySQL con las citas completadas en Supabase
        </p>
      </div>

      <div className="admin-card" style={{ maxWidth: '800px', margin: '2rem auto' }}>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔄</div>
          
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Sincronización de números de control
          </h3>
          
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
            Esta herramienta busca en la base de datos MySQL los números de control de alumnos
            que ya fueron aprobados pero no tienen el <code>alumno_ref</code> registrado en Supabase.
          </p>

          <div style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border)', 
            borderRadius: '8px', 
            padding: '1.5rem', 
            marginBottom: '2rem',
            textAlign: 'left'
          }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              ℹ️ ¿Qué hace esta sincronización?
            </h4>
            <ul style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
              <li>Busca citas con <code>status = 'completed'</code> y <code>alumno_ref = NULL</code></li>
              <li>Para cada cita, busca en MySQL por nombre y apellido paterno del alumno</li>
              <li>Si encuentra coincidencia, actualiza el <code>alumno_ref</code> en Supabase</li>
              <li>Te muestra un reporte de cuántos se sincronizaron y cuántos no se encontraron</li>
            </ul>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-large"
            onClick={handleSync}
            disabled={loading}
            style={{ minWidth: '280px' }}
          >
            {loading ? '⏳ Sincronizando...' : '🔄 Ejecutar sincronización'}
          </button>

          {error && (
            <div style={{
              marginTop: '2rem',
              padding: '1rem 1.5rem',
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b',
            }}>
              <strong>❌ Error:</strong> {error}
            </div>
          )}

          {result && (
            <div style={{
              marginTop: '2rem',
              padding: '1.5rem',
              background: result.success ? '#d1fae5' : '#fee2e2',
              border: `1px solid ${result.success ? '#a7f3d0' : '#fecaca'}`,
              borderRadius: '8px',
              color: result.success ? '#065f46' : '#991b1b',
              textAlign: 'left',
            }}>
              <h4 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
                {result.success ? '✅' : '❌'} {result.message}
              </h4>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '1rem', 
                marginBottom: '1rem',
                padding: '1rem',
                background: 'rgba(255,255,255,0.5)',
                borderRadius: '6px',
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Total procesadas</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.total}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Sincronizadas</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.synced}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>No encontradas</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{result.notFound}</div>
                </div>
              </div>

              {result.details && result.details.length > 0 && (
                <details style={{ marginTop: '1rem' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Ver detalles ({result.details.length} registros)
                  </summary>
                  <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto', 
                    fontSize: '0.85rem',
                    background: 'rgba(255,255,255,0.3)',
                    padding: '0.75rem',
                    borderRadius: '4px',
                  }}>
                    {result.details.map((d, i) => (
                      <div key={i} style={{ 
                        padding: '0.5rem', 
                        borderBottom: i < result.details.length - 1 ? '1px solid rgba(0,0,0,0.1)' : 'none',
                      }}>
                        <strong>{d.name}</strong> → Ref: {d.ref}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
