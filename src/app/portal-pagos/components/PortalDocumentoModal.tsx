'use client'

import { useEffect, useState } from 'react'
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
  const [xmlTexto, setXmlTexto] = useState<string | null>(null)
  const [xmlError, setXmlError] = useState<string | null>(null)
  const [xmlCargando, setXmlCargando] = useState(false)

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

  useEffect(() => {
    if (!abierto || tipo !== 'xml' || !url) {
      setXmlTexto(null)
      setXmlError(null)
      setXmlCargando(false)
      return
    }

    let cancelado = false
    setXmlCargando(true)
    setXmlTexto(null)
    setXmlError(null)

    ;(async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          const msg =
            body && typeof body === 'object' && 'error' in body
              ? String((body as { error: unknown }).error)
              : `No se pudo cargar el XML (${res.status}).`
          throw new Error(msg)
        }
        const texto = await res.text()
        if (!cancelado) setXmlTexto(texto)
      } catch (e) {
        if (!cancelado) {
          setXmlError(e instanceof Error ? e.message : 'No se pudo cargar el XML.')
        }
      } finally {
        if (!cancelado) setXmlCargando(false)
      }
    })()

    return () => {
      cancelado = true
    }
  }, [abierto, tipo, url])

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
          ) : xmlCargando ? (
            <p className="portal-doc-modal-fallback">Cargando XML…</p>
          ) : xmlError ? (
            <p className="portal-doc-modal-fallback" role="alert">
              {xmlError}{' '}
              <a href={url} target="_blank" rel="noopener noreferrer">
                Intentar en ventana nueva
              </a>
            </p>
          ) : (
            <pre className="portal-doc-modal-xml" tabIndex={0}>
              {xmlTexto}
            </pre>
          )}
        </div>
        <footer className="portal-doc-modal-foot">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="portal-doc-modal-link-ext"
          >
            {tipo === 'xml' ? 'Descargar / abrir XML' : 'Abrir en ventana nueva'}
          </a>
        </footer>
      </div>
    </div>
  )
}
