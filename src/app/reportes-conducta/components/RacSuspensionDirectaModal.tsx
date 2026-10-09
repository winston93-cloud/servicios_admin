'use client'

import { Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { etiquetaGradoStaffSecundaria, opcionesMotivo, RAC_TIPOS } from '@/lib/racCatalogo'

type AlumnoBusqueda = {
  alumno_id: number
  alumno_ref: string | number | null
  alumno_app: string | null
  alumno_apm: string | null
  alumno_nombre: string | null
  alumno_grado?: number | string | null
}

type Props = {
  onClose: () => void
  onGuardado: (resultado: { envio?: { ok?: boolean; error?: string } }) => void
}

function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nombreDe(a: AlumnoBusqueda): string {
  return [a.alumno_app, a.alumno_apm, a.alumno_nombre].filter(Boolean).join(' ')
}

async function leerJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export default function RacSuspensionDirectaModal({ onClose, onGuardado }: Props) {
  const [q, setQ] = useState('')
  const [alumnos, setAlumnos] = useState<AlumnoBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [sugerir, setSugerir] = useState(false)
  const [alumno, setAlumno] = useState<AlumnoBusqueda | null>(null)
  const [motivo, setMotivo] = useState(1)
  const [mensaje, setMensaje] = useState('')
  const [fecha, setFecha] = useState(hoyLocal)
  const [dias, setDias] = useState(1)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const term = q.trim()
    if (alumno || term.length < 1) {
      setAlumnos([])
      return
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setBuscando(true)
        try {
          const res = await fetch(`/api/rac/coordinacion?vista=historial&q=${encodeURIComponent(term)}`, {
            credentials: 'include',
          })
          const data = await leerJson(res)
          if (!res.ok) throw new Error(String(data.error || `Error ${res.status}`))
          setAlumnos((data.alumnos as AlumnoBusqueda[]) ?? [])
          setSugerir(true)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Error al buscar alumnos')
        } finally {
          setBuscando(false)
        }
      })()
    }, 280)
    return () => window.clearTimeout(t)
  }, [q, alumno])

  async function guardar() {
    setError('')
    if (!alumno) return setError('Elige al alumno.')
    if (!mensaje.trim()) return setError('Describe el motivo de la suspensión.')
    if (!fecha) return setError('Indica la fecha de inicio.')
    if (!(dias >= 1 && dias <= 30)) return setError('Días de suspensión: de 1 a 30.')
    const texto = dias === 1 ? `el día ${fecha}` : `${dias} días a partir del ${fecha}`
    if (!window.confirm(`¿Suspender a ${nombreDe(alumno)} ${texto}? Se enviará el aviso a la familia.`)) return
    setGuardando(true)
    try {
      const res = await fetch('/api/rac/coordinacion', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entidad: 'suspension',
          accion: 'directa',
          alumnoId: alumno.alumno_id,
          motivo,
          mensaje,
          fecha,
          dias,
        }),
      })
      const data = await leerJson(res)
      if (!res.ok) throw new Error(String(data.error || `Error ${res.status}`))
      onGuardado(data as { envio?: { ok?: boolean; error?: string } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la suspensión')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="rac-modal" role="dialog" aria-modal="true" aria-labelledby="rac-susp-directa-title">
      <div className="rac-modal-card">
        <h3 id="rac-susp-directa-title">Suspensión directa por conducta</h3>
        <p className="rac-mini">
          No suma al conteo de reportes de conducta. Al guardar se envía el aviso a la familia con el enlace
          para confirmar de enterado.
        </p>
        <div className="boletas-filters">
          <label className="rac-autocomplete">
            Alumno
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setAlumno(null)
              }}
              onFocus={() => {
                if (alumnos.length && !alumno) setSugerir(true)
              }}
              onBlur={() => window.setTimeout(() => setSugerir(false), 160)}
              placeholder="Escribe apellido, nombre o control"
              autoComplete="off"
              aria-autocomplete="list"
            />
            {sugerir && !alumno ? (
              <ul className="rac-suggest" role="listbox">
                {buscando ? (
                  <li className="rac-suggest__empty">Buscando…</li>
                ) : alumnos.length === 0 ? (
                  <li className="rac-suggest__empty">
                    {q.trim().length < 1 ? 'Escribe para buscar' : 'Sin coincidencias'}
                  </li>
                ) : (
                  alumnos.map((a) => (
                    <li key={a.alumno_id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={false}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setAlumno(a)
                          setQ(`${nombreDe(a)} · ${a.alumno_ref ?? ''}`)
                          setSugerir(false)
                        }}
                      >
                        <strong>{nombreDe(a)}</strong>
                        <span>
                          Control {a.alumno_ref ?? '—'}
                          {a.alumno_grado != null
                            ? ` · ${etiquetaGradoStaffSecundaria(Number(a.alumno_grado))}`
                            : ''}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </label>
          <label>
            Motivo
            <select value={motivo} onChange={(e) => setMotivo(Number(e.target.value))}>
              {opcionesMotivo(RAC_TIPOS.conducta).map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha de inicio
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
          </label>
          <label>
            Días
            <input
              type="number"
              min={1}
              max={30}
              inputMode="numeric"
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              required
            />
          </label>
        </div>
        <label className="rac-msg">
          Descripción de la falta
          <textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={4}
            required
            lang="es"
            spellCheck
            autoCorrect="on"
            placeholder="Describe lo ocurrido; la familia verá este texto."
          />
        </label>
        {error ? (
          <p className="rac-mini" role="alert" style={{ color: 'var(--rac-danger, #b91c1c)' }}>
            {error}
          </p>
        ) : null}
        <div className="rac-actions">
          <button type="button" className="boletas-btn ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className="boletas-btn danger" disabled={guardando} onClick={() => void guardar()}>
            <Send size={16} aria-hidden />
            {guardando ? 'Guardando…' : 'Suspender y avisar'}
          </button>
        </div>
      </div>
    </div>
  )
}
