'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowRightLeft,
  Ban,
  Loader2,
  ShieldAlert,
  X,
} from 'lucide-react'
import type {
  ModoCancelacionPagoInterno,
  PagoInternoRegistro,
} from '@/lib/pagoInternoService'

interface Props {
  abierto: boolean
  pago: PagoInternoRegistro | null
  conceptoEtiqueta?: string
  procesando?: boolean
  onCerrar: () => void
  onConfirmar: (modo: ModoCancelacionPagoInterno) => void
}

export default function PagosInternosCancelarModal({
  abierto,
  pago,
  conceptoEtiqueta,
  procesando = false,
  onCerrar,
  onConfirmar,
}: Props) {
  const tituloId = useId()
  const [modo, setModo] = useState<ModoCancelacionPagoInterno | null>(null)

  useEffect(() => {
    if (!abierto) {
      setModo(null)
      return
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !procesando) onCerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [abierto, onCerrar, procesando])

  if (!abierto || !pago || typeof document === 'undefined') return null

  const folio = pago.pago_folio
  const monto = Number(pago.pago_importe).toFixed(2)

  return createPortal(
    <div
      className="pi-cancel-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !procesando) onCerrar()
      }}
    >
      <div
        className="pi-cancel-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <header className="pi-cancel-modal__head">
          <div className="pi-cancel-modal__badge" aria-hidden>
            <ShieldAlert size={22} />
          </div>
          <div className="pi-cancel-modal__titles">
            <h2 id={tituloId}>Cancelar folio</h2>
            <p>
              Folio <strong>№ {folio}</strong>
              {conceptoEtiqueta ? ` · ${conceptoEtiqueta}` : ''} · ${monto}
            </p>
          </div>
          <button
            type="button"
            className="pi-cancel-modal__close"
            onClick={onCerrar}
            disabled={procesando}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <p className="pi-cancel-modal__lead">
          Elige cómo quieres proceder. Esta acción afecta la numeración de
          recibos — revísala con calma.
        </p>

        <div className="pi-cancel-options" role="radiogroup" aria-label="Tipo de cancelación">
          <button
            type="button"
            role="radio"
            aria-checked={modo === 'solo'}
            className={`pi-cancel-option ${modo === 'solo' ? 'pi-cancel-option--on' : ''}`}
            disabled={procesando}
            onClick={() => setModo('solo')}
          >
            <span className="pi-cancel-option__icon pi-cancel-option__icon--ban">
              <Ban size={20} aria-hidden />
            </span>
            <span className="pi-cancel-option__body">
              <strong>Solo cancelar</strong>
              <span>
                Marca el folio como cancelado. El número <em>{folio}</em> queda
                fuera de uso (no se reasigna). El resto de la serie no se mueve.
              </span>
            </span>
            <span className="pi-cancel-option__check" aria-hidden />
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={modo === 'recorrer'}
            className={`pi-cancel-option ${modo === 'recorrer' ? 'pi-cancel-option--on pi-cancel-option--shift' : ''}`}
            disabled={procesando}
            onClick={() => setModo('recorrer')}
          >
            <span className="pi-cancel-option__icon pi-cancel-option__icon--shift">
              <ArrowRightLeft size={20} aria-hidden />
            </span>
            <span className="pi-cancel-option__body">
              <strong>Cancelar y recorrer</strong>
              <span>
                Cancela el <em>{folio}</em> y pasa su contenido al{' '}
                <em>{folio + 1}</em>; todos los folios siguientes de la misma
                serie avanzan +1 (útil si la impresora masticó el recibo).
              </span>
            </span>
            <span className="pi-cancel-option__check" aria-hidden />
          </button>
        </div>

        <footer className="pi-cancel-modal__foot">
          <button
            type="button"
            className="pi-cancel-btn pi-cancel-btn--ghost"
            onClick={onCerrar}
            disabled={procesando}
          >
            Volver
          </button>
          <button
            type="button"
            className="pi-cancel-btn pi-cancel-btn--danger"
            disabled={!modo || procesando}
            onClick={() => modo && onConfirmar(modo)}
          >
            {procesando ? (
              <>
                <Loader2 size={16} className="pi-spin" aria-hidden />
                Aplicando…
              </>
            ) : (
              'Confirmar cancelación'
            )}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
