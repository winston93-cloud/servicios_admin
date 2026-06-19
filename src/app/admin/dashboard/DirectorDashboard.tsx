'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { respondPermissionRequest } from './actions'
import type { AdmissionLevel, PermissionRequest } from '@/types/admissionDatabase'

const LEVEL_LABELS: Record<AdmissionLevel, string> = {
  maternal_kinder: 'Maternal y Kinder',
  primaria:        'Primaria',
  secundaria:      'Secundaria',
}

const LEVEL_ICONS: Record<AdmissionLevel, string> = {
  maternal_kinder: '🌱',
  primaria:        '📚',
  secundaria:      '🎓',
}

const TYPE_INFO: Record<string, { icon: string; label: string; color: string }> = {
  reagendar: { icon: '📅', label: 'Reagendación de cita',   color: '#3b82f6' },
  horario:   { icon: '🕐', label: 'Cambio de horario',       color: '#8b5cf6' },
  bloqueo:   { icon: '🚫', label: 'Bloqueo de día',          color: '#f97316' },
}

function formatDate(d?: string) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)   return 'hace unos segundos'
  if (mins < 60)  return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `hace ${days} día${days > 1 ? 's' : ''}`
}

function RequestCard({ req, onRespond }: { req: PermissionRequest; onRespond: () => void }) {
  const [notes,    setNotes]    = useState('')
  const [expanded, setExpanded] = useState(req.status === 'pendiente')
  const [loading,  setLoading]  = useState(false)
  const router = useRouter()
  const info = TYPE_INFO[req.type]

  const respond = async (decision: 'aprobada' | 'rechazada') => {
    setLoading(true)
    try {
      await respondPermissionRequest(req.id, decision, notes.trim() || undefined)
      onRespond()
      router.refresh()
    } catch (e) {
      alert('Error: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const isPending = req.status === 'pendiente'

  return (
    <div className={`director-req-card status-${req.status}`}>
      {/* Cabecera */}
      <div className="director-req-header" onClick={() => setExpanded(p => !p)}>
        <div className="director-req-type-badge" style={{ background: info.color + '18', color: info.color }}>
          <span>{info.icon}</span>
          <strong>{info.label}</strong>
        </div>
        <div className="director-req-meta">
          <span style={{ fontSize: '0.8rem', color: '#64748b', marginRight: '0.5rem' }}>
            {LEVEL_ICONS[req.level as AdmissionLevel] ?? '📋'} {LEVEL_LABELS[req.level as AdmissionLevel] ?? req.level}
          </span>
          {req.requested_by && (
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginRight: '0.5rem' }}>
              👤 {req.requested_by}
            </span>
          )}
          <span className={`director-req-status-pill status-${req.status}`}>
            {req.status === 'pendiente' ? '⏳ Pendiente' : req.status === 'aprobada' ? '✅ Aprobada' : '❌ Rechazada'}
          </span>
          <span className="director-req-time">{timeAgo(req.created_at)}</span>
          <span className="director-req-toggle">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="director-req-body">
          {/* Detalles según tipo */}
          <div className="director-req-detail-grid">
            {req.type === 'reagendar' && (<>
              <div className="director-req-detail-item">
                <span className="drdi-label">Alumno</span>
                <span className="drdi-value">{req.student_name ?? '—'}</span>
              </div>
              <div className="director-req-detail-item">
                <span className="drdi-label">Fecha de nacimiento</span>
                <span className="drdi-value">{req.student_birth_date ?? '—'}</span>
              </div>
              <div className="director-req-detail-item">
                <span className="drdi-label">Cita actual</span>
                <span className="drdi-value">{formatDate(req.appt_date)} · {req.appt_time ?? '—'}</span>
              </div>
              <div className="director-req-detail-item highlight">
                <span className="drdi-label">Propone cambiar a</span>
                <span className="drdi-value">{formatDate(req.proposed_date)} · {req.proposed_time ?? '—'}</span>
              </div>
              {req.proposed_grade && (
                <div className="director-req-detail-item highlight">
                  <span className="drdi-label">Cambio de grado</span>
                  <span className="drdi-value">{req.proposed_grade}</span>
                </div>
              )}
            </>)}

            {req.type === 'horario' && (<>
              <div className="director-req-detail-item">
                <span className="drdi-label">Acción</span>
                <span className="drdi-value">{req.horario_action === 'agregar' ? '➕ Agregar horario' : '➖ Eliminar horario'}</span>
              </div>
              <div className="director-req-detail-item highlight">
                <span className="drdi-label">Horario</span>
                <span className="drdi-value">{req.horario_time_new ?? req.horario_time_old ?? '—'}</span>
              </div>
            </>)}

            {req.type === 'bloqueo' && (<>
              <div className="director-req-detail-item highlight">
                <span className="drdi-label">
                  {req.bloqueo_date_end ? 'Rango de fechas' : 'Fecha a bloquear'}
                </span>
                <span className="drdi-value">
                  {req.bloqueo_date_end
                    ? `${formatDate(req.bloqueo_date)} al ${formatDate(req.bloqueo_date_end)}`
                    : formatDate(req.bloqueo_date)}
                </span>
              </div>
              <div className="director-req-detail-item">
                <span className="drdi-label">Alcance</span>
                <span className="drdi-value">
                  {req.bloqueo_time ? `Solo horario ${req.bloqueo_time}` : 'Día completo'}
                </span>
              </div>
              <div className="director-req-detail-item">
                <span className="drdi-label">Motivo</span>
                <span className="drdi-value">{req.bloqueo_reason ?? 'Sin motivo especificado'}</span>
              </div>
            </>)}
          </div>

          {req.psych_message && (
            <div className="director-req-message">
              <span className="director-req-message-label">💬 Mensaje de la psicóloga</span>
              <p>"{req.psych_message}"</p>
            </div>
          )}

          {/* Respuesta ya dada */}
          {!isPending && req.director_notes && (
            <div className="director-req-response">
              <span className="director-req-message-label">📝 Tu respuesta</span>
              <p>"{req.director_notes}"</p>
              {req.responded_at && (
                <small style={{ color: '#94a3b8' }}>{timeAgo(req.responded_at)}</small>
              )}
            </div>
          )}

          {/* Acciones (solo si pendiente) */}
          {isPending && (
            <div className="director-req-actions">
              <textarea
                className="director-req-notes"
                placeholder="Notas o comentario (opcional)..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
              />
              <div className="director-req-btns">
                <button
                  type="button"
                  className="director-btn-reject"
                  onClick={() => respond('rechazada')}
                  disabled={loading}
                >
                  {loading ? '…' : '❌ Rechazar'}
                </button>
                <button
                  type="button"
                  className="director-btn-approve"
                  onClick={() => respond('aprobada')}
                  disabled={loading}
                >
                  {loading ? '…' : '✅ Aprobar y ejecutar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DirectorDashboard({
  requests,
}: {
  requests: PermissionRequest[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'pendiente' | 'historial'>('pendiente')

  const pending  = requests.filter(r => r.status === 'pendiente')
  const history  = requests.filter(r => r.status !== 'pendiente')

  const shown = tab === 'pendiente' ? pending : history

  return (
    <div className="director-dashboard">
      <header className="director-header">
        <div className="director-header-inner">
          <div className="director-header-title">
            <span className="director-header-icon">🏫</span>
            <div>
              <h1>Dashboard de Directoras</h1>
              <p>Sistema de Autorización de Cambios</p>
            </div>
          </div>
          <div className="director-header-actions">
            <a href="/dashboard" className="director-header-link">← Servicios</a>
            <a href="/admin" className="director-header-link">Agenda psicólogas</a>
          </div>
        </div>
      </header>

      <main className="director-main">
        {/* Stats */}
        <div className="director-stats">
          <div className="director-stat-card">
            <span className="director-stat-number pending">{pending.length}</span>
            <span className="director-stat-label">Pendientes</span>
          </div>
          <div className="director-stat-card">
            <span className="director-stat-number approved">{requests.filter(r => r.status === 'aprobada').length}</span>
            <span className="director-stat-label">Aprobadas</span>
          </div>
          <div className="director-stat-card">
            <span className="director-stat-number rejected">{requests.filter(r => r.status === 'rechazada').length}</span>
            <span className="director-stat-label">Rechazadas</span>
          </div>
          <div className="director-stat-card">
            <span className="director-stat-number total">{requests.length}</span>
            <span className="director-stat-label">Total</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="director-tabs">
          <button
            type="button"
            className={`director-tab ${tab === 'pendiente' ? 'active' : ''}`}
            onClick={() => setTab('pendiente')}
          >
            ⏳ Pendientes
            {pending.length > 0 && <span className="director-tab-badge">{pending.length}</span>}
          </button>
          <button
            type="button"
            className={`director-tab ${tab === 'historial' ? 'active' : ''}`}
            onClick={() => setTab('historial')}
          >
            📋 Historial
          </button>
        </div>

        {/* Lista de solicitudes */}
        <div className="director-req-list">
          {shown.length === 0 ? (
            <div className="director-empty">
              {tab === 'pendiente'
                ? '✅ No hay solicitudes pendientes por ahora.'
                : '📭 No hay solicitudes en el historial.'}
            </div>
          ) : (
            shown.map(req => (
              <RequestCard
                key={req.id}
                req={req}
                onRespond={() => router.refresh()}
              />
            ))
          )}
        </div>
      </main>
    </div>
  )
}
