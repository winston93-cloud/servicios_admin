'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, CircleHelp, Search, X } from 'lucide-react'
import {
  PORTAL_AYUDA_CATEGORIAS,
  PORTAL_AYUDA_FAQ,
  type PortalAyudaCategoriaId,
} from '@/lib/portalAyudaFaq'
import './dashboard-ayuda.css'

type DashboardAyudaModalProps = {
  abierto: boolean
  onCerrar: () => void
}

export default function DashboardAyudaModal({ abierto, onCerrar }: DashboardAyudaModalProps) {
  const tituloId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [categoria, setCategoria] = useState<PortalAyudaCategoriaId | 'todas'>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [abiertoId, setAbiertoId] = useState<string | null>(PORTAL_AYUDA_FAQ[0]?.id ?? null)

  const items = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return PORTAL_AYUDA_FAQ.filter((item) => {
      if (categoria !== 'todas' && item.categoria !== categoria) return false
      if (!q) return true
      return (
        item.pregunta.toLowerCase().includes(q) || item.respuesta.toLowerCase().includes(q)
      )
    })
  }, [busqueda, categoria])

  useEffect(() => {
    if (!abierto) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('input, button')?.focus()
    }, 40)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [abierto, onCerrar])

  useEffect(() => {
    if (!abierto) return
    if (items.length === 0) {
      setAbiertoId(null)
      return
    }
    if (!items.some((i) => i.id === abiertoId)) {
      setAbiertoId(items[0].id)
    }
  }, [abierto, items, abiertoId])

  if (!abierto) return null

  return (
    <div className="dash-ayuda-root" role="presentation">
      <button
        type="button"
        className="dash-ayuda-backdrop"
        aria-label="Cerrar ayuda"
        onClick={onCerrar}
      />
      <div
        ref={panelRef}
        className="dash-ayuda-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <header className="dash-ayuda-header">
          <div className="dash-ayuda-header-copy">
            <p className="dash-ayuda-kicker">Centro de ayuda</p>
            <h2 id={tituloId} className="dash-ayuda-title">
              Inscripciones, colegiaturas y facturación
            </h2>
            <p className="dash-ayuda-lead">
              Respuestas claras al proceso del portal. Elige un tema o busca tu duda.
            </p>
          </div>
          <button type="button" className="dash-ayuda-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className="dash-ayuda-toolbar">
          <label className="dash-ayuda-search">
            <Search size={18} aria-hidden />
            <span className="sr-only">Buscar en ayuda</span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar… ej. factura, reinscripción, SPEI"
              autoComplete="off"
            />
          </label>
          <div className="dash-ayuda-chips" role="tablist" aria-label="Temas de ayuda">
            <button
              type="button"
              role="tab"
              aria-selected={categoria === 'todas'}
              className={`dash-ayuda-chip${categoria === 'todas' ? ' is-active' : ''}`}
              onClick={() => setCategoria('todas')}
            >
              Todo
            </button>
            {PORTAL_AYUDA_CATEGORIAS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={categoria === c.id}
                className={`dash-ayuda-chip${categoria === c.id ? ' is-active' : ''}`}
                onClick={() => setCategoria(c.id)}
              >
                {c.titulo.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="dash-ayuda-body">
          {categoria !== 'todas' && (
            <p className="dash-ayuda-cat-hint">
              {PORTAL_AYUDA_CATEGORIAS.find((c) => c.id === categoria)?.subtitulo}
            </p>
          )}

          {items.length === 0 ? (
            <p className="dash-ayuda-vacio" role="status">
              No hay resultados para esa búsqueda. Prueba con «pago», «recibo» o «RFC».
            </p>
          ) : (
            <ul className="dash-ayuda-lista">
              {items.map((item) => {
                const abiertoItem = abiertoId === item.id
                const cat = PORTAL_AYUDA_CATEGORIAS.find((c) => c.id === item.categoria)
                return (
                  <li key={item.id} className={`dash-ayuda-item${abiertoItem ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="dash-ayuda-item-trigger"
                      aria-expanded={abiertoItem}
                      onClick={() => setAbiertoId(abiertoItem ? null : item.id)}
                    >
                      <span className="dash-ayuda-item-meta">
                        <span className="dash-ayuda-item-cat">{cat?.titulo ?? item.categoria}</span>
                        <span className="dash-ayuda-item-q">{item.pregunta}</span>
                      </span>
                      <ChevronDown
                        size={18}
                        className="dash-ayuda-item-chevron"
                        aria-hidden
                      />
                    </button>
                    {abiertoItem && (
                      <div className="dash-ayuda-item-a">
                        <p>{item.respuesta}</p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <footer className="dash-ayuda-footer">
          <CircleHelp size={16} aria-hidden />
          <p>
            ¿Sigues bloqueado? Anota el número de control del alumno y el mensaje en pantalla, y
            acude a servicios escolares o caja.
          </p>
        </footer>
      </div>
    </div>
  )
}
