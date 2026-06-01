'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface PortalSpeiReciboModalProps {
  abierto: boolean
  speiPdfUrl: string | null
  referenciaSpei: string | null
  concepto: string
  onCerrar: () => void
}

export default function PortalSpeiReciboModal({
  abierto,
  speiPdfUrl,
  referenciaSpei,
  concepto,
  onCerrar,
}: PortalSpeiReciboModalProps) {
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

  if (!abierto || !speiPdfUrl) return null

  return (
    <div className="portal-doc-modal-overlay" role="presentation" onClick={onCerrar}>
      <div
        className="portal-doc-modal portal-doc-modal--boucher portal-doc-modal--spei"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-spei-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="portal-doc-modal-header portal-boucher-modal-header">
          <div>
            <p className="portal-boucher-modal-eyebrow">Recibo SPEI · OpenPay</p>
            <h2 id="portal-spei-modal-title" className="portal-doc-modal-title">
              {concepto}
            </h2>
            {referenciaSpei && (
              <p className="portal-boucher-ref">
                Referencia SPEI <code>{referenciaSpei}</code>
              </p>
            )}
          </div>
          <button
            type="button"
            className="portal-doc-modal-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar recibo SPEI"
          >
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="portal-doc-modal-body">
          <iframe
            src={speiPdfUrl}
            title={`Recibo SPEI ${concepto}`}
            className="portal-doc-modal-frame"
          />
        </div>
        <footer className="portal-doc-modal-foot">
          <a
            href={speiPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="portal-pagos-btn-prim"
          >
            Abrir recibo en nueva pestaña
          </a>
        </footer>
      </div>
    </div>
  )
}
