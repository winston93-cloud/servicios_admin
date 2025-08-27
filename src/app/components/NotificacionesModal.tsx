"use client"

import { useEffect, useMemo, useState } from 'react'
import { searchAlumnos, AlumnoSearchResult } from '@/lib/alumnoService'
import { crearNotificacion } from '@/lib/notificacionesService'
import { X, Send, Search as SearchIcon } from 'lucide-react'

interface NotificacionesModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function NotificacionesModal({ isOpen, onClose }: NotificacionesModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AlumnoSearchResult[]>([])
  const [selected, setSelected] = useState<AlumnoSearchResult | null>(null)
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [openDropdown, setOpenDropdown] = useState(false)
  const [ciclo, setCiclo] = useState<string>('22')

  useEffect(() => {
    if (!isOpen) return
    setQuery(''); setResults([]); setSelected(null); setAsunto(''); setMensaje(''); setError(null); setSuccess(null); setOpenDropdown(false)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        const r = await searchAlumnos(query, ciclo)
        setResults(r)
        setOpenDropdown(true)
      } else {
        setResults([])
        setOpenDropdown(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [query, ciclo, isOpen])

  const canSend = useMemo(() => selected && mensaje.trim().length > 0, [selected, mensaje])

  const handleSelect = (item: AlumnoSearchResult) => {
    setSelected(item)
    setQuery(item.alumno_nombre_completo)
    setResults([])
    setOpenDropdown(false)
  }

  const handleSend = async () => {
    if (!selected) return
    setLoading(true)
    setError(null)
    setSuccess(null)
    const { error } = await crearNotificacion({
      referencia: Number(selected.alumno_ref),
      asunto: asunto.trim(),
      mensaje: mensaje.trim(),
      estatus: 1
    })
    setLoading(false)
    if (error) {
      setError(error)
    } else {
      setSuccess('Notificación enviada correctamente')
      setAsunto('')
      setMensaje('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content notify-modal">
        <div className="notify-header">
          <div className="notify-title">
            <span className="notify-dot" />
            Enviar notificación
          </div>
          <button onClick={onClose} className="modal-close">
            <X size={20} />
          </button>
        </div>
        <div className="notify-body">
          <div className="notify-grid">
            <div className="notify-field" style={{ position: 'relative' }}>
              <label className="notify-label">Alumno</label>
              <div className="notify-input-with-icon">
                <SearchIcon size={16} />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelected(null) }}
                  onFocus={() => setOpenDropdown(results.length > 0)}
                  placeholder="Empieza a escribir el nombre completo"
                  className="notify-input"
                  aria-autocomplete="list"
                  aria-expanded={openDropdown}
                />
              </div>
              {openDropdown && results.length > 0 && (
                <div className="notify-dropdown" role="listbox">
                  {results.map(item => (
                    <button
                      key={`${item.alumno_ref}`}
                      onClick={() => handleSelect(item)}
                      className="notify-option"
                      role="option"
                    >
                      <div className="notify-option-name">{item.alumno_nombre_completo}</div>
                      <div className="notify-option-meta">ref: {item.alumno_ref}</div>
                    </button>
                  ))}
                </div>
              )}
              {selected && (
                <div className="notify-selected">
                  Seleccionado: <strong>{selected.alumno_nombre_completo}</strong> (ref: {selected.alumno_ref})
                </div>
              )}
            </div>

            <div className="notify-field">
              <label className="notify-label">Ciclo</label>
              <select value={ciclo} onChange={(e) => setCiclo(e.target.value)} className="notify-input" style={{ paddingLeft: 16 }}>
                <option value="22">22</option>
                <option value="23">23</option>
                <option value="24">24</option>
              </select>
            </div>
          </div>

          <div className="notify-field">
            <label className="notify-label">Asunto</label>
            <input
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Asunto de la notificación"
              className="notify-input"
            />
          </div>

          <div className="notify-field">
            <label className="notify-label">Mensaje</label>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Escribe el cuerpo del mensaje"
              rows={6}
              className="notify-textarea"
            />
          </div>

          {error && <div className="error-message" role="alert">{error}</div>}
          {success && <div className="success-message" role="status">{success}</div>}

          <div className="notify-actions">
            <button onClick={onClose} className="btn-secondary">Cerrar</button>
            <button disabled={!canSend || loading} onClick={handleSend} className="notify-send-btn">
              <Send size={16} /> {loading ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
