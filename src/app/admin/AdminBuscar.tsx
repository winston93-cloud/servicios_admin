'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { searchAdmissionAppointments } from './actions'
import { createPermissionRequest, getAllRecentRequests } from './dashboard/actions'
import ExamDateCalendar from '@/components/admission/ExamDateCalendar'
import type { AdmissionAppointment, PermissionRequest } from '@/types/admissionDatabase'

const LEVEL_LABELS: Record<string, string> = {
  maternal: 'Maternal',
  kinder: 'Kinder',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
}

const GRADE_LABELS: Record<string, string> = {
  maternal_a: 'Maternal A', maternal_b: 'Maternal B',
  kinder_1: 'Kinder 1', kinder_2: 'Kinder 2', kinder_3: 'Kinder 3',
  primaria_1: '1° Primaria', primaria_2: '2° Primaria', primaria_3: '3° Primaria',
  primaria_4: '4° Primaria', primaria_5: '5° Primaria', primaria_6: '6° Primaria',
  secundaria_7: '7mo (1° Sec.)', secundaria_8: '8vo (2° Sec.)', secundaria_9: '9no (3° Sec.)',
}

// Todos los grados disponibles en orden ascendente
const ALL_GRADES = [
  { value: 'maternal_a', label: 'Maternal A', nivel: 'Maternal' },
  { value: 'maternal_b', label: 'Maternal B', nivel: 'Maternal' },
  { value: 'kinder_1', label: 'Kinder 1', nivel: 'Kinder' },
  { value: 'kinder_2', label: 'Kinder 2', nivel: 'Kinder' },
  { value: 'kinder_3', label: 'Kinder 3', nivel: 'Kinder' },
  { value: 'primaria_1', label: '1° Primaria', nivel: 'Primaria' },
  { value: 'primaria_2', label: '2° Primaria', nivel: 'Primaria' },
  { value: 'primaria_3', label: '3° Primaria', nivel: 'Primaria' },
  { value: 'primaria_4', label: '4° Primaria', nivel: 'Primaria' },
  { value: 'primaria_5', label: '5° Primaria', nivel: 'Primaria' },
  { value: 'primaria_6', label: '6° Primaria', nivel: 'Primaria' },
  { value: 'secundaria_7', label: '7mo Grado', nivel: 'Secundaria' },
  { value: 'secundaria_8', label: '8vo Grado', nivel: 'Secundaria' },
  { value: 'secundaria_9', label: '9no Grado', nivel: 'Secundaria' },
]

const GRADE_OPTIONS_BY_LEVEL: Record<string, { value: string; label: string }[]> = {
  maternal: [
    { value: 'maternal_a', label: 'Maternal A' },
    { value: 'maternal_b', label: 'Maternal B' },
  ],
  kinder: [
    { value: 'kinder_1', label: 'Kinder 1' },
    { value: 'kinder_2', label: 'Kinder 2' },
    { value: 'kinder_3', label: 'Kinder 3' },
  ],
  primaria: [
    { value: 'primaria_1', label: '1° Primaria' },
    { value: 'primaria_2', label: '2° Primaria' },
    { value: 'primaria_3', label: '3° Primaria' },
    { value: 'primaria_4', label: '4° Primaria' },
    { value: 'primaria_5', label: '5° Primaria' },
    { value: 'primaria_6', label: '6° Primaria' },
  ],
  secundaria: [
    { value: 'secundaria_7', label: '7mo Grado' },
    { value: 'secundaria_8', label: '8vo Grado' },
    { value: 'secundaria_9', label: '9no Grado' },
  ],
}

function apiLevel(level: string): string {
  if (level === 'maternal' || level === 'kinder') return 'maternal_kinder'
  if (level === 'primaria') return 'primaria'
  if (level === 'secundaria') return 'secundaria'
  return level
}

function formatCreatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

type ReqStatus = 'pendiente' | 'aprobada' | 'rechazada'

