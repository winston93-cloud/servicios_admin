'use client'

/**
 * 2026-08-21 - Captura de firma: dibujar → guardar firma en el PDF.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  CheckCircle2,
  Eraser,
  Loader2,
  PenLine,
  Save,
} from 'lucide-react'
import type { SignaturePadHandle } from './SignaturePad'

const SignaturePad = dynamic(() => import('./SignaturePad'), {
  ssr: false,
  loading: () => (
    <div className="fe-pad-wrap fe-pad-loading">Cargando pad de firma…</div>
  ),
})

type Props = {
  disabled?: boolean
  guardando?: boolean
  /** Ya hay PDF con firma aplicada (aún no enviada). */
  firmaAplicada?: boolean
  enviado?: boolean
  acepto: boolean
  onGuardarFirma: (firmaPngDataUrl: string) => void | Promise<void>
  onError?: (mensaje: string) => void
}

export default function FirmaCapture({
  disabled = false,
  guardando = false,
  firmaAplicada = false,
  enviado = false,
  acepto,
  onGuardarFirma,
  onError,
}: Props) {
  const padApiRef = useRef<SignaturePadHandle | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const firmaBloqueada = disabled || !acepto || enviado
  const busy = disabled || guardando || enviado
  const puedeGuardar =
    Boolean(previewUrl) && acepto && !busy && !enviado && !disabled

  const bindPad = useCallback((api: SignaturePadHandle) => {
    padApiRef.current = api
  }, [])

  const limpiarPad = useCallback(() => {
    padApiRef.current?.clear()
    setPreviewUrl(null)
  }, [])

  useEffect(() => {
    if (!acepto && !enviado) limpiarPad()
  }, [acepto, enviado, limpiarPad])

  const limpiar = useCallback(() => {
    if (enviado) return
    limpiarPad()
  }, [enviado, limpiarPad])

  const onPadChange = useCallback((empty: boolean) => {
    if (empty) {
      setPreviewUrl(null)
      return
    }
    const png = padApiRef.current?.toDataURL() || ''
    setPreviewUrl(png || null)
  }, [])

  const guardarFirma = useCallback(async () => {
    if (!acepto) {
      onError?.('Debes marcar que leíste y estás de acuerdo con la carta.')
      return
    }
    if (!previewUrl) {
      onError?.('Dibuja tu firma antes de guardar.')
      return
    }
    await onGuardarFirma(previewUrl)
  }, [acepto, previewUrl, onGuardarFirma, onError])

  return (
    <section className="fe-sign-card" aria-label="Captura de firma">
      <header className="fe-doc-head">
        <h2>
          <PenLine size={18} aria-hidden />
          2. Firmar
        </h2>
      </header>

      {!acepto && !enviado ? (
        <p className="fe-acepto-hint" role="status">
          Marca «He leído…» debajo del documento original para habilitar la
          firma.
        </p>
      ) : null}

      <div
        className={`fe-sign-body${firmaBloqueada && !enviado ? ' is-locked' : ''}`}
        aria-disabled={firmaBloqueada}
      >
        <p className="fe-help">
          Firma con el dedo en celular o despacio con el mouse
        </p>

        <SignaturePad
          onBind={bindPad}
          onChange={onPadChange}
          disabled={firmaBloqueada || busy}
        />
      </div>

      <div className="fe-actions">
        <button
          type="button"
          className="fe-btn fe-btn--ghost"
          onClick={limpiar}
          disabled={busy || !acepto || enviado}
        >
          <Eraser size={16} aria-hidden />
          Limpiar
        </button>
        <button
          type="button"
          className={`fe-btn fe-btn--send${firmaAplicada && !guardando ? ' is-saved' : ''}`}
          onClick={() => void guardarFirma()}
          disabled={!puedeGuardar}
          aria-live="polite"
        >
          {guardando ? (
            <Loader2 size={16} className="fe-spin" aria-hidden />
          ) : firmaAplicada ? (
            <CheckCircle2 size={16} aria-hidden />
          ) : (
            <Save size={16} aria-hidden />
          )}
          {guardando
            ? 'Guardando firma…'
            : firmaAplicada
              ? 'Firma guardada · actualizar'
              : 'Guardar firma'}
        </button>
      </div>
    </section>
  )
}
