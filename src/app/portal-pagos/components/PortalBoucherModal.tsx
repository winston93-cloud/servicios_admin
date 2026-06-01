'use client'

import { useEffect } from 'react'
import { X, Download } from 'lucide-react'

interface PortalBoucherModalProps {
  abierto: boolean
  pdfUrl: string | null
  referencia: string | null
  concepto: string
  onCerrar: () => void
}

export default function PortalBoucherModal({
  abierto,
  pdfUrl,
  referencia,
  concepto,
  onCerrar,
}: PortalBoucherModalProps) {
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

  if (!abierto || !pdfUrl) return null

  return (
    <div className="portal-doc-modal-overlay" role="presentation" onClick={onCerrar}>
      <div
        className="portal-doc-modal portal-doc-modal--boucher"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-boucher-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="portal-doc-modal-header portal-boucher-modal-header">
          <div>
            <p className="portal-boucher-modal-eyebrow">Comprobante de pago</p>
            <h2 id="portal-boucher-modal-title" className="portal-doc-modal-title">
              {concepto}
            </h2>
            {referencia && (
              <p className="portal-boucher-ref">
                Referencia <code>{referencia}</code>
              </p>
            )}
          </div>
          <button
            type="button"
            className="portal-doc-modal-cerrar"
            onClick={onCerrar}
            aria-label="Cerrar baucher"
          >
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="portal-doc-modal-body">
          <object
            data={pdfUrl}
            type="application/pdf"
            className="portal-doc-modal-frame"
            title={`Baucher ${concepto}`}
          >
            <p className="portal-doc-modal-fallback">Vista previa no disponible en este navegador.</p>
          </object>
        </div>
        <footer className="portal-doc-modal-foot">
          <a href={pdfUrl} download={`baucher-${referencia ?? 'pago'}.pdf`} className="portal-pagos-btn-prim">
            <Download size={16} aria-hidden />
            Descargar PDF
          </a>
        </footer>
      </div>
    </div>
  )
}