function StatusBadge({ status }: { status: ReqStatus }) {
  const cfg = {
    pendiente: { bg: '#fef3c7', color: '#92400e', label: '⏳ Reagendación pendiente' },
    aprobada:  { bg: '#d1fae5', color: '#065f46', label: '✅ Reagendación aprobada'  },
    rechazada: { bg: '#fee2e2', color: '#991b1b', label: '❌ Solicitud rechazada'    },
  }[status]
  return (
    <span style={{
      fontSize: '0.8rem', fontWeight: '700', padding: '0.35rem 0.85rem',
      borderRadius: '20px', background: cfg.bg, color: cfg.color,
    }}>
      {cfg.label}
    </span>
  )
}

export default function AdminBuscar({ allowedLevels }: { allowedLevels: string[] }) {
  const [nameQuery,       setNameQuery]       = useState('')
  const [createdDate,     setCreatedDate]     = useState('')
  const [examDate,        setExamDate]        = useState('')
  const [results,         setResults]         = useState<AdmissionAppointment[]>([])
  const [loading,         setLoading]         = useState(false)
  const [selected,        setSelected]        = useState<AdmissionAppointment | null>(null)
  const [reagendarId,     setReagendarId]     = useState<string | null>(null)
  const [editDate,        setEditDate]        = useState('')
  const [editTime,        setEditTime]        = useState('')
  const [editLevel,       setEditLevel]       = useState('')
  const [editGrade,       setEditGrade]       = useState('')
  const [editBlockedDates, setEditBlockedDates] = useState<string[]>([])
  const [editScheduleTimes, setEditScheduleTimes] = useState<string[]>([])
  const [editBookedSlots, setEditBookedSlots] = useState<string[]>([])
  const [statusMap,       setStatusMap]       = useState<Record<string, ReqStatus>>({})
  const [showModal,       setShowModal]       = useState(false)
  const [solMsg,          setSolMsg]          = useState('')
  const [sending,         setSending]         = useState(false)

  const resultsRef       = useRef<HTMLDivElement>(null)
  const selectedCardRef  = useRef<HTMLDivElement>(null)
  const nameInputRef     = useRef<HTMLInputElement>(null)
  const reagendarRef     = useRef<HTMLDivElement>(null)
  const reagendarTimeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => nameInputRef.current?.focus({ preventScroll: false }), 0)
    return () => clearTimeout(t)
  }, [])

  // Cargar estados de solicitudes recientes
  useEffect(() => {
    getAllRecentRequests().then((reqs: PermissionRequest[]) => {
      const map: Record<string, ReqStatus> = {}
      reqs.filter(r => r.type === 'reagendar' && r.appointment_id).forEach(r => {
        if (!map[r.appointment_id!]) map[r.appointment_id!] = r.status as ReqStatus
      })
      setStatusMap(map)
    }).catch(() => {})
  }, [])

  const runSearch = useCallback(async () => {
    if (!nameQuery.trim() && !createdDate && !examDate) { setResults([]); return }
    setLoading(true)
    try {
      const list = await searchAdmissionAppointments({
        name: nameQuery.trim() || undefined,
        createdDate: createdDate || undefined,
        appointmentDate: examDate || undefined,
        levels: allowedLevels.length > 0 ? allowedLevels : undefined,
      })
      setResults(list)
      setSelected(null)
    } catch (e) {
      setResults([])
      alert((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [nameQuery, createdDate, examDate])

  useEffect(() => {
    const t = setTimeout(runSearch, 350)
    return () => clearTimeout(t)
  }, [runSearch])

  useEffect(() => {
    if (!loading && results.length > 0 && resultsRef.current)
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loading, results.length])

  useEffect(() => {
    if (!selected) return
    const t = setTimeout(() => selectedCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    return () => clearTimeout(t)
  }, [selected])

  useEffect(() => {
    if (!reagendarId) return
    const t = setTimeout(() => reagendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
    return () => clearTimeout(t)
  }, [reagendarId])

  useEffect(() => {
    if (!reagendarId || !editDate || !editTime) return
    const t = setTimeout(() => reagendarTimeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
    return () => clearTimeout(t)
  }, [reagendarId, editDate, editTime])

  useEffect(() => {
    if (!reagendarId || !editLevel) return
    const level = apiLevel(editLevel)
    Promise.all([
      fetch(`/api/blocked-dates?level=${level}`).then(r => r.json()).then(d => d.dates || []).catch(() => []),
      fetch(`/api/schedules?level=${level}`).then(r => r.json()).then(d => d.times || []).catch(() => []),
    ]).then(([dates, times]) => {
      setEditBlockedDates(dates)
      setEditScheduleTimes(times)
    })
  }, [reagendarId, editLevel])

  useEffect(() => {
    if (!reagendarId || !editDate || !editLevel) { setEditBookedSlots([]); return }
    fetch(`/api/booked-slots?level=${editLevel}&date=${editDate}&exclude_id=${reagendarId}`)
      .then(r => r.json())
      .then(d => setEditBookedSlots(d.times || []))
      .catch(() => setEditBookedSlots([]))
  }, [reagendarId, editDate, editLevel])

  const startReagendar = (a: AdmissionAppointment) => {
    setReagendarId(a.id)
    setEditDate(a.appointment_date)
    setEditTime(a.appointment_time)
    setEditLevel(a.level)
    setEditGrade('')
  }

  const cancelReagendar = () => setReagendarId(null)

  // Abrir modal de confirmación antes de enviar solicitud
  const openSolicitudModal = () => {
    if (editScheduleTimes.length > 0 && !editTime?.trim()) {
      alert('Elige un horario de la lista.')
      return
    }
    setSolMsg('')
    setShowModal(true)
  }

  // Enviar la solicitud a la directora
  const enviarSolicitud = async () => {
    if (!reagendarId || !selected) return
    setSending(true)
    try {
      const apt = results.find(r => r.id === reagendarId) ?? selected
      const res = await createPermissionRequest({
        type:           'reagendar',
        level:          apiLevel(apt.level) as 'maternal_kinder' | 'primaria' | 'secundaria',
        appointment_id: apt.id,
        student_name:   studentDisplay(apt),
        current_date:   apt.appointment_date,
        current_time:   apt.appointment_time,
        proposed_date:  editDate,
        proposed_time:  editTime?.trim() || 'Por confirmar',
        proposed_grade: editGrade || undefined,
        psych_message:  solMsg.trim() || undefined,
      })
      if (!res?.ok) throw new Error(res?.error || 'No se pudo enviar la solicitud.')
      setStatusMap(prev => ({ ...prev, [apt.id]: 'pendiente' }))
      setShowModal(false)
      setReagendarId(null)
    } catch (e) {
      alert('Error: ' + (e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const studentDisplay = (a: AdmissionAppointment) =>
    [a.student_name, a.student_last_name_p, a.student_last_name_m].filter(Boolean).join(' ')

  // Cita activa en el modal
  const activeApt = reagendarId ? (results.find(r => r.id === reagendarId) ?? selected) : null

  return (
    <div className="admin-buscar">

      {/* ── Modal de confirmación solicitud ──────────────────────────── */}
      {showModal && activeApt && (
        <div className="modal-overlay" onClick={() => !sending && setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header modal-header-solicitud">
              <span className="modal-header-icon" aria-hidden="true">📋</span>
              <h3>Solicitar autorización — Reagendación</h3>
            </div>
            <div className="modal-body">
              <div className="modal-info-grid">
                <div className="modal-info-item">
                  <span className="modal-info-label">Alumno</span>
                  <span className="modal-info-value">{studentDisplay(activeApt)}</span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">Cita actual</span>
                  <span className="modal-info-value">
                    {new Date(activeApt.appointment_date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {activeApt.appointment_time}
                  </span>
                </div>
                <div className="modal-info-item">
                  <span className="modal-info-label">Propone cambiar a</span>
                  <span className="modal-info-value">
                    {new Date(editDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {editTime || 'Por confirmar'}
                  </span>
                </div>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <label className="modal-field-label">Mensaje para la directora (opcional)</label>
                <textarea
                  value={solMsg}
                  onChange={e => setSolMsg(e.target.value)}
                  rows={3}
                  placeholder="Motivo de la reagendación..."
                  className="modal-textarea"
                />
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label className="modal-field-label">Cambio de grado (opcional)</label>
                <select value={editGrade} onChange={e => setEditGrade(e.target.value)}
                  className="modal-select" style={{ width: '100%' }}>
                  <option value="">— Sin cambio —</option>
                  {ALL_GRADES.map(g => (
                    <option key={g.value} value={g.value}>
                      {g.label} ({g.nivel})
                    </option>
                  ))}
                </select>
                {editGrade && editGrade !== activeApt.grade_level && (
                  <p style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.35rem', lineHeight: '1.4' }}>
                    ⚠️ Se solicitará cambio de <strong>{GRADE_LABELS[activeApt.grade_level] || activeApt.grade_level}</strong> a <strong>{GRADE_LABELS[editGrade]}</strong>
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={sending}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={enviarSolicitud} disabled={sending}>
                {sending ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Caja de búsqueda ─────────────────────────────────────────── */}
      <div className="admin-buscar-box">
        <div className="admin-buscar-box-inner">
          <h3 className="admin-buscar-title">
            <span className="admin-buscar-title-icon" aria-hidden>🔍</span>
            Criterios de búsqueda
          </h3>
          <div className="admin-buscar-filters">
            <div className="admin-buscar-field admin-buscar-field-name">
              <label htmlFor="admin-buscar-name">Nombre (alumno o tutor)</label>
              <input
                ref={nameInputRef}
                id="admin-buscar-name"
                type="text"
                placeholder="Escriba para buscar..."
                value={nameQuery}
                onChange={e => setNameQuery(e.target.value)}
                onFocus={() => setNameQuery('')}
                className="admin-input"
                autoComplete="off"
                aria-describedby="admin-buscar-hint"
              />
            </div>
            <div className="admin-buscar-field admin-buscar-field-date">
              <label htmlFor="admin-buscar-created">Fecha de agendación</label>
              <input
                id="admin-buscar-created"
                type="date"
                value={createdDate}
                onChange={e => setCreatedDate(e.target.value)}
                onFocus={() => setCreatedDate('')}
                className="admin-input"
              />
            </div>
            <div className="admin-buscar-field admin-buscar-field-date">
              <label htmlFor="admin-buscar-exam">Fecha de examen</label>
              <input
                id="admin-buscar-exam"
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                onFocus={() => setExamDate('')}
                className="admin-input"
              />
            </div>
          </div>
          <p id="admin-buscar-hint" className="admin-buscar-hint">
            Use al menos un criterio. La búsqueda se actualiza al escribir o elegir fecha. Navegue con Tab y use Enter en los resultados.
          </p>
        </div>
      </div>

      {loading && (
        <div className="admin-buscar-loading" role="status" aria-live="polite">
          <span className="admin-buscar-loading-dot" />
          <span className="admin-buscar-loading-dot" />
          <span className="admin-buscar-loading-dot" />
          <span>Buscando…</span>
        </div>
      )}

      {!loading && nameQuery.trim().length > 0 && nameQuery.trim().length < 2 && !createdDate && !examDate && (
        <p className="admin-hint">Escriba al menos 2 caracteres para buscar por nombre.</p>
      )}

      {!loading && (nameQuery.trim() || createdDate || examDate) && results.length === 0 && (
        <p className="admin-empty">No se encontraron citas con esos criterios.</p>
      )}

      {!loading && results.length > 0 && (
        <div ref={resultsRef} className="admin-buscar-results" role="list">
          {results.map(a => (
            <div
              key={a.id}
              ref={selected?.id === a.id ? selectedCardRef : null}
              className={`admin-buscar-card ${selected?.id === a.id ? 'selected' : ''}`}
              role="listitem"
            >
              <button
                type="button"
                className="admin-buscar-card-head"
                onClick={() => setSelected(selected?.id === a.id ? null : a)}
                aria-expanded={selected?.id === a.id}
                aria-controls={selected?.id === a.id ? `admin-buscar-card-body-${a.id}` : undefined}
                id={`admin-buscar-card-${a.id}`}
              >
                <span className="admin-buscar-card-name">{studentDisplay(a)}</span>
                <span className="admin-buscar-card-meta">
                  {LEVEL_LABELS[a.level] || a.level} · {new Date(a.appointment_date + 'T12:00:00').toLocaleDateString('es-MX')} · {a.appointment_time}
                </span>
                <span className="admin-buscar-card-arrow">{selected?.id === a.id ? '▼' : '▶'}</span>
              </button>

              {selected?.id === a.id && (
                <div id={`admin-buscar-card-body-${a.id}`} className="admin-buscar-card-body" role="region" aria-labelledby={`admin-buscar-card-${a.id}`}>
                  <div className="admin-buscar-detail">
                    <p><strong>Aspirante:</strong> {studentDisplay(a)} · {a.grade_level} · {a.student_age} años</p>
                    <p><strong>Tutor:</strong> {a.parent_name} · {a.parent_email} · {a.parent_phone}</p>
                    <p><strong>Fecha de agendación:</strong> {formatCreatedAt(a.created_at)}</p>
                    <p><strong>Cita:</strong> {new Date(a.appointment_date + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {a.appointment_time}</p>
                    <p><strong>Estado:</strong> <span className={`status-pill status-${a.status}`}>{a.status}</span></p>
                  </div>

                  {reagendarId === a.id ? (
                    <div ref={reagendarRef} className="admin-buscar-reagendar">
                      <h4>Reagendar cita</h4>
                      <div className="admin-buscar-calendar">
                        <label>Nueva fecha</label>
                        <ExamDateCalendar value={editDate} onChange={setEditDate} blockedDates={editBlockedDates} isAdmin />
                      </div>
                      {editDate && (
                        <div className="admin-buscar-time">
                          <label>Horario</label>
                          {editScheduleTimes.length === 0 ? (
                            <input
                              type="text"
                              value={editTime}
                              onChange={e => setEditTime(e.target.value)}
                              className="admin-input"
                              placeholder="Ej: 09:00"
                              aria-label="Horario de la cita"
                            />
                          ) : (
                            <div className="time-slots time-slots-admin" role="group" aria-label="Elegir horario">
                              {editScheduleTimes.map(time => {
                                const isBooked = editBookedSlots.includes(time)
                                return (
                                  <button
                                    key={time}
                                    type="button"
                                    className={`time-slot ${editTime === time ? 'selected' : ''} ${isBooked ? 'time-slot-booked' : ''}`}
                                    onClick={() => !isBooked && setEditTime(time)}
                                    disabled={isBooked}
                                    title={isBooked ? 'Ocupado' : undefined}
                                    aria-pressed={editTime === time}
                                    aria-disabled={isBooked}
                                  >
                                    {time}
                                    {isBooked && <span className="time-slot-label"> (Ocupado)</span>}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      <div ref={reagendarTimeRef} className="admin-buscar-actions">
                        <button
                          type="button"
                          className="btn-solicitud-accion"
                          onClick={openSolicitudModal}
                          disabled={!editDate}
                        >
                          Solicitar autorización
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={cancelReagendar}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="admin-buscar-actions">
                      {statusMap[a.id] === 'pendiente' ? (
                        <StatusBadge status="pendiente" />
                      ) : statusMap[a.id] === 'aprobada' ? (
                        <StatusBadge status="aprobada" />
                      ) : (
                        <button type="button" className="btn btn-primary" onClick={() => startReagendar(a)} style={{ textAlign: 'center' }}>
                          <div style={{ lineHeight: '1.3' }}>
                            <div>Reagendar cita</div>
                            <div style={{ fontSize: '0.85em', opacity: 0.9 }}>y cambiar grado</div>
                          </div>
                        </button>
                      )}
                      {statusMap[a.id] === 'rechazada' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <StatusBadge status="rechazada" />
                          <button type="button" className="btn btn-primary" onClick={() => startReagendar(a)} style={{ textAlign: 'center' }}>
                            <div style={{ lineHeight: '1.3' }}>
                              <div>Reagendar de nuevo</div>
                              <div style={{ fontSize: '0.85em', opacity: 0.9 }}>y cambiar grado</div>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
