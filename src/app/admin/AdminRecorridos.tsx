'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createRecorrido, updateRecorrido, deleteRecorrido } from './actions'
import type { TourRecorrido } from '@/types/admissionDatabase'
import type { TourRecorridoLevel } from '@/types/admissionDatabase'

const LEVEL_LABELS: Record<TourRecorridoLevel, string> = {
  maternal: 'Maternal',
  kinder: 'Kinder',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
}

const LEVELS: TourRecorridoLevel[] = ['maternal', 'kinder', 'primaria', 'secundaria']

const emptyForm = {
  level: 'primaria' as TourRecorridoLevel,
  tour_date: '',
  tour_time: '',
  student_name: '',
  parent_name: '',
  parent_phone: '',
  parent_email: '',
  notes: '',
}

export default function AdminRecorridos({ recorridos }: { recorridos: TourRecorrido[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<'lista' | 'nuevo'>('lista')
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)

  const startEdit = (r: TourRecorrido) => {
    setEditingId(r.id)
    setEditForm({
      level: r.level as TourRecorridoLevel,
      tour_date: r.tour_date,
      tour_time: r.tour_time,
      student_name: (r as TourRecorrido & { student_name?: string }).student_name ?? '',
      parent_name: r.parent_name,
      parent_phone: r.parent_phone,
      parent_email: r.parent_email,
      notes: r.notes ?? '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm(emptyForm)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const result = await createRecorrido({
      ...form,
      level: form.level,
      tour_date: form.tour_date,
      tour_time: form.tour_time,
      student_name: form.student_name || undefined,
    })
    setLoading(false)
    if (result.ok) {
      setForm(emptyForm)
      setTab('lista')
      router.refresh()
    } else {
      alert(result.error ?? 'Error al guardar')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setLoading(true)
    const result = await updateRecorrido(editingId, {
      level: editForm.level,
      tour_date: editForm.tour_date,
      tour_time: editForm.tour_time,
      student_name: editForm.student_name || undefined,
      parent_name: editForm.parent_name,
      parent_phone: editForm.parent_phone,
      parent_email: editForm.parent_email,
      notes: editForm.notes || undefined,
    })
    setLoading(false)
    if (result.ok) {
      setEditingId(null)
      setEditForm(emptyForm)
      router.refresh()
    } else {
      alert(result.error ?? 'Error al actualizar')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este recorrido programado?')) return
    setLoading(true)
    const result = await deleteRecorrido(id)
    setLoading(false)
    if (result.ok) {
      if (editingId === id) setEditingId(null)
      router.refresh()
    } else {
      alert(result.error ?? 'Error al eliminar')
    }
  }

  return (
    <div className="admin-recorridos">
      <p className="admin-hint">
        La sra. de vinculación agenda citas para que los papás reciban un recorrido. Maternal y Kinder comparten plantel; Primaria y Secundaria comparten plantel. No se permite duplicar día y hora dentro del mismo plantel.
      </p>
      <div className="admin-recorridos-tabs">
        <button
          type="button"
          className={`admin-recorridos-tab ${tab === 'lista' ? 'active' : ''}`}
          onClick={() => setTab('lista')}
        >
          Recorridos agendados
        </button>
        <button
          type="button"
          className={`admin-recorridos-tab ${tab === 'nuevo' ? 'active' : ''}`}
          onClick={() => setTab('nuevo')}
        >
          Agendar nuevo recorrido
        </button>
      </div>

      {tab === 'lista' && (
        <div className="admin-recorridos-lista">
          {recorridos.length === 0 ? (
            <p className="admin-empty">No hay recorridos programados. Agenda el primero en la pestaña anterior.</p>
          ) : (
            <ul className="admin-recorridos-list">
              {recorridos.map((r) => (
                <li key={r.id} className="admin-recorridos-item">
                  {editingId === r.id ? (
                    <form onSubmit={handleUpdate} className="admin-recorridos-edit-form">
                      <div className="admin-recorridos-edit-grid">
                        <label>
                          Nivel
                          <select
                            value={editForm.level}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, level: e.target.value as TourRecorridoLevel }))}
                          >
                            {LEVELS.map((l) => (
                              <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Fecha
                          <input
                            type="date"
                            value={editForm.tour_date}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, tour_date: e.target.value }))}
                            required
                          />
                        </label>
                        <label>
                          Hora
                          <input
                            type="time"
                            value={editForm.tour_time}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, tour_time: e.target.value }))}
                            required
                          />
                        </label>
                        <label>
                          Nombre del alumno
                          <input
                            type="text"
                            value={editForm.student_name}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, student_name: e.target.value }))}
                            placeholder="Nombre del prospecto"
                          />
                        </label>
                        <label>
                          Nombre del papá
                          <input
                            type="text"
                            value={editForm.parent_name}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, parent_name: e.target.value }))}
                            required
                          />
                        </label>
                        <label>
                          Teléfono
                          <input
                            type="tel"
                            value={editForm.parent_phone}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, parent_phone: e.target.value }))}
                            required
                          />
                        </label>
                        <label>
                          Correo
                          <input
                            type="email"
                            value={editForm.parent_email}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, parent_email: e.target.value }))}
                            required
                          />
                        </label>
                      </div>
                      <div className="admin-recorridos-edit-actions">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                          {loading ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEdit} disabled={loading}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="admin-recorridos-item-content">
                        <span className="admin-recorridos-item-fecha">
                          {new Date(r.tour_date + 'T12:00:00').toLocaleDateString('es-MX', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          {r.tour_time}
                        </span>
                        <span className="admin-recorridos-item-nivel">{LEVEL_LABELS[r.level as TourRecorridoLevel]}</span>
                        <span className="admin-recorridos-item-nombre">{r.parent_name}</span>
                        <span className="admin-recorridos-item-contacto">{r.parent_phone} · {r.parent_email}</span>
                        <span className="admin-recorridos-item-emails">
                          Correo papá: {r.email_parent_sent === true ? '✓ Enviado' : r.email_parent_sent === false ? '✗ No enviado' : '—'}
                          {' · '}
                          Correo directora: {r.email_director_sent === true ? '✓ Enviado' : r.email_director_sent === false ? '✗ No enviado' : '—'}
                        </span>
                      </div>
                      <div className="admin-recorridos-item-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => startEdit(r)}
                          disabled={loading}
                        >
                          Modificar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(r.id)}
                          disabled={loading}
                        >
                          Eliminar
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'nuevo' && (
        <form onSubmit={handleCreate} className="admin-recorridos-form">
          <p className="admin-hint" style={{ marginBottom: '1rem' }}>
            Primero selecciona nivel, fecha y hora. Luego los datos del papá.
          </p>
          <div className="admin-recorridos-form-grid">
            <label>
              Nivel
              <select
                value={form.level}
                onChange={(e) => setForm((prev) => ({ ...prev, level: e.target.value as TourRecorridoLevel }))}
                required
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
                ))}
              </select>
            </label>
            <label>
              Fecha
              <input
                type="date"
                value={form.tour_date}
                onChange={(e) => setForm((prev) => ({ ...prev, tour_date: e.target.value }))}
                required
              />
            </label>
            <label>
              Hora
              <input
                type="time"
                value={form.tour_time}
                onChange={(e) => setForm((prev) => ({ ...prev, tour_time: e.target.value }))}
                required
              />
            </label>
            <label className="admin-recorridos-form-full">
              Nombre del alumno
              <input
                type="text"
                value={form.student_name}
                onChange={(e) => setForm((prev) => ({ ...prev, student_name: e.target.value }))}
                placeholder="Nombre del prospecto"
              />
            </label>
            <label className="admin-recorridos-form-full">
              Nombre del papá
              <input
                type="text"
                value={form.parent_name}
                onChange={(e) => setForm((prev) => ({ ...prev, parent_name: e.target.value }))}
                required
                placeholder="Nombre completo"
              />
            </label>
            <label>
              Teléfono
              <input
                type="tel"
                value={form.parent_phone}
                onChange={(e) => setForm((prev) => ({ ...prev, parent_phone: e.target.value }))}
                required
                placeholder="Ej: 55 1234 5678"
              />
            </label>
            <label>
              Correo
              <input
                type="email"
                value={form.parent_email}
                onChange={(e) => setForm((prev) => ({ ...prev, parent_email: e.target.value }))}
                required
                placeholder="correo@ejemplo.com"
              />
            </label>
            <label className="admin-recorridos-form-full">
              Notas (opcional)
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Observaciones"
              />
            </label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Guardando…' : 'Agendar recorrido'}
          </button>
        </form>
      )}
    </div>
  )
}
