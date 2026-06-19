'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { resendAdmissionParentEmails } from './actions'
import type { AdmissionAppointment } from '@/types/admissionDatabase'

const LEVEL_LABELS: Record<string, string> = {
  maternal: 'Maternal',
  kinder: 'Kinder',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
}

const GRADE_LABELS: Record<string, string> = {
  maternal_a: 'Maternal A',
  maternal_b: 'Maternal B',
  kinder_1: 'Kinder 1',
  kinder_2: 'Kinder 2',
  kinder_3: 'Kinder 3',
  primaria_1: '1° Primaria',
  primaria_2: '2° Primaria',
  primaria_3: '3° Primaria',
  primaria_4: '4° Primaria',
  primaria_5: '5° Primaria',
  primaria_6: '6° Primaria',
  secundaria_7: '7mo (1° Sec.)',
  secundaria_8: '8vo (2° Sec.)',
  secundaria_9: '9no (3° Sec.)',
}

function norm(s: string) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function fullStudentName(a: AdmissionAppointment) {
  return [a.student_name, a.student_last_name_p, a.student_last_name_m].filter(Boolean).join(' ').trim()
}

function formatExamDate(iso: string) {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function AdminReenviarInfo({
  appointments,
  allowedLevels,
}: {
  appointments: AdmissionAppointment[]
  allowedLevels: string[]
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [openList, setOpenList] = useState(false)
  const [selected, setSelected] = useState<AdmissionAppointment | null>(null)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const scoped = useMemo(() => {
    if (!allowedLevels.length) return appointments
    return appointments.filter((a) => allowedLevels.includes(a.level))
  }, [appointments, allowedLevels])

  const suggestions = useMemo(() => {
    const q = norm(query)
    if (q.length < 2) return []
    return scoped
      .filter((a) => norm(fullStudentName(a)).includes(q))
      .slice(0, 25)
  }, [scoped, query])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenList(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pick = (a: AdmissionAppointment) => {
    setSelected(a)
    setQuery(fullStudentName(a))
    setOpenList(false)
    setMsg(null)
  }

  const onInputChange = (v: string) => {
    setQuery(v)
    setOpenList(true)
    if (selected && norm(v) !== norm(fullStudentName(selected))) setSelected(null)
    setMsg(null)
  }

  const onResend = async () => {
    if (!selected) return
    setSending(true)
    setMsg(null)
    try {
      const r = await resendAdmissionParentEmails(selected.id)
      if (r.ok) {
        const extra =
          selected.level === 'secundaria' && selected.grade_level
            ? ' Incluye temarios (secundaria) si aplica.'
            : ''
        setMsg({
          ok: true,
          text: `Se reenvió el correo de confirmación al tutor, con copia a sistemas.${extra}`,
        })
      } else {
        setMsg({ ok: false, text: r.error || 'No se pudo enviar el correo.' })
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setSending(false)
    }
  }

  const hasEmail = Boolean(selected?.parent_email?.trim())

  return (
    <div ref={rootRef} className="admin-reenviar-wrap" style={{ maxWidth: '640px' }}>
      <p className="admin-hint">
        Busque por <strong>nombre completo del aspirante</strong> (nombre y apellidos). Al seleccionarlo podrá reenviar el mismo correo que reciben al agendar la cita, con el enlace para{' '}
        <strong>cargar documentación y llenar el expediente inicial</strong>. Copia interna a{' '}
        <strong>sistemas.desarrollo@winston93.edu.mx</strong>.
      </p>

      <div style={{ position: 'relative', marginTop: '1rem' }}>
        <label className="modal-field-label" htmlFor="reenviar-busqueda">
          Nombre completo del aspirante
        </label>
        <input
          id="reenviar-busqueda"
          type="text"
          className="modal-time-input"
          value={query}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => setOpenList(true)}
          placeholder="Escribe al menos 2 letras…"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls="reenviar-suggest-listbox"
          aria-expanded={openList && suggestions.length > 0}
        />
        {openList && suggestions.length > 0 && (
          <ul className="admin-reenviar-suggest-list" role="listbox" id="reenviar-suggest-listbox">
            {suggestions.map((a) => (
              <li key={a.id} role="presentation" className="admin-reenviar-suggest-li">
                <div
                  role="option"
                  tabIndex={0}
                  aria-selected={selected?.id === a.id}
                  className="admin-reenviar-suggest-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(a)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      pick(a)
                    }
                  }}
                >
                  <div className="admin-reenviar-suggest-name">{fullStudentName(a) || a.student_name}</div>
                  <div className="admin-reenviar-suggest-sub">
                    {LEVEL_LABELS[a.level] || a.level} · {GRADE_LABELS[a.grade_level] || a.grade_level} ·{' '}
                    {formatExamDate(a.appointment_date)} {a.appointment_time}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <div
          style={{
            marginTop: '1.25rem',
            padding: '1rem 1.1rem',
            borderRadius: 12,
            border: '1px solid var(--adm-border, #e2e8f0)',
            background: 'var(--adm-surface-muted, rgba(148,163,184,0.12))',
          }}
        >
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.05rem' }}>Cita seleccionada</h3>
          <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.92rem' }}>
            <div>
              <strong>Aspirante:</strong> {fullStudentName(selected) || selected.student_name}
            </div>
            <div>
              <strong>Nivel / grado:</strong> {LEVEL_LABELS[selected.level] || selected.level} ·{' '}
              {GRADE_LABELS[selected.grade_level] || selected.grade_level}
            </div>
            <div>
              <strong>Ciclo:</strong> {selected.school_cycle || '—'}
            </div>
            <div>
              <strong>Examen:</strong> {formatExamDate(selected.appointment_date)} · {selected.appointment_time}
            </div>
            <div>
              <strong>Estado:</strong> {selected.status}
            </div>
            {selected.origin === 'legacy' && (
              <div>
                <strong>Origen:</strong> sistema anterior
              </div>
            )}
            <div>
              <strong>Tutor:</strong> {selected.parent_name === 'PSICOLOGIAS' ? 'N/A' : selected.parent_name || '—'}
            </div>
            <div>
              <strong>Correo tutor:</strong> {selected.parent_email?.trim() || '—'}
            </div>
            <div>
              <strong>Teléfono:</strong> {selected.parent_phone || '—'}
            </div>
          </div>

          {msg && (
            <p
              style={{
                marginTop: '0.85rem',
                padding: '0.6rem 0.75rem',
                borderRadius: 8,
                fontSize: '0.9rem',
                background: msg.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: msg.ok ? '#166534' : '#991b1b',
              }}
            >
              {msg.text}
            </p>
          )}

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
            disabled={sending || !hasEmail}
            onClick={onResend}
          >
            {sending ? 'Enviando…' : 'Reenviar correo de confirmación'}
          </button>
          {!hasEmail && (
            <p className="admin-hint" style={{ marginTop: '0.5rem' }}>
              Esta cita no tiene correo del tutor; actualiza el correo en el registro antes de reenviar.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
