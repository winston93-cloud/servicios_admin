'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, X } from 'lucide-react'
import { portalSessionFetchHeaders } from '@/lib/portalSessionFetch'
import type { GrupoEnMinimo } from '@/lib/talleres/talleresAlertaMinimo'
import './talleres-minimo-popup.css'

const CLAVE_CERRADO = 'servicios-admin-talleres-minimo-cerrado'

/** Cambia si entra/sale un grupo o cambian sus inscritos: entonces el popup vuelve a salir. */
function firma(grupos: GrupoEnMinimo[]): string {
  return grupos
    .map((g) => `${g.id}:${g.inscritos}/${g.cupo_min}`)
    .sort()
    .join(',')
}

/** Popup al entrar al dashboard si hay talleres en su cupo mínimo (solo quien ve Talleres). */
export default function TalleresMinimoPopup({ activo }: { activo: boolean }) {
  const router = useRouter()
  const tituloId = useId()
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const [grupos, setGrupos] = useState<GrupoEnMinimo[]>([])
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!activo) return
    let cancelado = false
    fetch('/api/talleres/alertas-minimo', { cache: 'no-store', headers: portalSessionFetchHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { grupos?: GrupoEnMinimo[] } | null) => {
        if (cancelado || !json?.grupos?.length) return
        let cerrado: string | null = null
        try {
          cerrado = sessionStorage.getItem(CLAVE_CERRADO)
        } catch {}
        setGrupos(json.grupos)
        if (cerrado !== firma(json.grupos)) setAbierto(true)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [activo])

  const cerrar = useCallback(() => {
    setAbierto(false)
    try {
      sessionStorage.setItem(CLAVE_CERRADO, firma(grupos))
    } catch {}
  }, [grupos])

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

  if (!abierto || !grupos.length) return null

  const debajo = grupos.filter((g) => g.inscritos < g.cupo_min).length

  return (
    <div className="tmin-root" role="presentation">
      <button type="button" className="tmin-backdrop" aria-label="Cerrar aviso" onClick={cerrar} />
      <div className="tmin-panel" role="alertdialog" aria-modal="true" aria-labelledby={tituloId}>
        <header className="tmin-header">
          <span className="tmin-icono" aria-hidden>
            <AlertTriangle size={30} strokeWidth={2.4} />
          </span>
          <div className="tmin-header-copy">
            <p className="tmin-kicker">Alerta de Talleres</p>
            <h2 id={tituloId} className="tmin-title">
              {grupos.length === 1 ? 'Un taller está en su mínimo' : `${grupos.length} talleres están en su mínimo`}
            </h2>
            <p className="tmin-lead">
              Tienen igual o menos alumnos inscritos que su cupo mínimo
              {debajo ? ` (${debajo} ya por debajo)` : ''}.
            </p>
          </div>
          <button ref={cerrarRef} type="button" className="tmin-cerrar" onClick={cerrar} aria-label="Cerrar">
            <X size={22} aria-hidden />
          </button>
        </header>

        <ul className="tmin-lista">
          {grupos.map((g) => {
            const faltan = g.cupo_min - g.inscritos
            return (
              <li key={g.id} className="tmin-item">
                <div className="tmin-item-copy">
                  <strong className="tmin-item-taller">{g.taller}</strong>
                  <span className="tmin-item-meta">{[g.maestro, g.niveles].filter(Boolean).join(' · ')}</span>
                  {g.horario ? <span className="tmin-item-meta">{g.horario}</span> : null}
                </div>
                <div className="tmin-item-cupo" aria-label={`${g.inscritos} inscritos de mínimo ${g.cupo_min}`}>
                  <span className="tmin-item-nums">
                    <b>{g.inscritos}</b>
                    <small>/ mín. {g.cupo_min}</small>
                  </span>
                  <span className="tmin-item-estado">{faltan > 0 ? `Faltan ${faltan}` : 'En el mínimo'}</span>
                </div>
              </li>
            )
          })}
        </ul>

        <footer className="tmin-footer">
          <button type="button" className="tmin-btn tmin-btn--sec" onClick={cerrar}>
            Cerrar
          </button>
          <button
            type="button"
            className="tmin-btn tmin-btn--pri"
            onClick={() => {
              cerrar()
              router.push('/talleres')
            }}
          >
            Ver en Talleres
            <ArrowRight size={18} aria-hidden />
          </button>
        </footer>
      </div>
    </div>
  )
}
