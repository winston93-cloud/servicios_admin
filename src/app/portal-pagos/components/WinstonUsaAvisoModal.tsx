'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface WinstonUsaAvisoModalProps {
  abierto: boolean
  /** 1 = primer pago; 2/3 = pagos siguientes. */
  pago: 1 | 2 | 3
  concepto: string
  onContinuar: () => void
  onCancelar: () => void
  textoContinuar?: string
  /** Sin pago abierto todavía: solo informa (botón «Entendido»). */
  notaSinPago?: string
}

export default function WinstonUsaAvisoModal({
  abierto,
  pago,
  concepto,
  onContinuar,
  onCancelar,
  textoContinuar = 'Continuar con el pago',
  notaSinPago,
}: WinstonUsaAvisoModalProps) {
  const continuarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelar()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    continuarRef.current?.focus()
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [abierto, onCancelar])

  if (!abierto) return null

  const primero = pago === 1

  return (
    <div className="portal-doc-modal-overlay" role="presentation" onClick={onCancelar}>
      <div
        className="portal-doc-modal portal-usa-aviso"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portal-usa-aviso-titulo"
        aria-describedby="portal-usa-aviso-texto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="portal-doc-modal-header portal-boucher-modal-header">
          <div>
            <p className="portal-boucher-modal-eyebrow">{concepto}</p>
            <h2 id="portal-usa-aviso-titulo" className="portal-doc-modal-title">
              {primero ? 'Antes de continuar' : 'Pago siguiente'}
            </h2>
          </div>
          <button
            type="button"
            className="portal-doc-modal-cerrar"
            onClick={onCancelar}
            aria-label="Cerrar aviso"
          >
            <X size={20} aria-hidden />
          </button>
        </header>
        <div id="portal-usa-aviso-texto" className="portal-usa-aviso-body">
          {primero ? (
            <>
              <p>
                El Programa USA es una opción de doble titulación del Instituto Winston Churchill: los
                estudios del alumno se integran a un proceso de reconocimiento académico que permite
                contar con documentación estadounidense respaldada por una institución acreditada.
              </p>
              <p>
                <strong>No es obligatorio.</strong> Continúe solo si la familia desea participar.
              </p>
              <p>Este primer pago confirma el interés en el programa.</p>
            </>
          ) : (
            <>
              <p>
                El Programa USA es la opción de doble titulación con documentación académica
                estadounidense, para fortalecer el expediente del alumno con proyección internacional.
              </p>
              <p>
                <strong>Este pago es solo para quien ya realizó el pago anterior (o los anteriores).</strong>
              </p>
              <p>La participación sigue siendo voluntaria.</p>
            </>
          )}
          {notaSinPago ? <p className="portal-usa-aviso-nota">{notaSinPago}</p> : null}
        </div>
        <footer className="portal-doc-modal-foot portal-usa-aviso-foot">
          {notaSinPago ? (
            <button ref={continuarRef} type="button" className="portal-pagos-btn-prim" onClick={onCancelar}>
              Entendido
            </button>
          ) : (
            <>
              <button type="button" className="portal-pagos-btn-sec" onClick={onCancelar}>
                Cancelar
              </button>
              <button
                ref={continuarRef}
                type="button"
                className="portal-pagos-btn-prim"
                onClick={onContinuar}
              >
                {textoContinuar}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
