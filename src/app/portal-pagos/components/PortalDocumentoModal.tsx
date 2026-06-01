'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

export type TipoDocumentoPortal = 'pdf' | 'xml'

interface PortalDocumentoModalProps {
  abierto: boolean
  tipo: TipoDocumentoPortal
  url: string | null
  titulo: string
  onCerrar: () => void
}

export default function PortalDocumentoModal({
  abierto,
  tipo,
  url,
  titulo,
  onCerrar,
}: PortalDocumentoModalProps) {
  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [abierto, onCerrar])

  if (!abierto || !url) return null

  return (
    <div className="portal-doc-modal-overlay" role="presentation" onClick={onCerrar}>
      <div
        className="portal-doc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-doc-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="portal-doc-modal-header">
          <h2 id="portal-doc-modal-title" className="portal-doc-modal-title">
            {titulo}
          </h2>
          <button
            type="button"
            className="portal-doc-modal-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar visor"
          >
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="portal-doc-modal-body">
          {tipo === 'pdf' ? (
            <object
              data={url}
              type="application/pdf"
              className="portal-doc-modal-frame"
              title={titulo}
            >
              <p className="portal-doc-modal-fallback">
                No se pudo mostrar el PDF aquí.{' '}
                <a href={url} target="_blank" rel="noopener noreferrer">
                  Abrir en una pestaña nueva
                </a>
              </p>
            </object>
          ) : (
            <iframe
              src={url}
              className="portal-doc-modal-frame"
              title={titulo}
              sandbox="allow-same-origin allow-scripts"
            />
          )}
        </div>
        <footer className="portal-doc-modal-foot">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="portal-doc-modal-link-ext"
          >
            Abrir en ventana nueva
          </a>
        </footer>
      </div>
    </div>
  )
}
