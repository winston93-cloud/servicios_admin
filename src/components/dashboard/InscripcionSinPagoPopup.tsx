'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Clock, X } from 'lucide-react'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import type { AlumnoSinPagoInscripcion } from '@/lib/inscripcionSinPagoAlerta'
import './inscripcion-sin-pago-popup.css'

function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Popup cada vez que se entra al dashboard mientras haya alumnos con más de 30 días sin pagar inscripción. */
export default function InscripcionSinPagoPopup({ activo }: { activo: boolean }) {
  const tituloId = useId()
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const [alumnos, setAlumnos] = useState<AlumnoSinPagoInscripcion[]>([])
  const [ciclo, setCiclo] = useState('')
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!activo) return
    let cancelado = false
    fetch('/api/control-escolar/alertas-inscripcion', { cache: 'no-store', headers: portalSessionFetchHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { ciclo?: string; alumnos?: AlumnoSinPagoInscripcion[] } | null) => {
        if (cancelado || !json?.alumnos?.length) return
        setAlumnos(json.alumnos)
        setCiclo(json.ciclo ?? '')
        setAbierto(true)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [activo])

  const cerrar = useCallback(() => setAbierto(false), [])

  useEffect(() => {
    if (!abierto) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => cerrarRef.current?.focus(), 40)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [abierto, cerrar])

  if (!abierto || !alumnos.length) return null

  return (
    <div className="tins-root" role="presentation">
      <button type="button" className="tins-backdrop" aria-label="Cerrar aviso" onClick={cerrar} />
      <div className="tins-panel" role="alertdialog" aria-modal="true" aria-labelledby={tituloId}>
        <header className="tins-header">
          <span className="tins-icono" aria-hidden>
            <Clock size={30} strokeWidth={2.4} />
          </span>
          <div className="tins-header-copy">
            <p className="tins-kicker">Control escolar</p>
            <h2 id={tituloId} className="tins-title">
              {alumnos.length === 1
                ? 'Un alumno no ha pagado su inscripción'
                : `${alumnos.length} alumnos no han pagado su inscripción`}
            </h2>
            {ciclo ? <p className="tins-ciclo">Ciclo escolar {ciclo}</p> : null}
            <p className="tins-lead">
              Más de 30 días desde el inicio del ciclo o, si su referencia se dio después, desde esa fecha.
            </p>
          </div>
          <button ref={cerrarRef} type="button" className="tins-cerrar" onClick={cerrar} aria-label="Cerrar">
            <X size={22} aria-hidden />
          </button>
        </header>

        <ul className="tins-lista">
          {alumnos.map((a) => (
            <li key={a.alumno_id} className="tins-item">
              <div className="tins-item-copy">
                <strong className="tins-item-nombre">{a.nombre}</strong>
                <span className="tins-item-meta">
                  {[`Ref. ${a.alumno_ref}`, a.nivel, a.grado].filter(Boolean).join(' · ')}
                </span>
                <span className="tins-item-meta">
                  {a.cuenta_por === 'referencia' ? 'Referencia desde' : 'Inicio de ciclo'} {fechaCorta(a.cuenta_desde)}
                </span>
              </div>
              <div className="tins-item-dias">
                <span className="tins-item-nums">
                  <b>{a.dias.toLocaleString('es-MX')}</b>
                  <small>días</small>
                </span>
                <span className="tins-item-estado">{a.pago_parcial ? 'Solo un diferido' : 'Sin pagar'}</span>
              </div>
            </li>
          ))}
        </ul>

        <footer className="tins-footer">
          <button type="button" className="tins-btn tins-btn--pri" onClick={cerrar}>
            Entendido
          </button>
        </footer>
      </div>
    </div>
  )
}
